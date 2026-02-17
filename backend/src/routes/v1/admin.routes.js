const express = require('express');
const router = express.Router();
const pool = require('../../db/pool');
const axios = require('axios');
const crypto = require('crypto');
const config = require('../../config/env');
const { arcgisToLocalMap } = require('../../config/field-mappings');
const { calculateCompliance } = require('../../utils/compliance');

let arcgisToken = null;
let tokenExpiry = 0;

async function getToken() {
  if (arcgisToken && Date.now() < tokenExpiry) return arcgisToken;
  const resp = await axios.post('https://www.arcgis.com/sharing/rest/generateToken', new URLSearchParams({
    username: config.arcgis.username,
    password: config.arcgis.password,
    referer: 'https://www.arcgis.com',
    f: 'json',
  }), { timeout: 15000 });
  if (resp.data.error) throw new Error(resp.data.error.message);
  arcgisToken = resp.data.token;
  tokenExpiry = resp.data.expires - 60000;
  return arcgisToken;
}

async function runImport(whereFilter) {
  const BATCH_SIZE = 2000;
  const serviceUrl = config.arcgis.serviceUrl;
  const where = whereFilter || "district_en LIKE '%Nafl%' OR district_ar LIKE '%النفل%'";

  // Get total count
  const token = await getToken();
  const countResp = await axios.post(`${serviceUrl}/query`, new URLSearchParams({
    where, returnCountOnly: true, f: 'json', token,
  }), { timeout: 15000 });
  const totalCount = countResp.data.count;
  importProgress = { status: 'running', imported: 0, total: totalCount, errors: 0, filter: where, startedAt: new Date().toISOString() };
  console.log(`[Import] Starting: ${totalCount} features (filter: ${where})`);

  // Clear existing data
  await pool.query('DELETE FROM media_attachments');
  await pool.query('DELETE FROM survey_responses');
  console.log('[Import] Cleared existing data');

  let offset = 0;

  while (offset < totalCount) {
    try {
      const tk = await getToken();
      const resp = await axios.post(`${serviceUrl}/query`, new URLSearchParams({
        where,
        outFields: '*',
        returnGeometry: true,
        resultOffset: offset,
        resultRecordCount: BATCH_SIZE,
        orderByFields: 'objectid ASC',
        f: 'json',
        token: tk,
      }), { timeout: 120000 });

      const features = resp.data.features || [];
      if (features.length === 0) break;

      for (const feat of features) {
        const attrs = feat.attributes || {};
        const geom = feat.geometry || {};
        // Convert ArcGIS field names to local DB names for compliance calculation
        const localRecord = {};
        for (const [arcgisName, value] of Object.entries(attrs)) {
          const localName = arcgisToLocalMap[arcgisName];
          if (localName) localRecord[localName] = value;
        }
        const { score, isComplete, missingFields, totalFields, filledFields } = calculateCompliance(localRecord, {
          category: attrs.category || '',
        });
        const submittedAt = attrs.CreationDate ? new Date(attrs.CreationDate).toISOString() : new Date().toISOString();
        const lat = geom.y || attrs.latitude;
        const lon = geom.x || attrs.longitude;
        const responseId = crypto.randomUUID();

        try {
          await pool.query(`
            INSERT INTO survey_responses (
              id, arcgis_object_id, arcgis_global_id,
              surveyor_username, agent_id,
              poi_name_ar, poi_name_en, category, secondary_category,
              company_status, phone_number, website, social_media,
              working_days, working_hours, break_time, holidays,
              language, payment_methods, commercial_license,
              building_number, floor_number, entrance_location,
              dine_in, has_family_seating, has_parking_lot, wifi,
              is_wheelchair_accessible, cuisine, offers_iftar_menu, is_open_during_suhoor,
              latitude, longitude,
              is_complete, missing_fields, compliance_score, total_fields, filled_fields,
              event_type, submitted_at, raw_payload, attributes
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9,
              $10, $11, $12, $13, $14, $15, $16, $17,
              $18, $19, $20, $21, $22, $23, $24, $25,
              $26, $27, $28, $29, $30, $31, $32, $33,
              $34, $35, $36, $37, $38, $39, $40, $41, $42
            )
            ON CONFLICT (arcgis_global_id) DO NOTHING
          `, [
            responseId, attrs.objectid, attrs.globalid,
            attrs.agent_name || attrs.Creator || null, attrs.agent_id || null,
            attrs.name_ar || null, attrs.name_en || null,
            attrs.category || null, attrs.secondary_category || null,
            attrs.company_status || null, attrs.phone_number || null,
            attrs.website || null, attrs.social_media || null,
            attrs.working_days || null, attrs.working_hours_each_day || null,
            attrs.break_time_each_day || null, attrs.holidays || null,
            attrs.language || null, attrs.accepted_payment_methods || null,
            attrs.commercial_license_number || null,
            attrs.building_number || null, attrs.floor_number || null,
            attrs.entrance_description || null,
            attrs.dine_in || null, attrs.has_family_seating || null,
            attrs.has_parking_lot || null, attrs.wifi || null,
            attrs.is_wheelchair_accessible || null, attrs.cuisine || null,
            attrs.offers_iftar_menu || null, attrs.is_open_during_suhoor || null,
            lat || null, lon || null,
            isComplete ? 1 : 0, JSON.stringify(missingFields), score, totalFields, filledFields,
            'addData', submittedAt, JSON.stringify(feat), JSON.stringify(attrs),
          ]);
        } catch (insertErr) {
          importProgress.errors++;
        }
      }

      offset += features.length;
      importProgress.imported = offset;
      const pct = (offset / totalCount * 100).toFixed(1);
      console.log(`[Import] ${offset}/${totalCount} (${pct}%) - errors: ${importProgress.errors}`);

      // Small delay
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      console.error(`[Import] Batch error at offset ${offset}:`, err.message);
      importProgress.errors++;
      offset += BATCH_SIZE;
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  importProgress.status = 'complete';
  importProgress.finishedAt = new Date().toISOString();
  console.log(`[Import] Complete: ${importProgress.imported} imported, ${importProgress.errors} errors`);
}

// POST /api/v1/admin/import - trigger bulk import
router.post('/import', (req, res) => {
  const secret = req.query.secret;
  if (secret !== (config.webhookSecret || 'kpi-webhook-farq-2026')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (importRunning) {
    return res.json({ status: 'already_running', progress: importProgress });
  }

  importRunning = true;
  runImport(req.query.where || null)
    .catch(err => {
      console.error('[Import] Fatal:', err);
      importProgress.status = 'error';
      importProgress.error = err.message;
    })
    .finally(() => { importRunning = false; });

  res.json({ status: 'started', message: 'Import started in background' });
});

// GET /api/v1/admin/import/status - check import progress
router.get('/import/status', (req, res) => {
  res.json(importProgress);
});

// POST /api/v1/admin/migrate - run pending migrations
router.post('/migrate', async (req, res) => {
  const secret = req.query.secret;
  if (secret !== (config.webhookSecret || 'kpi-webhook-farq-2026')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const fs = require('fs');
    const path = require('path');
    const migrationsDir = path.join(__dirname, '../../db/migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    const results = [];

    for (const file of files) {
      const version = parseInt(file.split('_')[0], 10);
      try {
        const { rows } = await pool.query(
          'SELECT 1 FROM schema_migrations WHERE version = $1', [version]
        );
        if (rows.length > 0) { results.push({ file, status: 'skipped' }); continue; }
      } catch (e) { /* schema_migrations may not exist */ }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      try {
        await pool.query(sql);
        await pool.query(
          'INSERT INTO schema_migrations (version, name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [version, file]
        );
        results.push({ file, status: 'applied' });
      } catch (err) {
        results.push({ file, status: 'error', error: err.message });
      }
    }

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/admin/fix-columns - force add missing columns
router.post('/fix-columns', async (req, res) => {
  const secret = req.query.secret;
  if (secret !== (config.webhookSecret || 'kpi-webhook-farq-2026')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const alterStatements = [
      'ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS legal_name TEXT',
      'ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS status_notes TEXT',
      "ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS identity_correct VARCHAR(10)",
      'ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS identity_notes TEXT',
      'ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS entrance_description TEXT',
      "ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS is_landmark VARCHAR(10)",
      "ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS pickup_point_exists VARCHAR(10)",
      'ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS pickup_description TEXT',
      "ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS has_physical_menu VARCHAR(10)",
      "ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS has_digital_menu VARCHAR(10)",
      'ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS menu_barcode_url TEXT',
      "ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS only_delivery VARCHAR(10)",
      "ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS drive_thru VARCHAR(10)",
      "ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS order_from_car VARCHAR(10)",
      "ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS has_separate_rooms_for_dining VARCHAR(10)",
      "ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS large_groups_can_be_seated VARCHAR(10)",
      "ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS reservation VARCHAR(10)",
      "ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS valet_parking VARCHAR(10)",
      "ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS has_smoking_area VARCHAR(10)",
      "ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS has_a_waiting_area VARCHAR(10)",
      "ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS has_women_only_prayer_room VARCHAR(10)",
      "ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS children_area VARCHAR(10)",
      "ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS music VARCHAR(10)",
      "ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS live_sport_broadcasting VARCHAR(10)",
      "ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS shisha VARCHAR(10)",
      "ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS provides_iftar_tent VARCHAR(10)",
      "ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS require_ticket VARCHAR(10)",
      "ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS is_free_entry VARCHAR(10)",
      'ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS general_notes TEXT',
    ];

    const results = [];
    for (const sql of alterStatements) {
      try {
        await pool.query(sql);
        results.push({ sql: sql.substring(sql.indexOf('IF NOT EXISTS') + 14), status: 'ok' });
      } catch (err) {
        results.push({ sql: sql.substring(sql.indexOf('IF NOT EXISTS') + 14), status: 'error', error: err.message });
      }
    }

    // Verify columns exist
    const { rows } = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'survey_responses'
      ORDER BY ordinal_position
    `);
    const columns = rows.map(r => r.column_name);

    res.json({ success: true, results, totalColumns: columns.length, columns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/admin/bulk-update - bulk update attributes by category
router.post('/bulk-update', async (req, res) => {
  const secret = req.query.secret;
  if (secret !== (config.webhookSecret || 'kpi-webhook-farq-2026')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { category, field, value } = req.body || {};
  if (!category || !field || value === undefined) {
    return res.status(400).json({ error: 'Missing required fields: category, field, value' });
  }

  // Whitelist of allowed fields for bulk update
  const allowedFields = [
    'is_free_entry', 'require_ticket', 'is_landmark', 'has_parking_lot',
    'valet_parking', 'drive_thru', 'wifi', 'is_wheelchair_accessible',
    'has_women_only_prayer_room', 'has_smoking_area', 'has_a_waiting_area',
    'dine_in', 'only_delivery', 'has_family_seating', 'reservation',
    'offers_iftar_menu', 'is_open_during_suhoor', 'provides_iftar_tent',
    'children_area', 'pickup_point_exists',
  ];

  if (!allowedFields.includes(field)) {
    return res.status(400).json({ error: `Field "${field}" is not allowed for bulk update` });
  }

  try {
    // Support matching multiple category variants (e.g. Mosque, Mosques)
    const categories = Array.isArray(category) ? category : [category];
    const placeholders = categories.map((_, i) => `$${i + 2}`).join(', ');

    const result = await pool.query(
      `UPDATE survey_responses SET ${field} = $1, updated_at = NOW() WHERE category IN (${placeholders})`,
      [value, ...categories]
    );

    res.json({
      success: true,
      field,
      value,
      categories,
      updatedCount: result.rowCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
