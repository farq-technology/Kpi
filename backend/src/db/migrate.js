const database = require('../config/database');

async function migrate() {
  console.log(`Database mode: ${database.dbType}`);

  if (database.dbType === 'sqlite') {
    await migrateSQLite();
  } else {
    await migratePostgres();
  }

  console.log('\nAll migrations completed successfully.');
}

async function migrateSQLite() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS surveys (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      form_item_id TEXT NOT NULL UNIQUE,
      form_title TEXT NOT NULL,
      service_item_id TEXT,
      service_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS survey_responses (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      survey_id TEXT REFERENCES surveys(id) ON DELETE CASCADE,
      arcgis_object_id INTEGER,
      arcgis_global_id TEXT UNIQUE,
      surveyor_username TEXT,
      surveyor_name TEXT,
      surveyor_email TEXT,
      agent_id TEXT,
      poi_name_ar TEXT,
      poi_name_en TEXT,
      category TEXT,
      secondary_category TEXT,
      company_status TEXT,
      phone_number TEXT,
      website TEXT,
      social_media TEXT,
      working_days TEXT,
      working_hours TEXT,
      break_time TEXT,
      holidays TEXT,
      language TEXT,
      payment_methods TEXT,
      commercial_license TEXT,
      building_number TEXT,
      floor_number TEXT,
      entrance_location TEXT,
      entrance_description TEXT,
      legal_name TEXT,
      identity_correct TEXT,
      identity_notes TEXT,
      status_notes TEXT,
      is_landmark TEXT,
      pickup_point_exists TEXT,
      pickup_description TEXT,
      has_physical_menu TEXT,
      has_digital_menu TEXT,
      menu_barcode_url TEXT,
      dine_in TEXT,
      only_delivery TEXT,
      drive_thru TEXT,
      order_from_car TEXT,
      has_family_seating TEXT,
      has_separate_rooms_for_dining TEXT,
      large_groups_can_be_seated TEXT,
      reservation TEXT,
      has_parking_lot TEXT,
      valet_parking TEXT,
      wifi TEXT,
      is_wheelchair_accessible TEXT,
      has_smoking_area TEXT,
      has_a_waiting_area TEXT,
      has_women_only_prayer_room TEXT,
      children_area TEXT,
      music TEXT,
      live_sport_broadcasting TEXT,
      shisha TEXT,
      cuisine TEXT,
      offers_iftar_menu TEXT,
      is_open_during_suhoor TEXT,
      provides_iftar_tent TEXT,
      require_ticket TEXT,
      is_free_entry TEXT,
      general_notes TEXT,
      location TEXT,
      latitude REAL,
      longitude REAL,
      is_complete INTEGER DEFAULT 1,
      missing_fields TEXT,
      compliance_score REAL,
      total_fields INTEGER DEFAULT 0,
      filled_fields INTEGER DEFAULT 0,
      event_type TEXT NOT NULL DEFAULT 'addData',
      submitted_at TEXT,
      received_at TEXT NOT NULL DEFAULT (datetime('now')),
      raw_payload TEXT,
      attributes TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS media_attachments (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      response_id TEXT NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
      arcgis_attachment_id INTEGER NOT NULL,
      arcgis_global_id TEXT,
      file_name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      media_category TEXT NOT NULL CHECK (media_category IN ('image', 'video', 'audio', 'document')),
      keyword TEXT,
      file_size_bytes INTEGER,
      arcgis_url TEXT NOT NULL,
      download_status TEXT DEFAULT 'pending' CHECK (download_status IN ('pending', 'downloaded', 'failed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS kpi_cache (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'all_time')),
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      survey_id TEXT REFERENCES surveys(id) ON DELETE CASCADE,
      total_responses INTEGER NOT NULL DEFAULT 0,
      compliance_percentage REAL,
      media_usage_rate REAL,
      missing_data_percentage REAL,
      total_images INTEGER DEFAULT 0,
      total_videos INTEGER DEFAULT 0,
      unique_surveyors INTEGER DEFAULT 0,
      categories_count TEXT DEFAULT '{}',
      agent_counts TEXT DEFAULT '{}',
      status_counts TEXT DEFAULT '{}',
      computed_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(period_type, period_start, survey_id)
    )`,
  ];

  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_responses_submitted_at ON survey_responses(submitted_at)`,
    `CREATE INDEX IF NOT EXISTS idx_responses_survey_id ON survey_responses(survey_id)`,
    `CREATE INDEX IF NOT EXISTS idx_responses_category ON survey_responses(category)`,
    `CREATE INDEX IF NOT EXISTS idx_responses_agent ON survey_responses(surveyor_username)`,
    `CREATE INDEX IF NOT EXISTS idx_media_response_id ON media_attachments(response_id)`,
    `CREATE INDEX IF NOT EXISTS idx_media_category ON media_attachments(media_category)`,
  ];

  for (const sql of [...tables, ...indexes]) {
    try {
      await database.query(sql);
    } catch (err) {
      console.error('Migration error:', err.message);
    }
  }
  console.log('  SQLite tables created successfully.');
}

async function migratePostgres() {
  const fs = require('fs');
  const path = require('path');

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    const version = parseInt(file.split('_')[0], 10);

    if (version > 1) {
      try {
        const { rows } = await database.query(
          'SELECT 1 FROM schema_migrations WHERE version = $1', [version]
        );
        if (rows.length > 0) { console.log(`  Skip: ${file}`); continue; }
      } catch (e) { /* table may not exist */ }
    }

    console.log(`  Running: ${file}`);
    try {
      await database.query(sql);
      await database.query(
        'INSERT INTO schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [version, file]
      );
    } catch (err) {
      console.error(`  Failed ${file}:`, err.message);
    }
  }
}

migrate().then(() => database.end()).catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
