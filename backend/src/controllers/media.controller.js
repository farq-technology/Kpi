const pool = require('../db/pool');
const arcgisService = require('../services/arcgis.service');
const crypto = require('crypto');
const axios = require('axios');

async function listMedia(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const type = req.query.type || '';

    let where = 'WHERE 1=1';
    const params = [];

    if (type) {
      params.push(type);
      where += ` AND ma.media_category = $${params.length}`;
    }

    const countQuery = `SELECT COUNT(*) AS count FROM media_attachments ma ${where}`;
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const dataQuery = `
      SELECT
        ma.id, ma.file_name, ma.content_type, ma.media_category,
        ma.keyword, ma.file_size_bytes, ma.arcgis_url,
        ma.created_at,
        sr.poi_name_ar, sr.poi_name_en, sr.arcgis_object_id,
        sr.category AS survey_category
      FROM media_attachments ma
      JOIN survey_responses sr ON sr.id = ma.response_id
      ${where}
      ORDER BY ma.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const { rows } = await pool.query(dataQuery, params);

    res.json({
      success: true,
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('List media error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch media' });
  }
}

async function downloadMedia(req, res) {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT ma.arcgis_attachment_id, sr.arcgis_object_id, ma.content_type, ma.file_name
       FROM media_attachments ma
       JOIN survey_responses sr ON sr.id = ma.response_id
       WHERE ma.id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Media not found' });
    }

    const { arcgis_object_id, arcgis_attachment_id, content_type, file_name } = rows[0];
    const url = await arcgisService.getAttachmentUrl(arcgis_object_id, arcgis_attachment_id);

    // Proxy the file through backend instead of redirect (avoids CORS/referrer issues)
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 30000,
    });

    res.set('Content-Type', content_type || response.headers['content-type']);
    res.set('Content-Disposition', `inline; filename="${file_name}"`);
    if (response.headers['content-length']) {
      res.set('Content-Length', response.headers['content-length']);
    }
    res.set('Cache-Control', 'public, max-age=3600');

    response.data.pipe(res);
  } catch (err) {
    console.error('Download media error:', err);
    res.status(500).json({ error: 'Failed to download media' });
  }
}

async function fetchAttachmentsFromArcGIS(req, res) {
  try {
    const objectIds = req.query.objectIds;
    if (!objectIds) {
      return res.status(400).json({ error: 'objectIds parameter required' });
    }

    const attachments = await arcgisService.queryAttachments(objectIds);
    res.json({ success: true, data: attachments });
  } catch (err) {
    console.error('Fetch attachments error:', err);
    res.status(500).json({ error: 'Failed to fetch attachments from ArcGIS' });
  }
}

// Sync attachments from ArcGIS for all survey responses that have objectIds
async function syncAllAttachments(req, res) {
  try {
    // Get all responses with objectIds that don't have attachments yet
    const { rows: responses } = await pool.query(`
      SELECT sr.id, sr.arcgis_object_id, sr.arcgis_global_id
      FROM survey_responses sr
      WHERE sr.arcgis_object_id IS NOT NULL
      AND sr.id NOT IN (SELECT DISTINCT response_id FROM media_attachments)
      LIMIT 50
    `);

    if (responses.length === 0) {
      // Try to get objectIds from ArcGIS for responses missing them
      const { rows: noObjId } = await pool.query(`
        SELECT id, arcgis_global_id FROM survey_responses
        WHERE arcgis_object_id IS NULL AND arcgis_global_id IS NOT NULL
        LIMIT 100
      `);

      if (noObjId.length > 0) {
        // Batch query ArcGIS to get objectIds
        const globalIds = noObjId.map(r => `'${r.arcgis_global_id}'`).join(',');
        const result = await arcgisService.queryFeatures({
          where: `globalid IN (${globalIds})`,
          outFields: 'objectid,globalid',
          returnGeometry: false,
        });

        let updated = 0;
        if (result.features) {
          for (const feat of result.features) {
            const gid = feat.attributes.globalid;
            const oid = feat.attributes.objectid;
            await pool.query('UPDATE survey_responses SET arcgis_object_id = $1 WHERE arcgis_global_id = $2', [oid, gid]);
            updated++;
          }
        }

        // Re-fetch responses with objectIds
        const { rows: withObjIds } = await pool.query(`
          SELECT sr.id, sr.arcgis_object_id
          FROM survey_responses sr
          WHERE sr.arcgis_object_id IS NOT NULL
          AND sr.id NOT IN (SELECT DISTINCT response_id FROM media_attachments)
          LIMIT 50
        `);

        if (withObjIds.length === 0) {
          return res.json({ success: true, message: `Updated ${updated} objectIds, no attachments to sync` });
        }

        responses.push(...withObjIds);
      } else {
        return res.json({ success: true, message: 'No responses need attachment sync' });
      }
    }

    const objectIds = responses.map(r => r.arcgis_object_id).filter(Boolean);
    if (objectIds.length === 0) {
      return res.json({ success: true, message: 'No objectIds available for attachment query' });
    }

    // Query attachments in batches
    let totalAttachments = 0;
    const batchSize = 25;
    for (let i = 0; i < objectIds.length; i += batchSize) {
      const batch = objectIds.slice(i, i + batchSize);
      const attachmentGroups = await arcgisService.queryAttachments(batch);

      for (const group of attachmentGroups) {
        const objId = group.parentObjectId;
        const response = responses.find(r => r.arcgis_object_id === objId);
        if (!response || !group.attachmentInfos) continue;

        for (const att of group.attachmentInfos) {
          const contentType = att.contentType || '';
          let mediaCategory = 'document';
          if (contentType.startsWith('image/')) mediaCategory = 'image';
          else if (contentType.startsWith('video/')) mediaCategory = 'video';
          else if (contentType.startsWith('audio/')) mediaCategory = 'audio';

          const id = crypto.randomUUID();
          const url = `${objId}/attachments/${att.id}`;
          try {
            await pool.query(
              `INSERT INTO media_attachments (id, response_id, arcgis_attachment_id, arcgis_global_id, file_name, content_type, media_category, keyword, file_size_bytes, arcgis_url)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
              [id, response.id, att.id, att.globalId || null, att.name || 'unknown', contentType, mediaCategory, att.keywords || null, att.size || 0, url]
            );
            totalAttachments++;
          } catch (e) {
            // Skip duplicates
          }
        }
      }
    }

    res.json({
      success: true,
      message: `Synced ${totalAttachments} attachments from ${objectIds.length} responses`,
      totalAttachments,
    });
  } catch (err) {
    console.error('Sync attachments error:', err);
    res.status(500).json({ error: 'Failed to sync attachments: ' + err.message });
  }
}

module.exports = { listMedia, downloadMedia, fetchAttachmentsFromArcGIS, syncAllAttachments };
