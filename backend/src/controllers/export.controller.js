const { v4: uuidv4 } = require('uuid');
const pool = require('../db/pool');
const { calculateCompliance } = require('../utils/compliance');
const logger = require('../utils/logger');

// ─── Contract Constants ────────────────────────────────────────────────────
const PILOT_BUDGET_CAP = 50000;
const UNIT_PRICE_POI = 52.2;
const VIDEO_COST = 15.0;
const SAMPLING_RATE = 0.30;
const KPI_ACCEPT = 95;
const KPI_CORRECT = 90;
const COORD_TOLERANCE_M = 30;

// KSA bounds
const KSA_LAT = [15.0, 32.5];
const KSA_LON = [34.0, 56.0];

// Boolean field mapping (local DB → NAVER schema)
const BOOL_MAP = {
  drive_thru: 'drive_thru',
  dine_in: 'dine_in',
  only_delivery: 'only_delivery',
  reservation: 'reservation_available',
  require_ticket: 'require_ticket',
  order_from_car: 'order_from_car',
  pickup_point_exists: 'pickup_point_exists',
  wifi: 'wifi',
  music: 'music',
  valet_parking: 'valet_parking',
  has_parking_lot: 'has_parking_lot',
  is_wheelchair_accessible: 'wheelchair_accessible',
  has_family_seating: 'family_seating',
  has_a_waiting_area: 'waiting_area',
  has_separate_rooms_for_dining: 'private_rooms',
  has_smoking_area: 'smoking_area',
  children_area: 'children_area',
  shisha: 'shisha_available',
  live_sport_broadcasting: 'live_sports',
  is_landmark: 'is_landmark',
  large_groups_can_be_seated: 'large_groups',
  has_women_only_prayer_room: 'women_prayer_room',
  provides_iftar_tent: 'iftar_tent',
  offers_iftar_menu: 'iftar_menu',
  is_open_during_suhoor: 'open_suhoor',
  is_free_entry: 'free_entry',
};

function toBool(val) {
  if (val === null || val === undefined || val === '' || val === 'N/A') return null;
  const s = String(val).trim().toLowerCase();
  if (s === 'yes' || s === 'true' || s === '1') return true;
  if (s === 'no' || s === 'false' || s === '0') return false;
  return null;
}

function toArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return String(val).split(',').map(s => s.trim()).filter(Boolean);
}

function mapRowToNaver(row) {
  const attrs = row.attributes || {};
  const get = (key) => row[key] ?? attrs[key] ?? null;

  const poi = {
    global_id: row.global_id || uuidv4(),
    name_ar: get('poi_name_ar') || '',
    name_en: get('poi_name_en') || '',
    legal_name: get('legal_name') || null,
    category: (get('category') || '').toLowerCase(),
    secondary_category: get('secondary_category') || null,
    cuisine: get('cuisine') || null,
    company_status: (get('company_status') || 'open').toLowerCase(),
    commercial_license_number: get('commercial_license') || null,
    latitude: row.latitude ? parseFloat(row.latitude) : null,
    longitude: row.longitude ? parseFloat(row.longitude) : null,
    building_number: get('building_number') || null,
    floor_number: get('floor_number') || null,
    entrance_description: get('entrance_description') || null,
    google_map_url: row.latitude && row.longitude
      ? `https://maps.google.com/?q=${row.latitude},${row.longitude}`
      : null,
    phone_number: get('phone_number') || null,
    email: get('email') || attrs.email || null,
    website: get('website') || null,
    instagram: attrs.instagram || null,
    tiktok: attrs.tiktok || null,
    x_account: attrs.x_account || null,
    snapchat: attrs.snapchat || null,
    working_days: get('working_days') || null,
    working_hours: get('working_hours') || null,
    break_times: get('break_time') || null,
    holidays: toArray(get('holidays')),
    accepted_payment_methods: toArray(get('payment_methods')),
    languages_spoken: toArray(get('language')),
    exterior_image_url: null,
    interior_image_url: null,
    entrance_image_url: null,
    menu_image_url: null,
    walkthrough_video_url: null,
  };

  // Boolean fields
  for (const [localKey, naverKey] of Object.entries(BOOL_MAP)) {
    poi[naverKey] = toBool(get(localKey));
  }

  return poi;
}

