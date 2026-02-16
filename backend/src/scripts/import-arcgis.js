/**
 * Bulk import all features from ArcGIS Feature Service into PostgreSQL
 * Run: node backend/src/scripts/import-arcgis.js
 */
const { Pool } = require('pg');
const axios = require('axios');
const crypto = require('crypto');

// Config
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://kpi_user:FRJSgd4gX61PiQz1KmVM1CN5fiIr3F3m@dpg-d69mnma48b3s73b94f4g.oregon-postgres.render.com:5432/kpi_dashboard_8jfh';
const ARCGIS_SERVICE_URL = 'https://services5.arcgis.com/pYlVm2T6SvR7ytZv/arcgis/rest/services/service_36f94509389d4a85a311cc6aa9c7398e_form/FeatureServer/0';
const ARCGIS_USERNAME = 'nagadco0000';
const ARCGIS_PASSWORD = 'Nagad$1390';
const BATCH_SIZE = 2000;

const REQUIRED_FIELDS = [
  'name_ar', 'name_en', 'category', 'phone_number',
  'working_days', 'working_hours_each_day', 'company_status',
];

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
});

let arcgisToken = null;
let tokenExpiry = 0;

async function getToken() {
  if (arcgisToken && Date.now() < tokenExpiry) return arcgisToken;
  const resp = await axios.post('https://www.arcgis.com/sharing/rest/generateToken', new URLSearchParams({
    username: ARCGIS_USERNAME,
    password: ARCGIS_PASSWORD,
    referer: 'https://www.arcgis.com',
    f: 'json',
  }), { timeout: 15000 });
  if (resp.data.error) throw new Error(resp.data.error.message);
  arcgisToken = resp.data.token;
  tokenExpiry = resp.data.expires - 60000;
  return arcgisToken;
}

async function fetchBatch(offset) {
  const token = await getToken();
  const resp = await axios.post(`${ARCGIS_SERVICE_URL}/query`, new URLSearchParams({
    where: '1=1',
    outFields: '*',
    returnGeometry: true,
    resultOffset: offset,
    resultRecordCount: BATCH_SIZE,
    orderByFields: 'objectid ASC',
    f: 'json',
    token,
  }), { timeout: 60000 });
  return resp.data;
}

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

async function insertBatch(features) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const feat of features) {
      const attrs = feat.attributes || {};
      const geom = feat.geometry || {};

      const { score, missingFields, totalFields, filledFields } = calculateCompliance(attrs);
      const isComplete = missingFields.length === 0;

      const submittedAt = attrs.CreationDate
        ? new Date(attrs.CreationDate).toISOString()
        : new Date().toISOString();

      const lat = geom.y || attrs.latitude;
      const lon = geom.x || attrs.longitude;

      const responseId = crypto.randomUUID();

      await client.query(`
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
          $1, $2, $3,
          $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12, $13,
          $14, $15, $16, $17,
          $18, $19, $20,
          $21, $22, $23,
          $24, $25, $26, $27,
          $28, $29, $30, $31,
          $32, $33,
          $34, $35, $36, $37, $38,
          $39, $40, $41, $42
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
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  console.log('=== ArcGIS Bulk Import ===');
  console.log(`Database: ${DATABASE_URL.replace(/:[^:@]+@/, ':***@')}`);

  // Delete test record first
  await pool.query("DELETE FROM survey_responses WHERE arcgis_object_id = 99999");
  console.log('Cleaned up test records');

  // Get total count
  const token = await getToken();
  const countResp = await axios.get(`${ARCGIS_SERVICE_URL}/query`, {
    params: { where: '1=1', returnCountOnly: true, f: 'json', token },
    timeout: 15000,
  });
  const totalCount = countResp.data.count;
  console.log(`Total features in ArcGIS: ${totalCount}`);

  let offset = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  const startTime = Date.now();

  while (offset < totalCount) {
    try {
      const data = await fetchBatch(offset);
      const features = data.features || [];

      if (features.length === 0) {
        console.log(`No more features at offset ${offset}`);
        break;
      }

      await insertBatch(features);
      totalInserted += features.length;

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const pct = ((offset + features.length) / totalCount * 100).toFixed(1);
      console.log(`Batch ${Math.floor(offset / BATCH_SIZE) + 1}: imported ${features.length} (${totalInserted}/${totalCount} = ${pct}%) [${elapsed}s]`);

      offset += features.length;

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.error(`Error at offset ${offset}:`, err.message);
      // On conflict/duplicate errors, skip and continue
      if (err.message.includes('duplicate') || err.message.includes('conflict')) {
        offset += BATCH_SIZE;
        totalSkipped += BATCH_SIZE;
        continue;
      }
      // Retry once after a delay
      console.log('Retrying in 3 seconds...');
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  // Final stats
  const { rows: stats } = await pool.query(`
    SELECT
      COUNT(*) as total,
      COUNT(DISTINCT surveyor_username) as agents,
      COUNT(DISTINCT category) as categories,
      AVG(compliance_score) as avg_compliance,
      SUM(CASE WHEN is_complete THEN 1 ELSE 0 END) as complete,
      SUM(CASE WHEN NOT is_complete THEN 1 ELSE 0 END) as incomplete
    FROM survey_responses
  `);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n=== Import Complete ===');
  console.log(`Time: ${elapsed}s`);
  console.log(`Total inserted: ${totalInserted}`);
  console.log(`Skipped (duplicates): ${totalSkipped}`);
  console.log('Database stats:', stats[0]);

  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
