const database = require('../db/pool');
const crypto = require('crypto');
const { arcgisToLocalMap } = require('../config/field-mappings');
const { calculateCompliance } = require('../utils/compliance');
const logger = require('../utils/logger');
const arcgisService = require('./arcgis.service');

/**
 * All survey_responses data columns extracted from ArcGIS webhook.
 * Mirrors FIELD_DEFINITIONS in field-mappings.js (minus surveyor_username).
 */
const WEBHOOK_DATA_COLUMNS = [
  'poi_name_ar', 'poi_name_en', 'legal_name', 'category', 'secondary_category',
  'company_status', 'status_notes', 'identity_correct', 'identity_notes',
  'phone_number', 'website', 'social_media', 'working_days', 'working_hours',
  'break_time', 'holidays', 'language', 'payment_methods', 'commercial_license',
  'building_number', 'floor_number', 'entrance_description', 'is_landmark',
  'pickup_point_exists', 'pickup_description', 'has_physical_menu', 'has_digital_menu',
  'menu_barcode_url', 'cuisine', 'dine_in', 'only_delivery', 'drive_thru',
  'order_from_car', 'has_family_seating', 'has_separate_rooms_for_dining',
  'large_groups_can_be_seated', 'reservation', 'has_parking_lot', 'valet_parking',
  'wifi', 'is_wheelchair_accessible', 'has_smoking_area', 'has_a_waiting_area',
  'has_women_only_prayer_room', 'children_area', 'music', 'live_sport_broadcasting',
  'shisha', 'offers_iftar_menu', 'is_open_during_suhoor', 'provides_iftar_tent',
  'require_ticket', 'is_free_entry', 'general_notes',
];

// Reverse map: local DB column → ArcGIS field name
const localToArcgis = {};
for (const [arcgis, local] of Object.entries(arcgisToLocalMap)) {
  localToArcgis[local] = arcgis;
}

