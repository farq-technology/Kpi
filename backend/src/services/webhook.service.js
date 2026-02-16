const database = require('../db/pool');
const crypto = require('crypto');

const REQUIRED_FIELDS = [
  'name_ar', 'name_en', 'category', 'phone_number',
  'working_days', 'working_hours_each_day', 'company_status',
];

class WebhookService {
  async processWebhook(payload) {
    const eventType = payload.eventType || 'addData';
    const feature = payload.feature || {};
    const attrs = feature.attributes || {};
    const geometry = feature.geometry || {};
    const serverResponse = payload.serverResponse || {};
    const userInfo = payload.userInfo || {};
    const surveyInfo = payload.surveyInfo || {};

    const objectId = serverResponse?.addResults?.[0]?.objectId
      || serverResponse?.updateResults?.[0]?.objectId
      || attrs.objectid;
    const globalId = serverResponse?.addResults?.[0]?.globalId
      || serverResponse?.updateResults?.[0]?.globalId
      || attrs.globalid
      || crypto.randomUUID();

    const { score, missingFields, totalFields, filledFields } = this.calculateCompliance(attrs);
    const isComplete = missingFields.length === 0;

    const submittedAt = attrs.CreationDate
      ? new Date(attrs.CreationDate).toISOString()
      : new Date().toISOString();

    const lon = geometry.x || attrs.longitude;
    const lat = geometry.y || attrs.latitude;

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
        console.error('Survey upsert error:', err.message);
      }
    }

    // Insert response
    const responseId = crypto.randomUUID();
    const query = `
      INSERT INTO survey_responses (
        id, survey_id, arcgis_object_id, arcgis_global_id,
        surveyor_username, surveyor_name, surveyor_email, agent_id,
        poi_name_ar, poi_name_en, category, secondary_category,
        company_status, phone_number, website, social_media,
        working_days, working_hours, break_time, holidays,
        language, payment_methods, commercial_license,
        building_number, floor_number, entrance_location,
        dine_in, has_family_seating, has_parking_lot, wifi,
        is_wheelchair_accessible, cuisine, offers_iftar_menu, is_open_during_suhoor,
        latitude, longitude,
        is_complete, missing_fields, compliance_score, total_fields, filled_fields,
        event_type, submitted_at, raw_payload, attributes
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19, $20,
        $21, $22, $23,
        $24, $25, $26,
        $27, $28, $29, $30,
        $31, $32, $33, $34,
        $35, $36,
        $37, $38, $39, $40, $41,
        $42, $43, $44, $45
      )
    `;

    const values = [
      responseId, surveyId, objectId, globalId,
      userInfo.username || attrs.agent_name || attrs.Creator || null,
      userInfo.fullName || `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim() || null,
      userInfo.email || null,
      attrs.agent_id || null,
      attrs.name_ar || null, attrs.name_en || null,
      attrs.category || null, attrs.secondary_category || null,
      attrs.company_status || null, attrs.phone_number || null,
      attrs.website || null, attrs.social_media || null,
      attrs.working_days || null, attrs.working_hours_each_day || null,
      attrs.break_time_each_day || null, attrs.holidays || null,
      attrs.language || null, attrs.accepted_payment_methods || null,
      attrs.commercial_license_number || null,
      attrs.building_number || null, attrs.floor_number || null,
      attrs.entrance_location || null,
      attrs.dine_in || null, attrs.has_family_seating || null,
      attrs.has_parking_lot || null, attrs.wifi || null,
      attrs.is_wheelchair_accessible || null, attrs.cuisine || null,
      attrs.offers_iftar_menu || null, attrs.is_open_during_suhoor || null,
      lat || null, lon || null,
      isComplete ? 1 : 0, JSON.stringify(missingFields), score, totalFields, filledFields,
      eventType, submittedAt, JSON.stringify(payload), JSON.stringify(attrs),
    ];

    await database.query(query, values);

    // Process attachments
    if (feature.attachments && feature.attachments.length > 0) {
      await this.processAttachments(responseId, feature.attachments);
    }

    return { id: responseId, objectId, globalId, isComplete, complianceScore: score };
  }

  calculateCompliance(attrs) {
    const allFields = Object.keys(attrs).filter(k =>
      !['objectid', 'globalid', 'CreationDate', 'Creator', 'EditDate', 'Editor'].includes(k)
    );
    const totalFields = allFields.length;
    let filledFields = 0;
    const missingFields = [];

    for (const field of REQUIRED_FIELDS) {
      if (!attrs[field] || attrs[field] === '') missingFields.push(field);
    }
    for (const field of allFields) {
      if (attrs[field] !== null && attrs[field] !== undefined && attrs[field] !== '') filledFields++;
    }

    const score = totalFields > 0 ? parseFloat(((filledFields / totalFields) * 100).toFixed(2)) : 0;
    return { score, missingFields, totalFields, filledFields };
  }

  async processAttachments(responseId, attachments) {
    for (const att of attachments) {
      const contentType = att.contentType || '';
      let mediaCategory = 'document';
      if (contentType.startsWith('image/')) mediaCategory = 'image';
      else if (contentType.startsWith('video/')) mediaCategory = 'video';
      else if (contentType.startsWith('audio/')) mediaCategory = 'audio';

      const id = crypto.randomUUID();
      await database.query(
        `INSERT INTO media_attachments (id, response_id, arcgis_attachment_id, arcgis_global_id, file_name, content_type, media_category, keyword, file_size_bytes, arcgis_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, responseId, att.id || 0, att.globalId || null, att.name || 'unknown', contentType, mediaCategory, att.keywords || null, att.size || 0, att.url || '']
      );
    }
  }
}

module.exports = new WebhookService();
