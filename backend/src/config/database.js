const path = require('path');
const config = require('./env');

let db;

if (config.databaseUrl && config.databaseUrl.startsWith('postgresql')) {
  // PostgreSQL mode (for Render / production)
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  pool.on('error', (err) => console.error('DB pool error:', err));
  db = { type: 'pg', pool };
} else {
  // SQLite mode (for local development)
  const Database = require('better-sqlite3');
  const dbPath = path.join(__dirname, '..', '..', 'data', 'kpi.db');
  const fs = require('fs');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  db = { type: 'sqlite', sqlite };
}

// Unified query interface
const database = {
  dbType: db.type,

  async query(text, params = []) {
    if (db.type === 'pg') {
      return db.pool.query(text, params);
    }
    // SQLite: convert PostgreSQL syntax to SQLite
    let sql = pgToSqlite(text);
    params = params.map(p => (p === undefined ? null : p));

    try {
      if (sql.trim().toUpperCase().startsWith('SELECT') ||
          sql.trim().toUpperCase().startsWith('WITH')) {
        const rows = db.sqlite.prepare(sql).all(...params);
        return { rows, rowCount: rows.length };
      } else {
        const info = db.sqlite.prepare(sql).run(...params);
        // For INSERT ... RETURNING
        if (sql.includes('RETURNING')) {
          const returningMatch = sql.match(/RETURNING\s+(.+)/i);
          if (returningMatch) {
            const lastId = info.lastInsertRowid;
            const tableName = sql.match(/(?:INSERT INTO|UPDATE)\s+(\w+)/i)?.[1];
            if (tableName && lastId) {
              const row = db.sqlite.prepare(`SELECT * FROM ${tableName} WHERE rowid = ?`).get(lastId);
              return { rows: row ? [row] : [], rowCount: info.changes };
            }
          }
        }
        return { rows: [], rowCount: info.changes };
      }
    } catch (err) {
      // Handle ON CONFLICT gracefully
      if (err.message.includes('UNIQUE constraint failed') && sql.includes('ON CONFLICT')) {
        return { rows: [], rowCount: 0 };
      }
      console.error('SQLite error:', err.message);
      console.error('SQL:', sql.substring(0, 200));
      throw err;
    }
  },

  async connect() {
    if (db.type === 'pg') {
      return db.pool.connect();
    }
    return {
      query: (text, params) => database.query(text, params),
      release: () => {},
    };
  },

  async end() {
    if (db.type === 'pg') {
      return db.pool.end();
    }
    db.sqlite.close();
  },
};

function pgToSqlite(sql) {
  let s = sql;
  // Replace PostgreSQL $1, $2 parameters with ?
  s = s.replace(/\$\d+/g, '?');
  // Remove type casts
  s = s.replace(/::(?:TEXT|INTEGER|DATE|TIMESTAMPTZ|DECIMAL\([^)]*\)|JSONB|BOOLEAN|BIGINT|VARCHAR\([^)]*\)|DOUBLE PRECISION)/gi, '');
  // Replace ILIKE with LIKE (case-insensitive by default in SQLite)
  s = s.replace(/\bILIKE\b/gi, 'LIKE');
  // Replace NOW() with datetime('now')
  s = s.replace(/\bNOW\(\)/gi, "datetime('now')");
  // Replace CURRENT_DATE
  s = s.replace(/\bCURRENT_DATE\b/g, "date('now')");
  // Remove PostGIS functions - replace with simple lat/lng
  s = s.replace(/ST_SetSRID\(ST_MakePoint\([^)]+\),\s*\d+\)/g, 'NULL');
  s = s.replace(/ST_X\((\w+)\.location\)/g, '$1.longitude');
  s = s.replace(/ST_Y\((\w+)\.location\)/g, '$1.latitude');
  // Replace FILTER (WHERE ...)
  s = s.replace(/COUNT\(\*\)\s+FILTER\s*\(WHERE\s+([^)]+)\)/gi, (match, cond) => {
    return `SUM(CASE WHEN ${cond} THEN 1 ELSE 0 END)`;
  });
  s = s.replace(/COUNT\((\w+\.\w+)\)\s+FILTER\s*\(WHERE\s+([^)]+)\)/gi, (match, field, cond) => {
    return `SUM(CASE WHEN ${cond} THEN 1 ELSE 0 END)`;
  });
  // Replace DATE_TRUNC
  s = s.replace(/DATE_TRUNC\('day',\s*(\w+)\)/gi, "date($1)");
  s = s.replace(/DATE_TRUNC\('week',\s*(\w+)\)/gi, "date($1, 'weekday 0', '-6 days')");
  // Replace interval
  s = s.replace(/NOW\(\)\s*-\s*\(random\(\)\s*\*\s*interval\s*'(\d+)\s*days'\)/gi, "datetime('now', '-' || abs(random() % $1) || ' days')");
  // Replace uuid_generate_v4()
  s = s.replace(/uuid_generate_v4\(\)/gi, "lower(hex(randomblob(16)))");
  // Remove NULLIF wrapping for simple cases
  // Replace json_agg / json_build_object with simpler SQLite approach
  s = s.replace(/json_agg\([^)]+\)\s*FILTER\s*\(WHERE\s+[^)]+\)/gi, "NULL");
  // Remove USING GIST/GIN index hints
  s = s.replace(/USING\s+(GIST|GIN)\s*\([^)]+\)/gi, '');
  // Remove ON CONFLICT complex clauses - simplify
  s = s.replace(/ON CONFLICT\s*\(([^)]+)\)\s*DO UPDATE SET[\s\S]*?(?=RETURNING|$)/gi, (match, cols) => {
    return `ON CONFLICT(${cols}) DO NOTHING `;
  });
  return s;
}

module.exports = database;
