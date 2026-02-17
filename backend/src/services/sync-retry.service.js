const cron = require('node-cron');
const crypto = require('crypto');
const pool = require('../db/pool');
const arcgisService = require('./arcgis.service');
const { localToArcgisMap } = require('../config/field-mappings');
const { normalizeFieldValue } = require('../utils/field-normalization');
const logger = require('../utils/logger');

const MAX_RETRIES_PER_RUN = 20;

async function retryPendingSyncs() {
  try {
    const { rows } = await pool.query(
      `SELECT id, arcgis_object_id, arcgis_global_id, attributes
       FROM survey_responses
       WHERE sync_pending = 1
       ORDER BY last_sync_attempt ASC NULLS FIRST
       LIMIT $1`,
      [MAX_RETRIES_PER_RUN]
    );

    if (rows.length === 0) return;
    logger.info('SyncRetry: retrying pending syncs', { count: rows.length });

    for (const row of rows) {
      try {
        let objectId = row.arcgis_object_id;
        const globalId = row.arcgis_global_id;

        if (!objectId && globalId) {
          const queryResult = await arcgisService.queryFeatures({
            where: `globalid='${globalId}'`,
            outFields: 'objectid',
            returnGeometry: false,
          });
          if (queryResult.features && queryResult.features.length > 0) {
            objectId = queryResult.features[0].attributes.objectid;
            await pool.query('UPDATE survey_responses SET arcgis_object_id = $1 WHERE id = $2', [objectId, row.id]);
          }
        }

        if (!objectId) {
          logger.warn('SyncRetry: skipping, no objectId found', { id: row.id });
          continue;
        }

        // Build ArcGIS attributes from current DB record
        const { rows: current } = await pool.query('SELECT * FROM survey_responses WHERE id = $1', [row.id]);
        if (current.length === 0) continue;
        const record = current[0];

        const arcgisAttrs = { objectid: objectId };
        for (const [localField, arcgisField] of Object.entries(localToArcgisMap)) {
          if (record[localField] !== null && record[localField] !== undefined) {
            arcgisAttrs[arcgisField] = normalizeFieldValue(localField, record[localField]);
          }
        }

        const feature = { attributes: arcgisAttrs };
        if (record.latitude && record.longitude) {
          feature.geometry = {
            x: parseFloat(record.longitude),
            y: parseFloat(record.latitude),
            spatialReference: { wkid: 4326 },
          };
        }

        await arcgisService.applyEdits([feature]);

        // Mark as synced
        await pool.query(
          `UPDATE survey_responses SET sync_pending = 0, last_synced_at = NOW(), last_sync_error = NULL WHERE id = $1`,
          [row.id]
        );
        await pool.query(
          `INSERT INTO sync_audit_log (id, response_id, direction, status) VALUES ($1, $2, 'outgoing', 'retry_success')`,
          [crypto.randomUUID(), row.id]
        );
        logger.info('SyncRetry: success', { id: row.id });
      } catch (err) {
        logger.error('SyncRetry: failed', { id: row.id, error: err.message });
        await pool.query(
          `UPDATE survey_responses SET last_sync_attempt = NOW(), last_sync_error = $1 WHERE id = $2`,
          [err.message, row.id]
        ).catch(() => {});
      }
    }
  } catch (err) {
    logger.error('SyncRetry: error', { error: err.message });
  }
}

function start() {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', retryPendingSyncs);
  logger.info('SyncRetry: scheduled every 5 minutes');
}

module.exports = { start, retryPendingSyncs };