function validatePoi(poi) {
  const errors = [];
  const required = ['global_id', 'name_ar', 'name_en', 'category', 'company_status', 'latitude', 'longitude', 'working_days', 'working_hours'];
  for (const f of required) {
    if (!poi[f] && poi[f] !== 0 && poi[f] !== false) {
      errors.push(`required_field_missing: ${f}`);
    }
  }
  if (poi.latitude !== null && (poi.latitude < KSA_LAT[0] || poi.latitude > KSA_LAT[1])) {
    errors.push('latitude_out_of_ksa_bounds');
  }
  if (poi.longitude !== null && (poi.longitude < KSA_LON[0] || poi.longitude > KSA_LON[1])) {
    errors.push('longitude_out_of_ksa_bounds');
  }
  if (poi.category && poi.category !== poi.category.toLowerCase()) {
    errors.push('category_not_lowercase');
  }
  return { is_valid: errors.length === 0, errors };
}

// ─── Export as NAVER JSON ───────────────────────────────────────────────────
async function exportNaverJson(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT *, attributes FROM survey_responses ORDER BY submitted_at DESC'
    );
    const pois = rows.map(mapRowToNaver);
    const results = pois.map(validatePoi);

    const valid = results.filter(r => r.is_valid).length;
    const total = pois.length;

    res.json({
      pois,
      _meta: {
        schema_version: '1.0',
        encoding: 'UTF-8',
        coordinate_system: 'WGS84',
        total_records: total,
        valid_records: valid,
        accuracy_pct: total ? Math.round((valid / total) * 10000) / 100 : 0,
        contract: 'NAVER Cloud Corporation Pilot Agreement',
        provider: 'Farq Technology Establishment',
        generated_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error('Export NAVER JSON failed:', err);
    res.status(500).json({ error: 'Export failed' });
  }
}

// ─── Export as CSV ──────────────────────────────────────────────────────────
async function exportNaverCsv(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT *, attributes FROM survey_responses ORDER BY submitted_at DESC'
    );
    const pois = rows.map(mapRowToNaver);

    const headers = Object.keys(pois[0] || {});
    const csvLines = [headers.join(',')];

    for (const poi of pois) {
      const values = headers.map(h => {
        let val = poi[h];
        if (val === null || val === undefined) return '';
        if (typeof val === 'boolean') return val.toString();
        if (Array.isArray(val)) val = val.join(',');
        if (typeof val === 'object') val = JSON.stringify(val);
        val = String(val);
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      });
      csvLines.push(values.join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="naver_poi_delivery_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('\uFEFF' + csvLines.join('\n')); // BOM for Excel UTF-8
  } catch (err) {
    logger.error('Export NAVER CSV failed:', err);
    res.status(500).json({ error: 'Export failed' });
  }
}

// ─── KPI Report ─────────────────────────────────────────────────────────────
async function getNaverKpiReport(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT *, attributes FROM survey_responses ORDER BY submitted_at DESC'
    );
    const pois = rows.map(mapRowToNaver);
    const results = pois.map((p, i) => ({ ...validatePoi(p), poi_id: p.global_id, index: i }));

    const total = results.length;
    const valid = results.filter(r => r.is_valid).length;
    const accuracy = total ? Math.round((valid / total) * 10000) / 100 : 0;

    // 30% sampling
    const sampleSize = Math.max(1, Math.ceil(total * SAMPLING_RATE));
    const shuffled = [...results].sort(() => Math.random() - 0.5);
    const sample = shuffled.slice(0, sampleSize);
    const validInSample = sample.filter(r => r.is_valid).length;
    const sampleAccuracy = sample.length ? Math.round((validInSample / sample.length) * 10000) / 100 : 0;

    let decision = 'REQUIRE_RESURVEY';
    if (sampleAccuracy >= KPI_ACCEPT) decision = 'ACCEPT';
    else if (sampleAccuracy >= KPI_CORRECT) decision = 'REQUIRE_CORRECTION';

    // Billing
    const poisWithVideo = pois.filter(p => p.walkthrough_video_url).length;
    const poiCost = total * UNIT_PRICE_POI;
    const videoCost = poisWithVideo * VIDEO_COST;
    const subtotal = poiCost + videoCost;

    // Error frequency
    const errorFreq = {};
    for (const r of results) {
      for (const e of r.errors) {
        const key = e.split(':')[0];
        errorFreq[key] = (errorFreq[key] || 0) + 1;
      }
    }

    res.json({
      report_title: 'NAVER POI KPI Report',
      contract: {
        client: 'NAVER Cloud Corporation',
        provider: 'Farq Technology Establishment',
        pilot_budget_cap_sar: PILOT_BUDGET_CAP,
        unit_price_poi_sar: UNIT_PRICE_POI,
      },
      delivery_summary: {
        total_pois_delivered: total,
        valid_pois: valid,
        invalid_pois: total - valid,
        overall_accuracy_pct: accuracy,
        delivery_date: new Date().toISOString().slice(0, 10),
      },
      qa_inspection: {
        sample_size: sample.length,
        sampling_rate_pct: SAMPLING_RATE * 100,
        valid_in_sample: validInSample,
        invalid_in_sample: sample.length - validInSample,
        sample_accuracy_pct: sampleAccuracy,
        decision,
      },
      error_summary: Object.entries(errorFreq)
        .sort((a, b) => b[1] - a[1])
        .map(([error, count]) => ({ error, count })),
      billing: {
        poi_cost_sar: Math.round(poiCost * 100) / 100,
        video_cost_sar: Math.round(videoCost * 100) / 100,
        total_cost_sar: Math.round(subtotal * 100) / 100,
        budget_cap_sar: PILOT_BUDGET_CAP,
        remaining_sar: Math.round((PILOT_BUDGET_CAP - subtotal) * 100) / 100,
        within_budget: subtotal <= PILOT_BUDGET_CAP,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('KPI report failed:', err);
    res.status(500).json({ error: 'KPI report generation failed' });
  }
}

// ─── Billing Summary ────────────────────────────────────────────────────────
async function getBillingSummary(req, res) {
  try {
    const { rows } = await pool.query('SELECT COUNT(*) as total FROM survey_responses');
    const total = parseInt(rows[0].total);

    const poiCost = total * UNIT_PRICE_POI;
    const videoCost = 0; // Videos tracked separately
    const subtotal = poiCost + videoCost;

    res.json({
      contract: {
        client: 'NAVER Cloud Corporation',
        provider: 'Farq Technology Establishment',
        pilot_budget_cap_sar: PILOT_BUDGET_CAP,
        unit_price_poi_sar: UNIT_PRICE_POI,
        video_surcharge_sar: VIDEO_COST,
      },
      delivery: {
        total_pois_delivered: total,
        max_pois_within_budget: Math.floor(PILOT_BUDGET_CAP / UNIT_PRICE_POI),
      },
      billing: {
        poi_cost_sar: Math.round(poiCost * 100) / 100,
        video_cost_sar: Math.round(videoCost * 100) / 100,
        subtotal_sar: Math.round(subtotal * 100) / 100,
        budget_cap_sar: PILOT_BUDGET_CAP,
        remaining_budget_sar: Math.round((PILOT_BUDGET_CAP - subtotal) * 100) / 100,
        over_budget: subtotal > PILOT_BUDGET_CAP,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Billing summary failed:', err);
    res.status(500).json({ error: 'Billing summary failed' });
  }
}

// ─── Validation Report ──────────────────────────────────────────────────────
async function getValidationReport(req, res) {
  try {
    const { rows } = await pool.query(
      'SELECT *, attributes FROM survey_responses ORDER BY submitted_at DESC'
    );
    const pois = rows.map(mapRowToNaver);
    const results = pois.map((p, i) => {
      const v = validatePoi(p);
      // Completeness
      const allFields = Object.keys(p);
      const filled = allFields.filter(k => {
        const val = p[k];
        return val !== null && val !== undefined && val !== '' && !(Array.isArray(val) && val.length === 0);
      }).length;
      return {
        poi_id: p.global_id,
        name_en: p.name_en,
        name_ar: p.name_ar,
        is_valid: v.is_valid,
        errors: v.errors,
        completeness_pct: Math.round((filled / allFields.length) * 10000) / 100,
        filled_fields: filled,
        total_fields: allFields.length,
      };
    });

    const total = results.length;
    const valid = results.filter(r => r.is_valid).length;
    const avgComp = total ? Math.round(results.reduce((s, r) => s + r.completeness_pct, 0) / total * 100) / 100 : 0;

    res.json({
      report_title: 'NAVER POI Validation Report',
      summary: {
        total_pois: total,
        valid_pois: valid,
        invalid_pois: total - valid,
        accuracy_pct: total ? Math.round((valid / total) * 10000) / 100 : 0,
        avg_completeness_pct: avgComp,
      },
      records: results,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Validation report failed:', err);
    res.status(500).json({ error: 'Validation report failed' });
  }
}

module.exports = {
  exportNaverJson,
  exportNaverCsv,
  getNaverKpiReport,
  getBillingSummary,
  getValidationReport,
};
