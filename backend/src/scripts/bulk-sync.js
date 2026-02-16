/**
 * Bulk sync script: resolves objectIds from ArcGIS and fetches attachments
 * Run: node backend/src/scripts/bulk-sync.js
 */
const pool = require('../db/pool');
const arcgisService = require('../services/arcgis.service');
const crypto = require('crypto');

async function resolveObjectIds() {
  console.log('=== Step 1: Resolving objectIds from ArcGIS ===');

  const { rows } = await pool.query(
    `SELECT id, arcgis_global_id FROM survey_responses
     WHERE arcgis_object_id IS NULL AND arcgis_global_id IS NOT NULL`
  );

  console.log(`Found ${rows.length} records without objectId`);
  if (rows.length === 0) return;

  // Process in batches of 10 globalIds (larger batches hit URL length limits)
  const batchSize = 10;
  let totalResolved = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const globalIds = batch.map(r => `'${r.arcgis_global_id}'`).join(',');

    try {
      const result = await arcgisService.queryFeatures({
        where: `globalid IN (${globalIds})`,
        outFields: 'objectid,globalid',
        returnGeometry: false,
      });

      if (result.features) {
        for (const feat of result.features) {
          const gid = feat.attributes.globalid;
          const oid = feat.attributes.objectid;
          await pool.query(
            'UPDATE survey_responses SET arcgis_object_id = ? WHERE arcgis_global_id = ?',
            [oid, gid]
          );
          totalResolved++;
        }
      }

      console.log(`Batch ${Math.floor(i / batchSize) + 1}: resolved ${result.features ? result.features.length : 0} objectIds (total: ${totalResolved})`);
    } catch (err) {
      console.error(`Batch ${Math.floor(i / batchSize) + 1} error:`, err.message);
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`Total objectIds resolved: ${totalResolved}`);
}

async function syncAttachments() {
  console.log('\n=== Step 2: Syncing attachments from ArcGIS ===');

  const { rows: responses } = await pool.query(
    `SELECT sr.id, sr.arcgis_object_id
     FROM survey_responses sr
     WHERE sr.arcgis_object_id IS NOT NULL
     AND sr.id NOT IN (SELECT DISTINCT response_id FROM media_attachments)`
  );

  console.log(`Found ${responses.length} responses to sync attachments for`);
  if (responses.length === 0) return;

  const objectIds = responses.map(r => r.arcgis_object_id).filter(Boolean);
  let totalAttachments = 0;
  const batchSize = 25;

  for (let i = 0; i < objectIds.length; i += batchSize) {
    const batch = objectIds.slice(i, i + batchSize);

    try {
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
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [id, response.id, att.id, att.globalId || null, att.name || 'unknown', contentType, mediaCategory, att.keywords || null, att.size || 0, url]
            );
            totalAttachments++;
          } catch (e) {
            // Skip duplicates
          }
        }
      }

      const batchNum = Math.floor(i / batchSize) + 1;
      console.log(`Attachment batch ${batchNum}: checked ${batch.length} objectIds (total attachments: ${totalAttachments})`);
    } catch (err) {
      console.error(`Attachment batch error:`, err.message);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`Total attachments synced: ${totalAttachments}`);
}

async function main() {
  try {
    await resolveObjectIds();
    await syncAttachments();

    // Final stats
    const { rows: stats } = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM survey_responses WHERE arcgis_object_id IS NOT NULL) as with_oid,
        (SELECT COUNT(*) FROM survey_responses WHERE arcgis_object_id IS NULL) as without_oid,
        (SELECT COUNT(*) FROM media_attachments) as total_media,
        (SELECT COUNT(*) FROM media_attachments WHERE media_category = 'image') as images,
        (SELECT COUNT(*) FROM media_attachments WHERE media_category = 'video') as videos
    `);
    console.log('\n=== Final Stats ===');
    console.log(stats[0]);
  } catch (err) {
    console.error('Bulk sync error:', err);
  }
  process.exit(0);
}

main();
