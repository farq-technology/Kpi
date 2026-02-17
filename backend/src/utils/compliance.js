const { getComplianceFieldsForCategory } = require('../config/field-mappings');
const { isFilled } = require('./field-normalization');

/**
 * Calculate weighted compliance score based on category-specific fields and SAR pricing.
 *
 * - compliance_score = (sum of SAR weights of filled fields / sum of SAR weights of all applicable fields) * 100
 * - missingFields    = list of MANDATORY fields that are empty
 * - isComplete       = true only when ALL mandatory fields for this category are filled
 * - earnedSAR        = total SAR value of filled fields
 * - applicableSAR    = total SAR value of all applicable fields
 *
 * @param {Object}  record     - Object with local DB column names as keys
 * @param {Object}  [options]
 * @param {string}  [options.category]    - Category code (used to filter applicable fields)
 * @param {number}  [options.imageCount]  - Number of image attachments for this response
 * @param {number}  [options.videoCount]  - Number of video attachments for this response
 * @param {number}  [options.mediaCount]  - Legacy: total media count (fallback if imageCount not provided)
 * @returns {{ score: number, isComplete: boolean, totalFields: number, filledFields: number, missingFields: string[], earnedSAR: number, applicableSAR: number }}
 */
function calculateCompliance(record, options = {}) {
  const category = options.category || record.category || '';
  const imageCount = options.imageCount ?? null;
  const videoCount = options.videoCount ?? null;
  const mediaCount = options.mediaCount ?? null;

  // Determine effective image count: use imageCount if available, else fallback to mediaCount
  const effectiveImageCount = imageCount !== null ? imageCount : mediaCount;

  const applicableFields = getComplianceFieldsForCategory(category);

  let totalFields = 0;
  let filledFields = 0;
  let earnedSAR = 0;
  let applicableSAR = 0;
  const missingFields = [];

  for (const field of applicableFields) {
    const weight = field.weight || 0;

    // Skip media fields when no media info is available
    if ((field.type === 'media_image' || field.type === 'media') && effectiveImageCount === null) continue;
    if (field.type === 'media_video' && videoCount === null && mediaCount === null) continue;

    totalFields++;
    applicableSAR += weight;

    let filled = false;

    if (field.type === 'coordinates') {
      // Coordinates: both latitude and longitude must be present
      filled = isFilled(record.latitude) && isFilled(record.longitude);
    } else if (field.type === 'media_image' || field.type === 'media') {
      // Image media checks
      if (field.local === '_business_exterior') {
        filled = effectiveImageCount >= 1;
      } else if (field.local === '_business_interior') {
        filled = effectiveImageCount >= 2;
      }
    } else if (field.type === 'media_video') {
      // Video media check
      if (field.local === '_interior_video') {
        filled = videoCount !== null ? videoCount >= 1 : false;
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
      earnedSAR += weight;
    } else if (field.mandatory) {
      missingFields.push(field.local);
    }
  }

  // Weighted score: percentage of earned SAR out of applicable SAR
  const score = applicableSAR === 0 ? 0 : Number(((earnedSAR / applicableSAR) * 100).toFixed(2));
  const isComplete = missingFields.length === 0;

  return { score, isComplete, totalFields, filledFields, missingFields, earnedSAR: Number(earnedSAR.toFixed(2)), applicableSAR: Number(applicableSAR.toFixed(2)) };
}

module.exports = { calculateCompliance };
