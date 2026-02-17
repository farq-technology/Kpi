const crypto = require('crypto');
const pool = require('../db/pool');
const arcgisService = require('../services/arcgis.service');
const realtimeService = require('../services/realtime.service');
const { editableFieldMap, localToArcgisMap } = require('../config/field-mappings');
const { calculateCompliance } = require('../utils/compliance');
const { normalizeFieldValue } = require('../utils/field-normalization');
const logger = require('../utils/logger');

async function listSurveys(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const category = req.query.category || '';
    const agent = req.query.agent || '';
    const needsReview = req.query.needsReview === 'true';
    const sort = req.query.sort || '';
    const dateFrom = req.query.dateFrom || '';
    const dateTo = req.query.dateTo || '';

    let where = 'WHERE 1=1';
    const params = [];

    if (dateFrom) {
      params.push(dateFrom);
      where += ` AND submitted_at >= $${params.length}`;
    }
    if (dateTo) {
      params.push(dateTo);
      where += ` AND submitted_at <= $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (poi_name_ar ILIKE $${params.length} OR poi_name_en ILIKE $${params.length} OR surveyor_username ILIKE $${params.length})`;
    }
    if (category) {
      params.push(category);
      where += ` AND category = $${params.length}`;
    }
    if (agent) {
      params.push(agent);
      where += ` AND surveyor_username = $${params.length}`;
    }
    if (needsReview) {
      where += ` AND (compliance_score < 80 OR compliance_score IS NULL OR NOT is_complete)`;
    }

    const countQuery = `SELECT COUNT(*) FROM survey_responses ${where}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    const orderBy = sort === 'compliance'
      ? 'ORDER BY compliance_score ASC NULLS FIRST, submitted_at DESC NULLS LAST'
      : 'ORDER BY submitted_at DESC NULLS LAST';

    params.push(limit, offset);
    const dataQuery = `
      SELECT
        id, arcgis_object_id, arcgis_global_id,
        surveyor_username, poi_name_ar, poi_name_en,
        category, secondary_category, company_status,
        phone_number, website,
        working_days, working_hours, break_time, holidays,
        latitude, longitude,
        is_complete, compliance_score,
        missing_fields,
        review_status, reviewed_by, reviewed_at, review_notes,
        event_type, submitted_at, created_at
      FROM survey_responses
      ${where}
      ${orderBy}
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const { rows } = await pool.query(dataQuery, params);

    res.json({
      success: true,
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    logger.error('List surveys error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to fetch surveys' });
  }
}

async function getSurveyById(req, res) {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT * FROM survey_responses WHERE id = $1`, [id]
    );

    // Fetch media separately
    if (rows.length > 0) {
      const { rows: mediaRows } = await pool.query(
        `SELECT id, file_name AS fileName, content_type AS contentType,
                media_category AS mediaCategory, keyword, file_size_bytes AS fileSize,
                arcgis_url AS arcgisUrl
         FROM media_attachments WHERE response_id = $1`, [id]
      );
      rows[0].media = mediaRows.length > 0 ? mediaRows : null;
    }

    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Survey not found' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    logger.error('Get survey error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to fetch survey' });
  }
}

async function getGeoJSON(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT
        sr.id, sr.arcgis_object_id, sr.poi_name_ar, sr.poi_name_en,
        sr.category, sr.company_status, sr.surveyor_username,
        sr.compliance_score, sr.is_complete,
        sr.longitude AS lng, sr.latitude AS lat,
        COUNT(ma.id) AS media_count
      FROM survey_responses sr
      LEFT JOIN media_attachments ma ON ma.response_id = sr.id
      WHERE sr.latitude IS NOT NULL AND sr.longitude IS NOT NULL
      GROUP BY sr.id
    `);

    const geojson = {
      type: 'FeatureCollection',
      features: rows.map(r => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [parseFloat(r.lng), parseFloat(r.lat)],
        },
        properties: {
          id: r.id,
          objectId: r.arcgis_object_id,
          nameAr: r.poi_name_ar,
          nameEn: r.poi_name_en,
          category: r.category,
          status: r.company_status,
          agent: r.surveyor_username,
          compliance: r.compliance_score,
          isComplete: r.is_complete,
          mediaCount: parseInt(r.media_count),
        },
      })),
    };

    res.json(geojson);
  } catch (err) {
    logger.error('GeoJSON error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to generate GeoJSON' });
  }
}

