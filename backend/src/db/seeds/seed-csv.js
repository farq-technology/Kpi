const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const database = require('../../config/database');

function* parseCSVGenerator(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
      if (currentRow.length > 1) yield currentRow;
      currentRow = [];
      if (ch === '\r' && text[i + 1] === '\n') i++;
    } else {
      currentField += ch;
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.length > 1) yield currentRow;
  }
}

const REQUIRED_FIELDS_IDX = {};

async function seed() {
  const csvPath = process.argv[2] || path.join('C:', 'Users', 'abdul', 'Downloads', 'Final Data - phase10.csv');

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  console.log(`Reading CSV: ${csvPath}`);
  const csvText = fs.readFileSync(csvPath, 'utf8');

  const gen = parseCSVGenerator(csvText);
  const headerRow = gen.next().value;

  if (!headerRow) {
    console.error('Empty CSV file');
    process.exit(1);
  }

  // Build header index
  const h = {};
  headerRow.forEach((col, i) => { h[col.trim()] = i; });

  console.log(`CSV headers (${headerRow.length} columns): ${headerRow.slice(0, 5).join(', ')}...`);

  // Clear existing data
  await database.query('DELETE FROM media_attachments');
  await database.query('DELETE FROM survey_responses');
  await database.query('DELETE FROM surveys');

  // Create survey form
  const surveyId = crypto.randomUUID();
  await database.query(
    `INSERT INTO surveys (id, form_item_id, form_title, service_url) VALUES (?, ?, ?, ?)`,
    [surveyId, 'phase10_survey', 'POI Field Survey - Phase 10',
     'https://services5.arcgis.com/pYlVm2T6SvR7ytZv/arcgis/rest/services/service_36f94509389d4a85a311cc6aa9c7398e_form/FeatureServer/0']
  );

  let count = 0;
  let errors = 0;

  for (const row of gen) {
    try {
      const get = (col) => {
        const idx = h[col];
        return idx !== undefined && row[idx] ? row[idx].trim() : null;
      };

      const globalId = get('GlobalID') || crypto.randomUUID();
      const nameAr = get('Name (Arabic)');
      const nameEn = get('Name (English)');
      const category = get('Category');
      const secondaryCategory = get('Secondary Category') || get('Detail Category');
      const status = get('Company Status');
      const agentName = get('Agent Name');
      const phone = get('Phone Number');
      const website = get('Website');
      const socialMedia = get('Social Media Accounts');
      const workingDays = get('Working Days');
      const workingHours = get('Working Hours');
      const breakTime = get('Break Time');
      const holidays = get('Holidays');
      const language = get('Language');
      const payment = get('Accepted Payment Methods');
      const license = get('Commercial License Number');
      const building = get('Building Number');
      const floor = get('Floor Number');
      const entrance = get('Entrance Location');
      const lat = parseFloat(get('Coordinates Y')) || null;
      const lng = parseFloat(get('Coordinates X')) || null;
      const dineIn = get('Dine In');
      const familySeating = get('Family Seating');
      const parking = get('Has Parking Lot');
      const wifi = get('WiFi');
      const wheelchair = get('Wheelchair Accessible');
      const cuisine = get('Cuisine Type');
      const iftar = get('Iftar Menu');
      const suhoor = get('Suhoor');
      const district = get('District (English)');
      const city = get('City');
      const poiId = get('POI ID');
      const surveyDate = get('Survey Date');
      const notes = get('Notes');
      const address = get('Address');

      // Calculate compliance
      const requiredFields = [nameAr, nameEn, category, phone, workingDays, workingHours, status];
      const filled = requiredFields.filter(f => f && f !== '').length;
      const allFieldValues = [nameAr, nameEn, category, secondaryCategory, status, phone, website, socialMedia,
        workingDays, workingHours, breakTime, holidays, language, payment, license, building, floor, entrance,
        dineIn, familySeating, parking, wifi, wheelchair, cuisine, iftar, suhoor];
      const totalFields = allFieldValues.length;
      const filledFields = allFieldValues.filter(f => f && f !== '' && f !== 'N/A').length;
      const compliance = totalFields > 0 ? parseFloat(((filledFields / totalFields) * 100).toFixed(2)) : 0;
      const isComplete = filled === requiredFields.length ? 1 : 0;

      const id = crypto.randomUUID();
      const submittedAt = surveyDate ? new Date(surveyDate).toISOString() : new Date().toISOString();

      await database.query(
        `INSERT INTO survey_responses (
          id, survey_id, arcgis_global_id,
          surveyor_username, agent_id,
          poi_name_ar, poi_name_en, category, secondary_category,
          company_status, phone_number, website, social_media,
          working_days, working_hours, break_time, holidays,
          language, payment_methods, commercial_license,
          building_number, floor_number, entrance_location,
          dine_in, has_family_seating, has_parking_lot, wifi,
          is_wheelchair_accessible, cuisine, offers_iftar_menu, is_open_during_suhoor,
          latitude, longitude,
          is_complete, compliance_score, total_fields, filled_fields,
          event_type, submitted_at, attributes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, surveyId, globalId,
          agentName, poiId,
          nameAr, nameEn, category, secondaryCategory,
          status, phone, website, socialMedia,
          workingDays, workingHours, breakTime, holidays,
          language, payment, license,
          building, floor, entrance,
          dineIn, familySeating, parking, wifi,
          wheelchair, cuisine, iftar, suhoor,
          lat, lng,
          isComplete, compliance, totalFields, filledFields,
          'addData', submittedAt,
          JSON.stringify({ district, city, poiId, notes, address }),
        ]
      );

      count++;
      if (count % 50 === 0) console.log(`  Inserted ${count} records...`);
    } catch (err) {
      errors++;
      if (errors <= 3) console.error(`  Row error:`, err.message);
    }
  }

  console.log(`\nSeed complete: ${count} records inserted, ${errors} errors.`);
  await database.end();
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
