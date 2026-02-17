const { editableFieldMap, multiSelectFields } = require('../config/field-mappings');
const logger = require('../utils/logger');

const editableFields = new Set(Object.keys(editableFieldMap));
const multiSelectSet = new Set(multiSelectFields);

/**
 * Soft validation middleware for survey updates.
 * Logs warnings for unknown fields but does NOT block the request.
 * Strips unknown fields from req.body to prevent injection.
 */
function validateSurveyUpdate(req, res, next) {
  const body = req.body;
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ success: false, error: 'Request body must be a JSON object' });
  }

  const warnings = [];
  const cleaned = {};

  for (const [key, value] of Object.entries(body)) {
    // Allow latitude/longitude alongside editable fields
    if (editableFields.has(key) || key === 'latitude' || key === 'longitude') {
      cleaned[key] = value;
    } else {
      warnings.push(`Unknown field "${key}" ignored`);
    }
  }

  // Validate multi-select fields: should be string or array
  for (const field of multiSelectSet) {
    if (cleaned[field] !== undefined) {
      const val = cleaned[field];
      if (val !== null && typeof val !== 'string' && !Array.isArray(val)) {
        warnings.push(`Field "${field}" should be a string or array, got ${typeof val}`);
      }
    }
  }

  if (warnings.length > 0) {
    logger.warn('Survey update validation warnings', { id: req.params.id, warnings });
  }

  req.body = cleaned;
  req.validationWarnings = warnings;
  next();
}

module.exports = validateSurveyUpdate;
