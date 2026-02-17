/**
 * Single source of truth for field mappings between:
 * - Local DB column names
 * - ArcGIS Survey123 field names
 * - Required fields for compliance
 * - Multi-select field identifiers
 * - Compliance fields with category grouping
 */

const FIELD_DEFINITIONS = [
  // Basic info
  { local: 'poi_name_ar', arcgis: 'name_ar', required: true },
  { local: 'poi_name_en', arcgis: 'name_en', required: true },
  { local: 'legal_name', arcgis: 'legal_name' },
  { local: 'category', arcgis: 'category', required: true },
  { local: 'secondary_category', arcgis: 'secondary_category' },
  { local: 'company_status', arcgis: 'company_status', required: true },
  { local: 'status_notes', arcgis: 'status_notes' },
  { local: 'identity_correct', arcgis: 'identity_correct' },
  { local: 'identity_notes', arcgis: 'identity_notes' },
  { local: 'surveyor_username', arcgis: 'agent_name' },

  // Contact
  { local: 'phone_number', arcgis: 'phone_number' },
  { local: 'website', arcgis: 'website' },
  { local: 'social_media', arcgis: 'social_media' },
  { local: 'language', arcgis: 'language', multiSelect: true },

  // Working info
  { local: 'working_days', arcgis: 'working_days', required: true },
  { local: 'working_hours', arcgis: 'working_hours_each_day', required: true },
  { local: 'break_time', arcgis: 'break_time_each_day' },
  { local: 'holidays', arcgis: 'holidays', multiSelect: true },
  { local: 'payment_methods', arcgis: 'accepted_payment_methods', multiSelect: true },
  { local: 'commercial_license', arcgis: 'commercial_license_number' },

  // Location
  { local: 'building_number', arcgis: 'building_number' },
  { local: 'floor_number', arcgis: 'floor_number' },
  { local: 'entrance_description', arcgis: 'entrance_description' },
  { local: 'is_landmark', arcgis: 'is_landmark' },
  { local: 'pickup_point_exists', arcgis: 'pickup_point_exists' },
  { local: 'pickup_description', arcgis: 'pickup_description' },

  // Menu
  { local: 'has_physical_menu', arcgis: 'has_physical_menu' },
  { local: 'has_digital_menu', arcgis: 'has_digital_menu' },
  { local: 'menu_barcode_url', arcgis: 'menu_barcode_url' },
  { local: 'cuisine', arcgis: 'cuisine' },

  // Dining services
  { local: 'dine_in', arcgis: 'dine_in' },
  { local: 'only_delivery', arcgis: 'only_delivery' },
  { local: 'drive_thru', arcgis: 'drive_thru' },
  { local: 'order_from_car', arcgis: 'order_from_car' },
  { local: 'has_family_seating', arcgis: 'has_family_seating' },
  { local: 'has_separate_rooms_for_dining', arcgis: 'has_separate_rooms_for_dining' },
  { local: 'large_groups_can_be_seated', arcgis: 'large_groups_can_be_seated' },
  { local: 'reservation', arcgis: 'reservation' },

  // Facilities
  { local: 'has_parking_lot', arcgis: 'has_parking_lot' },
  { local: 'valet_parking', arcgis: 'valet_parking' },
  { local: 'wifi', arcgis: 'wifi' },
  { local: 'is_wheelchair_accessible', arcgis: 'is_wheelchair_accessible' },
  { local: 'has_smoking_area', arcgis: 'has_smoking_area' },
  { local: 'has_a_waiting_area', arcgis: 'has_a_waiting_area' },
  { local: 'has_women_only_prayer_room', arcgis: 'has_women_only_prayer_room' },
  { local: 'children_area', arcgis: 'children_area' },

  // Entertainment
  { local: 'music', arcgis: 'music' },
  { local: 'live_sport_broadcasting', arcgis: 'live_sport_broadcasting' },
  { local: 'shisha', arcgis: 'shisha' },

  // Ramadan
  { local: 'offers_iftar_menu', arcgis: 'offers_iftar_menu' },
  { local: 'is_open_during_suhoor', arcgis: 'is_open_during_suhoor' },
  { local: 'provides_iftar_tent', arcgis: 'provides_iftar_tent' },

  // Access
  { local: 'require_ticket', arcgis: 'require_ticket' },
  { local: 'is_free_entry', arcgis: 'is_free_entry' },

  // Notes
  { local: 'general_notes', arcgis: 'general_notes' },
];

