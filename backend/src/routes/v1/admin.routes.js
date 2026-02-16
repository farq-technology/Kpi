const express = require('express');
const router = express.Router();
const pool = require('../../db/pool');
const axios = require('axios');
const crypto = require('crypto');
const config = require('../../config/env');

const REQUIRED_FIELDS = [
  'name_ar', 'name_en', 'category', 'phone_number',
  'working_days', 'working_hours_each_day', 'company_status',
];

let importRunning = false;
let importProgress = { status: 'idle', imported: 0, total: 0, errors: 0 };

function calculateCompliance(attrs) {
  const skipFields = ['objectid', 'globalid', 'CreationDate', 'Creator', 'EditDate', 'Editor'];
  const allFields = Object.keys(attrs).filter(k => !skipFields.includes(k));
  const totalFields = allFields.length;
  let filledFields = 0;
  const missingFields = [];

  for (const field of REQUIRED_FIELDS) {
    if (!attrs[field] || attrs[field] === '') missingFields.push(field);
  }
  for (const field of allFields) {
    if (attrs[field] !== null && attrs[field] !== undefined && attrs[field] !== '') filledFields++;
  }

  const score = totalFields > 0 ? parseFloat(((filledFields / totalFields) * 100).toFixed(2)) : 0;
  return { score, missingFields, totalFields, filledFields };
}

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

async function runImport() {
  const BATCH_SIZE = 2000;
  const serviceUrl = config.arcgis.serviceUrl;

  // Get total count
  const token = await getToken();
  const countResp = await axios.get(`${serviceUrl}/query`, {
    params: { where: '1=1', returnCountOnly: true, f: 'json', token },
    timeout: 15000,
  });
  const totalCount = countResp.data.count;
  importProgress = { status: 'running', imported: 0, total: totalCount, errors: 0, startedAt: new Date().toISOString() };
  console.log(`[Import] Starting: ${totalCount} features`);

  // Clear existing data
  await pool.query('DELETE FROM media_attachments');
  await pool.query('DELETE FROM survey_responses');
  console.log('[Import] Cleared existing data');

  let offset = 0;

  while (offset < totalCount) {
    try {
      const tk = await getToken();
      const resp = await axios.post(`${serviceUrl}/query`, new URLSearchParams({
        where: '1=1',
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
        const { score, missingFields, totalFields, filledFields } = calculateCompliance(attrs);
        const isComplete = missingFields.length === 0;
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
            isComplete, missingFields, score, totalFields, filledFields,
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
  runImport()
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

module.exports = router;
