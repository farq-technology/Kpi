const { multiSelectFields } = require('../config/field-mappings');

const multiSelectSet = new Set(multiSelectFields);

/**
 * Check if a value is meaningfully filled.
 */
function isFilled(v) {
  if (v === null || v === undefined) return false;
  if (Array.isArray(v)) return v.length > 0;
  const s = String(v).trim();
  return s !== '' && s.toUpperCase() !== 'N/A';
}

/**
 * Normalize a multi-select field value.
 * Cleans: trims whitespace, removes empty entries, removes duplicates.
 * Returns '' for empty/null (ArcGIS-compatible) instead of null.
 *
 * @param {string|Array|null} value - Raw multi-select value
 * @returns {string} - Cleaned comma-separated value or ''
 */
function normalizeMultiSelect(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) value = value.join(',');
  const parts = String(value).split(',').map(s => s.trim()).filter(Boolean);
  const unique = [...new Set(parts)];
  return unique.join(',');
}

/**
 * Normalize a category code to lowercase.
 * Ensures consistency between frontend (may send Uppercase) and ArcGIS (lowercase codes).
 *
 * @param {string|null} value - Category code
 * @returns {string} - Lowercase trimmed code or ''
 */
function normalizeCategory(value) {
  if (!value) return '';
  return String(value).trim().toLowerCase();
}

/**
 * Check if a field is a multi-select field.
 * @param {string} fieldKey - Local DB column name
 * @returns {boolean}
 */
function isMultiSelectField(fieldKey) {
  return multiSelectSet.has(fieldKey);
}

/**
 * Normalize a value before storing, applying appropriate normalization
 * based on field type (multi-select, category, or passthrough).
 *
 * @param {string} fieldKey - Local DB column name
 * @param {*} value - The value to normalize
 * @returns {*} - Normalized value
 */
function normalizeFieldValue(fieldKey, value) {
  if (isMultiSelectField(fieldKey)) {
    return normalizeMultiSelect(value);
  }
  if (fieldKey === 'category') {
    return normalizeCategory(value);
  }
  return value;
}

module.exports = {
  isFilled,
  normalizeMultiSelect,
  normalizeCategory,
  isMultiSelectField,
  normalizeFieldValue,
};