// ─── Category groups for compliance ────────────────────────────────────
const RESTAURANT_CAFE_CODES = new Set([
  'restaurant', 'restaurants', 'cafe', 'bakery',
]);
const ATTRACTION_LANDMARK_CODES = new Set([
  'park', 'entertainment', 'culture_art', 'travel',
]);
const MOSQUE_CODES = new Set(['mosque']);

/**
 * Determine which category group a category code belongs to.
 * @param {string} categoryCode - lowercase category code
 * @returns {'restaurants_cafes'|'attraction_landmark'|'mosque'|'other'}
 */
function getCategoryGroup(categoryCode) {
  if (!categoryCode) return 'other';
  const code = String(categoryCode).trim().toLowerCase();
  if (RESTAURANT_CAFE_CODES.has(code)) return 'restaurants_cafes';
  if (ATTRACTION_LANDMARK_CODES.has(code)) return 'attraction_landmark';
  if (MOSQUE_CODES.has(code)) return 'mosque';
  return 'other';
}

// ─── Compliance fields with SAR pricing (weighted compliance score) ──────
// categories: ['all'] = applies to every category
// categories: ['restaurants_cafes'] = only for restaurant/cafe types
// mandatory: true = marked with (O) in the spec
// type: 'coordinates' = checks latitude + longitude together
// type: 'media_image' = checks image attachment count
// type: 'media_video' = checks video attachment count
// weight: SAR value for this field (used in weighted compliance calculation)
// Total SAR across all fields for a fully-completed restaurant survey: 52.2 SAR
const COMPLIANCE_FIELDS = [
  // ── Group 1: Identity (11.24 SAR) ──
  { local: 'poi_name_ar',        mandatory: true,  categories: ['all'], weight: 1.79 },
  { local: 'poi_name_en',        mandatory: true,  categories: ['all'], weight: 1.79 },
  { local: 'legal_name',         mandatory: true,  categories: ['all'], weight: 1.80 },
  { local: 'category',           mandatory: true,  categories: ['all'], weight: 1.79 },
  { local: 'secondary_category', mandatory: true,  categories: ['all'], weight: 1.78 },
  { local: 'company_status',     mandatory: true,  categories: ['all'], weight: 1.79 },
  { local: 'commercial_license', mandatory: false,  categories: ['all'], weight: 0.50 },

  // ── Group 2: Location (7.18 SAR) ──
  { local: '_coordinates',        mandatory: true,  categories: ['all'], weight: 1.79, type: 'coordinates' },
  { local: 'entrance_description', mandatory: true, categories: ['all'], weight: 1.79 },
  { local: 'building_number',    mandatory: false,  categories: ['all'], weight: 0.50 },
  { local: 'floor_number',       mandatory: false,  categories: ['all'], weight: 0.50 },
  { local: 'phone_number',       mandatory: false,  categories: ['all'], weight: 0.50 },
  { local: 'website',            mandatory: false,  categories: ['all'], weight: 0.50 },
  { local: 'social_media',       mandatory: false,  categories: ['all'], weight: 0.50 },
  { local: 'language',           mandatory: false,  categories: ['all'], weight: 0.37 },
  { local: 'is_landmark',        mandatory: false,  categories: ['attraction_landmark'], weight: 0.37 },
  { local: 'pickup_point_exists', mandatory: false, categories: ['all'], weight: 0.36 },

  // ── Group 3: Operations (5.30 SAR) ──
  { local: 'working_days',       mandatory: true,  categories: ['all'], weight: 1.33 },
  { local: 'working_hours',      mandatory: true,  categories: ['all'], weight: 1.33 },
  { local: 'break_time',         mandatory: true,  categories: ['all'], weight: 1.33 },
  { local: 'holidays',           mandatory: true,  categories: ['all'], weight: 1.31 },

  // ── Group 4: Visual Media (24.08 SAR) ──
  { local: '_business_exterior', mandatory: true,  categories: ['all'], weight: 1.79, type: 'media_image' },
  { local: '_business_interior', mandatory: true,  categories: ['all'], weight: 1.79, type: 'media_image' },
  { local: '_interior_video',    mandatory: false,  categories: ['all'], weight: 15.00, type: 'media_video' },
  { local: 'has_physical_menu',  mandatory: false,  categories: ['all'], weight: 3.50 },
  { local: 'menu_barcode_url',   mandatory: false,  categories: ['restaurants_cafes'], weight: 1.50 },
  { local: 'cuisine',            mandatory: false,  categories: ['restaurants_cafes'], weight: 0.50 },

  // ── Group 5: Facilities (3.20 SAR) ──
  { local: 'payment_methods',    mandatory: false,  categories: ['all'], weight: 0.50 },
  { local: 'has_parking_lot',    mandatory: false,  categories: ['all'], weight: 0.25 },
  { local: 'valet_parking',      mandatory: false,  categories: ['all'], weight: 0.25 },
  { local: 'is_wheelchair_accessible', mandatory: false, categories: ['all'], weight: 0.20 },
  { local: 'wifi',               mandatory: false,  categories: ['all'], weight: 0.20 },
  { local: 'dine_in',            mandatory: false,  categories: ['restaurants_cafes'], weight: 0.20 },
  { local: 'has_family_seating', mandatory: false,  categories: ['restaurants_cafes'], weight: 0.20 },
  { local: 'large_groups_can_be_seated', mandatory: false, categories: ['restaurants_cafes'], weight: 0.20 },
  { local: 'has_separate_rooms_for_dining', mandatory: false, categories: ['restaurants_cafes'], weight: 0.20 },
  { local: 'music',              mandatory: false,  categories: ['restaurants_cafes'], weight: 0.20 },
  { local: 'live_sport_broadcasting', mandatory: false, categories: ['restaurants_cafes'], weight: 0.20 },
  { local: 'has_smoking_area',   mandatory: false,  categories: ['restaurants_cafes'], weight: 0.20 },
  { local: 'has_a_waiting_area', mandatory: false,  categories: ['restaurants_cafes'], weight: 0.20 },
  { local: 'shisha',             mandatory: false,  categories: ['restaurants_cafes'], weight: 0.20 },

  // ── Group 6: Specialized (1.20 SAR) ──
  { local: 'has_women_only_prayer_room', mandatory: false, categories: ['mosque'], weight: 0.40 },
  { local: 'offers_iftar_menu',  mandatory: false,  categories: ['restaurants_cafes'], weight: 0.27 },
  { local: 'is_open_during_suhoor', mandatory: false, categories: ['restaurants_cafes'], weight: 0.27 },
  { local: 'provides_iftar_tent', mandatory: false,  categories: ['mosque'], weight: 0.26 },
];