class WebhookService {
  async processWebhook(payload) {
    const eventType = payload.eventType || 'addData';
    const feature = payload.feature || {};
    const attrs = feature.attributes || {};
    const geometry = feature.geometry || {};
    const serverResponse = payload.serverResponse || payload.response || {};
    const userInfo = payload.userInfo || {};
    const surveyInfo = payload.surveyInfo || {};

    const objectId = serverResponse?.addResults?.[0]?.objectId
      || serverResponse?.updateResults?.[0]?.objectId
      || attrs.objectid;
    const globalId = serverResponse?.addResults?.[0]?.globalId
      || serverResponse?.updateResults?.[0]?.globalId
      || attrs.globalid
      || crypto.randomUUID();

    // Convert ArcGIS field names to local DB names for compliance calculation
    const localRecord = {};
    for (const [arcgisName, value] of Object.entries(attrs)) {
      const localName = arcgisToLocalMap[arcgisName];
      if (localName) localRecord[localName] = value;
    }

    // Fetch attachments from ArcGIS Online (single source of truth for media)
    let attachmentInfos = [];
    if (objectId) {
      try {
        const groups = await arcgisService.queryAttachments([objectId]);
        const group = groups.find(g => g.parentObjectId == objectId);
        attachmentInfos = group?.attachmentInfos || [];
      } catch (err) {
        logger.warn('Could not fetch attachments from ArcGIS', { objectId, error: err.message });
      }
    }
    // Fallback to payload attachments only if ArcGIS fetch failed and payload has them
    if (attachmentInfos.length === 0 && feature.attachments?.length > 0) {
      attachmentInfos = feature.attachments.map(a => ({
        id: a.id,
        globalId: a.globalId,
        name: a.name,
        contentType: a.contentType,
        size: a.size,
        keywords: a.keywords,
      }));
    }

    let imageCount = 0;
    let videoCount = 0;
    for (const att of attachmentInfos) {
      const ct = (att.contentType || '').toLowerCase();
      if (ct.startsWith('video/')) videoCount++;
      else if (ct.startsWith('image/')) imageCount++;
    }
    const { score, isComplete, missingFields, totalFields, filledFields } = calculateCompliance(localRecord, {
      category: localRecord.category || attrs.category || '',
      imageCount,
      videoCount,
    });

    const submittedAt = attrs.CreationDate
      ? new Date(attrs.CreationDate).toISOString()
      : new Date().toISOString();

    const lat = geometry.y ?? attrs.latitude ?? null;
    const lon = geometry.x ?? attrs.longitude ?? null;

    // Upsert survey form
    let surveyId = null;
    if (surveyInfo.formItemId) {
      surveyId = crypto.randomUUID();
      try {
        const surveyResult = await database.query(
          `INSERT INTO surveys (id, form_item_id, form_title, service_item_id, service_url)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (form_item_id) DO NOTHING`,
          [surveyId, surveyInfo.formItemId, surveyInfo.formTitle || 'POI Survey', surveyInfo.serviceItemId || null, surveyInfo.serviceUrl || null]
        );
        // Try to get existing survey id
        const existing = await database.query(
          'SELECT id FROM surveys WHERE form_item_id = $1', [surveyInfo.formItemId]
        );
        if (existing.rows.length > 0) surveyId = existing.rows[0].id;
      } catch (err) {
        logger.error('Survey upsert error', { error: err.message });
      }
    }

    // Build data values from localRecord using WEBHOOK_DATA_COLUMNS (all 53 fields)
    const responseId = crypto.randomUUID();
    const surveyorUsername = userInfo.username || localRecord.surveyor_username || attrs.agent_name || attrs.Creator || null;
    const surveyorName = userInfo.fullName || `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || null;

    const dataValues = WEBHOOK_DATA_COLUMNS.map(col => {
      const v = localRecord[col];
      if (v !== undefined && v !== null) return v;
      // Fallback: try direct ArcGIS attr name
      const arcgisKey = localToArcgis[col];
      const fallback = arcgisKey ? attrs[arcgisKey] : undefined;
      return (fallback !== undefined && fallback !== '') ? fallback : null;
    });

    const columns = [
      'id', 'survey_id', 'arcgis_object_id', 'arcgis_global_id',
      'surveyor_username', 'surveyor_name', 'surveyor_email', 'agent_id',
      ...WEBHOOK_DATA_COLUMNS,
      'latitude', 'longitude',
      'is_complete', 'missing_fields', 'compliance_score', 'total_fields', 'filled_fields',
      'event_type', 'submitted_at', 'raw_payload', 'attributes',
    ];

    const values = [
      responseId, surveyId, objectId, globalId,
      surveyorUsername, surveyorName, userInfo.email || null, attrs.agent_id || null,
      ...dataValues,
      lat, lon,
      isComplete,
      Array.isArray(missingFields) ? missingFields : [],
      score, totalFields, filledFields,
      eventType, submittedAt, JSON.stringify(payload), JSON.stringify(attrs),
    ];

    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
    const query = `INSERT INTO survey_responses (${columns.join(', ')}) VALUES (${placeholders})`;

    await database.query(query, values);

    // Store attachments from ArcGIS Online (all media from ArcGIS, not payload)
    if (attachmentInfos.length > 0 && objectId) {
      await this.processAttachmentsFromArcGIS(responseId, objectId, attachmentInfos);
    }

    return { id: responseId, objectId, globalId, isComplete, complianceScore: score };
  }

  async processAttachmentsFromArcGIS(responseId, objectId, attachmentInfos) {
    for (const att of attachmentInfos) {
      if (att.id == null) continue; // skip invalid entries
      const contentType = att.contentType || '';
      let mediaCategory = 'document';
      if (contentType.startsWith('image/')) mediaCategory = 'image';
      else if (contentType.startsWith('video/')) mediaCategory = 'video';
      else if (contentType.startsWith('audio/')) mediaCategory = 'audio';

      const id = crypto.randomUUID();
      const arcgisUrl = `${objectId}/attachments/${att.id}`;
      await database.query(
        `INSERT INTO media_attachments (id, response_id, arcgis_attachment_id, arcgis_global_id, file_name, content_type, media_category, keyword, file_size_bytes, arcgis_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, responseId, att.id, att.globalId || null, att.name || 'unknown', contentType, mediaCategory, att.keywords || null, att.size || 0, arcgisUrl]
      );
    }
  }
}

module.exports = new WebhookService();
