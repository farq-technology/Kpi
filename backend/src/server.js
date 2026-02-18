const app = require('./app');
const config = require('./config/env');
const pool = require('./db/pool');
const syncRetry = require('./services/sync-retry.service');
const logger = require('./utils/logger');

const PORT = config.port;

async function runPendingMigrations() {
  const fs = require('fs');
  const path = require('path');
  const migrationsDir = path.join(__dirname, 'db', 'migrations');

  let files;
  try {
    files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  } catch (err) {
    logger.warn('Could not read migrations directory', { error: err.message });
    return;
  }

  for (const file of files) {
    const version = parseInt(file.split('_')[0], 10);
    try {
      const { rows } = await pool.query(
        'SELECT 1 FROM schema_migrations WHERE version = $1', [version]
      );
      if (rows.length > 0) continue;
    } catch (_) { /* schema_migrations may not exist yet */ }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
      await pool.query(sql);
      await pool.query(
        'INSERT INTO schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [version, file]
      );
      logger.info(`Migration applied: ${file}`);
    } catch (err) {
      logger.warn(`Migration ${file} failed (may already be applied)`, { error: err.message });
    }
  }
}

async function start() {
  // Test database connection
  try {
    const client = await pool.connect();
    logger.info('Database connected successfully');
    client.release();
  } catch (err) {
    logger.warn('Database not available - running in ArcGIS-only mode', { error: err.message });
  }

  // Run pending migrations before starting services
  try {
    await runPendingMigrations();
  } catch (err) {
    logger.warn('Auto-migration failed', { error: err.message });
  }

  // Start sync retry scheduler
  syncRetry.start();

  app.listen(PORT, () => {
    logger.info(`KPI Dashboard Backend running on port ${PORT}`, {
      environment: config.nodeEnv,
      health: `http://localhost:${PORT}/api/health`,
      webhook: `http://localhost:${PORT}/api/v1/webhook/survey123`,
    });
  });
}

start();