/**
 * Get the compliance fields applicable to a given category.
 * @param {string} categoryCode - lowercase category code
 * @returns {Array} filtered COMPLIANCE_FIELDS
 */
function getComplianceFieldsForCategory(categoryCode) {
  const group = getCategoryGroup(categoryCode);
  return COMPLIANCE_FIELDS.filter(f =>
    f.categories.includes('all') || f.categories.includes(group)
  );
}

// Derived maps (from FIELD_DEFINITIONS – used for ArcGIS sync, not compliance)
const localToArcgisMap = {};
const arcgisToLocalMap = {};
const requiredFields = [];
const multiSelectFields = [];
const allLocalFields = [];
const editableFieldMap = {};

for (const def of FIELD_DEFINITIONS) {
  localToArcgisMap[def.local] = def.arcgis;
  arcgisToLocalMap[def.arcgis] = def.local;
  allLocalFields.push(def.local);
  editableFieldMap[def.local] = def.local;
  if (def.required) requiredFields.push(def.local);
  if (def.multiSelect) multiSelectFields.push(def.local);
}

// Required fields in ArcGIS naming (for webhook/admin compatibility)
const requiredFieldsArcgis = requiredFields.map(f => localToArcgisMap[f]);

module.exports = {
  FIELD_DEFINITIONS,
  COMPLIANCE_FIELDS,
  localToArcgisMap,
  arcgisToLocalMap,
  requiredFields,
  requiredFieldsArcgis,
  multiSelectFields,
  allLocalFields,
  editableFieldMap,
  getCategoryGroup,
  getComplianceFieldsForCategory,
  RESTAURANT_CAFE_CODES,
  ATTRACTION_LANDMARK_CODES,
  MOSQUE_CODES,
};
