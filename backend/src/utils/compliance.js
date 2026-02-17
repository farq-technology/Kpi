const { getComplianceFieldsForCategory } = require('../config/field-mappings');
const { isFilled } = require('./field-normalization');

/**
 * Calculate compliance score based on category-specific fields.
 *
 * - compliance_score = percentage of APPLICABLE fields filled (category-aware)
 * - missingFields    = list of MANDATORY fields that are empty
 * - isComplete       = true only when ALL mandatory fields for this category are filled
 *
 * @param {Object}  record     - Object with local DB column names as keys
 * @param {Object}  [options]
 * @param {string}  [options.category]   - Category code (used to filter applicable fields)
 * @param {number}  [options.mediaCount] - Number of media attachments for this response
 * @returns {{ score: number, isComplete: boolean, totalFields: number, filledFields: number, missingFields: string[] }}
 */
function calculateCompliance(record, options = {}) {
  const category = options.category || record.category || '';
  const mediaCount = options.mediaCount ?? null;

  const applicableFields = getComplianceFieldsForCategory(category);

  let totalFields = 0;
  let filledFields = 0;
  const missingFields = [];

  for (const field of applicableFields) {
    // Skip media fields when no media info is available
    if (field.type === 'media' && mediaCount === null) continue;

    totalFields++;

    let filled = false;

    if (field.type === 'coordinates') {
      // Coordinates: both latitude and longitude must be present
      filled = isFilled(record.latitude) && isFilled(record.longitude);
    } else if (field.type === 'media') {
      // Media: check based on mediaCount
      if (field.local === '_business_exterior') {
        filled = mediaCount >= 1;
      } else if (field.local === '_business_interior') {
        filled = mediaCount >= 2;
      }
    } else {
      // Regular data field
      // Handle entrance_description / entrance_location column mismatch
      if (field.local === 'entrance_description') {
        filled = isFilled(record.entrance_description) || isFilled(record.entrance_location);
      } else {
        filled = isFilled(record[field.local]);
      }
    }

    if (filled) {
      filledFields++;
    } else if (field.mandatory) {
      missingFields.push(field.local);
    }
  }

  const score = totalFields === 0 ? 0 : Number(((filledFields / totalFields) * 100).toFixed(2));
  const isComplete = missingFields.length === 0;

  return { score, isComplete, totalFields, filledFields, missingFields };
}

module.exports = { calculateCompliance };
