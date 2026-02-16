const database = require('../../config/database');
const crypto = require('crypto');

const sampleResponses = [
  { poi_name_ar: 'مطعم الريف', poi_name_en: 'Al Reef Restaurant', category: 'restaurants', secondary_category: 'Restaurant', company_status: 'open', phone_number: '+966501234567', surveyor_username: 'ahmad_shuban', agent_id: 'AG001', lat: 24.7762, lng: 46.6661, compliance: 92.5 },
  { poi_name_ar: 'صيدلية الدواء', poi_name_en: 'Al Dawaa Pharmacy', category: 'Healthcare', secondary_category: 'Pharmacy', company_status: 'open', phone_number: '+966509876543', surveyor_username: 'mohammed_ali', agent_id: 'AG002', lat: 24.7200, lng: 46.6900, compliance: 87.3 },
  { poi_name_ar: 'مركز جرير', poi_name_en: 'Jarir Bookstore', category: 'Retail', secondary_category: 'Electronics', company_status: 'open', phone_number: '+966502345678', surveyor_username: 'ahmad_shuban', agent_id: 'AG001', lat: 24.6900, lng: 46.7100, compliance: 95.0 },
  { poi_name_ar: 'مقهى الطحاوي', poi_name_en: 'Al Tahawi Cafe', category: 'restaurants', secondary_category: 'Cafe', company_status: 'open', phone_number: '+966503456789', surveyor_username: 'khalid_omar', agent_id: 'AG003', lat: 24.7500, lng: 46.6500, compliance: 78.5 },
  { poi_name_ar: 'مستشفى المملكة', poi_name_en: 'Kingdom Hospital', category: 'Healthcare', secondary_category: 'Hospital', company_status: 'open', phone_number: '+966504567890', surveyor_username: 'mohammed_ali', agent_id: 'AG002', lat: 24.7300, lng: 46.6800, compliance: 100.0 },
  { poi_name_ar: 'هايبر بنده', poi_name_en: 'HyperPanda', category: 'Retail', secondary_category: 'Supermarket', company_status: 'open', phone_number: '+966505678901', surveyor_username: 'khalid_omar', agent_id: 'AG003', lat: 24.7100, lng: 46.7200, compliance: 88.0 },
  { poi_name_ar: 'مطعم البيك', poi_name_en: 'Al Baik Restaurant', category: 'restaurants', secondary_category: 'Fast Food', company_status: 'open', phone_number: '+966506789012', surveyor_username: 'ahmad_shuban', agent_id: 'AG001', lat: 24.7400, lng: 46.6400, compliance: 96.0 },
  { poi_name_ar: 'محل ملابس زارا', poi_name_en: 'Zara Store', category: 'Retail', secondary_category: 'Clothing', company_status: 'closed', phone_number: '+966507890123', surveyor_username: 'mohammed_ali', agent_id: 'AG002', lat: 24.7600, lng: 46.6300, compliance: 65.0 },
];

async function seed() {
  // Insert survey form
  const surveyId = crypto.randomUUID();
  await database.query(
    `INSERT INTO surveys (id, form_item_id, form_title, service_url) VALUES (?, 'default_form', 'POI Field Survey', 'https://services5.arcgis.com/pYlVm2T6SvR7ytZv/arcgis/rest/services/service_36f94509389d4a85a311cc6aa9c7398e_form/FeatureServer/0')`,
    [surveyId]
  );

  // Insert sample responses with varying dates
  for (let i = 0; i < sampleResponses.length; i++) {
    const r = sampleResponses[i];
    const id = crypto.randomUUID();
    const globalId = crypto.randomUUID();
    const daysAgo = Math.floor(Math.random() * 14);
    const submittedAt = new Date(Date.now() - daysAgo * 86400000).toISOString();

    await database.query(
      `INSERT INTO survey_responses (
        id, survey_id, arcgis_object_id, arcgis_global_id,
        surveyor_username, agent_id,
        poi_name_ar, poi_name_en, category, secondary_category,
        company_status, phone_number,
        latitude, longitude,
        is_complete, compliance_score,
        event_type, submitted_at, attributes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, surveyId, 100 + i, globalId,
        r.surveyor_username, r.agent_id,
        r.poi_name_ar, r.poi_name_en, r.category, r.secondary_category,
        r.company_status, r.phone_number,
        r.lat, r.lng,
        1, r.compliance,
        'addData', submittedAt, '{}',
      ]
    );
  }

  console.log(`Seeded ${sampleResponses.length} sample survey responses.`);
  await database.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