async function updateSurvey(req, res) {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Fetch existing record
    const { rows } = await pool.query('SELECT * FROM survey_responses WHERE id = $1', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Survey not found' });
    }
    const existing = rows[0];

    // Use centralized field mapping + latitude/longitude
    const fieldMap = { ...editableFieldMap, latitude: 'latitude', longitude: 'longitude' };

    // Build SET clause with multi-select normalization
    const setClauses = [];
    const params = [];
    for (const [field, col] of Object.entries(fieldMap)) {
      if (updates[field] !== undefined) {
        params.push(normalizeFieldValue(field, updates[field]));
        setClauses.push(`${col} = $${params.length}`);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    // Merge updates into existing record for compliance recalculation
    const merged = { ...existing };
    for (const [field, col] of Object.entries(fieldMap)) {
      if (updates[field] !== undefined) merged[col] = normalizeFieldValue(field, updates[field]);
    }

    // Query image/video counts for weighted compliance
    let imageCount = 0;
    let videoCount = 0;
    try {
      const { rows: mcRows } = await pool.query(
        `SELECT media_category, COUNT(*) AS cnt FROM media_attachments WHERE response_id = $1 GROUP BY media_category`, [id]
      );
      for (const row of mcRows) {
        if (row.media_category === 'image') imageCount = parseInt(row.cnt) || 0;
        else if (row.media_category === 'video') videoCount = parseInt(row.cnt) || 0;
      }
    } catch (_) { /* ignore */ }

    // Category-aware weighted compliance calculation
    const compliance = calculateCompliance(merged, {
      category: merged.category || '',
      imageCount,
      videoCount,
    });
    const complianceScore = compliance.score;
    const isComplete = compliance.isComplete ? 1 : 0;
    const { totalFields, filledFields, missingFields } = compliance;

    params.push(complianceScore);
    setClauses.push(`compliance_score = $${params.length}`);
    params.push(isComplete);
    setClauses.push(`is_complete = $${params.length}`);
    params.push(totalFields);
    setClauses.push(`total_fields = $${params.length}`);
    params.push(filledFields);
    setClauses.push(`filled_fields = $${params.length}`);
    params.push(JSON.stringify(missingFields));
    setClauses.push(`missing_fields = $${params.length}`);

    params.push(id);
    await pool.query(
      `UPDATE survey_responses SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
      params
    );

    // Sync to ArcGIS Online
    let arcgisSync = { synced: false };
    const globalId = existing.arcgis_global_id;
    if (globalId) {
      try {
        // Get objectId from ArcGIS using globalId
        let objectId = existing.arcgis_object_id;
        if (!objectId) {
          const queryResult = await arcgisService.queryFeatures({
            where: `globalid='${globalId}'`,
            outFields: 'objectid',
            returnGeometry: false,
          });
          if (queryResult.features && queryResult.features.length > 0) {
            objectId = queryResult.features[0].attributes.objectid;
            // Save objectId locally for future use
            await pool.query('UPDATE survey_responses SET arcgis_object_id = $1 WHERE id = $2', [objectId, id]);
          }
        }

        if (!objectId) {
          throw new Error('Could not find objectId in ArcGIS for this feature');
        }

        // Use centralized localToArcgisMap instead of inline mapping
        const arcgisAttrs = { objectid: objectId };
        for (const [field] of Object.entries(fieldMap)) {
          if (updates[field] !== undefined && localToArcgisMap[field]) {
            arcgisAttrs[localToArcgisMap[field]] = normalizeFieldValue(field, updates[field]);
          }
        }

        const feature = { attributes: arcgisAttrs };
        if (updates.latitude !== undefined && updates.longitude !== undefined) {
          feature.geometry = { x: parseFloat(updates.longitude), y: parseFloat(updates.latitude), spatialReference: { wkid: 4326 } };
        }

        const results = await arcgisService.applyEdits([feature]);
        arcgisSync = { synced: true, results };
        logger.info('ArcGIS sync success', { globalId });

        // Record successful sync
        await pool.query(
          `UPDATE survey_responses SET sync_pending = 0, last_synced_at = NOW(), last_sync_error = NULL WHERE id = $1`,
          [id]
        );
        // Audit log
        const changedFields = Object.keys(updates).filter(f => fieldMap[f]);
        await pool.query(
          `INSERT INTO sync_audit_log (id, response_id, direction, status, fields_changed) VALUES ($1, $2, 'outgoing', 'success', $3)`,
          [crypto.randomUUID(), id, JSON.stringify(changedFields)]
        );
      } catch (err) {
        logger.error('ArcGIS sync error', { error: err.message });
        arcgisSync = { synced: false, error: err.message };

        // Record sync failure for retry
        await pool.query(
          `UPDATE survey_responses SET sync_pending = 1, last_sync_error = $1, last_sync_attempt = NOW() WHERE id = $2`,
          [err.message, id]
        ).catch(e => logger.error('Failed to record sync failure', { error: e.message }));

        // Audit log
        await pool.query(
          `INSERT INTO sync_audit_log (id, response_id, direction, status, error_message) VALUES ($1, $2, 'outgoing', 'failed', $3)`,
          [crypto.randomUUID(), id, err.message]
        ).catch(e => logger.error('Failed to write audit log', { error: e.message }));
      }
    }

    // Broadcast update via SSE
    realtimeService.broadcast('survey:updated', { id, complianceScore });

    // Return updated record
    const { rows: updatedRows } = await pool.query('SELECT * FROM survey_responses WHERE id = $1', [id]);

    res.json({
      success: true,
      data: updatedRows[0],
      compliance: { score: complianceScore, isComplete, totalFields, filledFields },
      arcgisSync,
    });
  } catch (err) {
    logger.error('Update survey error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to update survey' });
  }
}

async function getFilterOptions(req, res) {
  try {
    const [catResult, agentResult] = await Promise.all([
      pool.query(`SELECT DISTINCT category FROM survey_responses WHERE category IS NOT NULL AND category != '' ORDER BY category`),
      pool.query(`SELECT DISTINCT surveyor_username FROM survey_responses WHERE surveyor_username IS NOT NULL AND surveyor_username != '' ORDER BY surveyor_username`),
    ]);
    res.json({
      success: true,
      categories: catResult.rows.map(r => r.category),
      agents: agentResult.rows.map(r => r.surveyor_username),
    });
  } catch (err) {
    logger.error('Filter options error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to fetch filter options' });
  }
}

async function reviewSurvey(req, res) {
  try {
    const { id } = req.params;
    const { status, notes, reviewer } = req.body;

    const validStatuses = ['pending', 'approved', 'rejected', 'needs_revision'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid review status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const result = await pool.query(
      `UPDATE survey_responses
       SET review_status = $1, review_notes = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id = $4
       RETURNING id, review_status, reviewed_by, reviewed_at, review_notes`,
      [status, notes || null, reviewer || 'admin', id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Survey not found' });
    }

    logger.info('Survey reviewed', { surveyId: id, status, reviewer: reviewer || 'admin' });

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    logger.error('Review error', { error: err.message, surveyId: req.params.id });
    res.status(500).json({ success: false, error: 'Failed to update review status' });
  }
}

async function batchReview(req, res) {
  try {
    const { ids, status, notes, reviewer } = req.body;

    const validStatuses = ['pending', 'approved', 'rejected', 'needs_revision'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid review status' });
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids must be a non-empty array' });
    }

    const placeholders = ids.map((_, i) => `$${i + 4}`).join(',');
    const result = await pool.query(
      `UPDATE survey_responses
       SET review_status = $1, review_notes = $2, reviewed_by = $3, reviewed_at = NOW()
       WHERE id IN (${placeholders})
       RETURNING id, review_status`,
      [status, notes || null, reviewer || 'admin', ...ids]
    );

    logger.info('Batch review', { count: result.rows.length, status, reviewer: reviewer || 'admin' });

    res.json({ success: true, data: result.rows, updated: result.rows.length });
  } catch (err) {
    logger.error('Batch review error', { error: err.message });
    res.status(500).json({ success: false, error: 'Failed to batch update review status' });
  }
}

module.exports = { listSurveys, getSurveyById, getGeoJSON, updateSurvey, getFilterOptions, reviewSurvey, batchReview };
