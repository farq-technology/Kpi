const pool = require('../db/pool');
const arcgisService = require('../services/arcgis.service');
const realtimeService = require('../services/realtime.service');

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

    let where = 'WHERE 1=1';
    const params = [];

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
        latitude, longitude,
        is_complete, compliance_score,
        missing_fields,
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
    console.error('List surveys error:', err);
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
    console.error('Get survey error:', err);
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
    console.error('GeoJSON error:', err);
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

    // Editable field mapping: request field -> DB column (matches Survey123 exactly)
    const fieldMap = {
      poi_name_ar: 'poi_name_ar',
      poi_name_en: 'poi_name_en',
      legal_name: 'legal_name',
      category: 'category',
      secondary_category: 'secondary_category',
      company_status: 'company_status',
      status_notes: 'status_notes',
      identity_correct: 'identity_correct',
      identity_notes: 'identity_notes',
      surveyor_username: 'surveyor_username',
      phone_number: 'phone_number',
      website: 'website',
      social_media: 'social_media',
      language: 'language',
      working_days: 'working_days',
      working_hours: 'working_hours',
      break_time: 'break_time',
      holidays: 'holidays',
      payment_methods: 'payment_methods',
      commercial_license: 'commercial_license',
      building_number: 'building_number',
      floor_number: 'floor_number',
      entrance_description: 'entrance_description',
      is_landmark: 'is_landmark',
      pickup_point_exists: 'pickup_point_exists',
      pickup_description: 'pickup_description',
      has_physical_menu: 'has_physical_menu',
      has_digital_menu: 'has_digital_menu',
      menu_barcode_url: 'menu_barcode_url',
      cuisine: 'cuisine',
      dine_in: 'dine_in',
      only_delivery: 'only_delivery',
      drive_thru: 'drive_thru',
      order_from_car: 'order_from_car',
      has_family_seating: 'has_family_seating',
      has_separate_rooms_for_dining: 'has_separate_rooms_for_dining',
      large_groups_can_be_seated: 'large_groups_can_be_seated',
      reservation: 'reservation',
      has_parking_lot: 'has_parking_lot',
      valet_parking: 'valet_parking',
      wifi: 'wifi',
      is_wheelchair_accessible: 'is_wheelchair_accessible',
      has_smoking_area: 'has_smoking_area',
      has_a_waiting_area: 'has_a_waiting_area',
      has_women_only_prayer_room: 'has_women_only_prayer_room',
      children_area: 'children_area',
      music: 'music',
      live_sport_broadcasting: 'live_sport_broadcasting',
      shisha: 'shisha',
      offers_iftar_menu: 'offers_iftar_menu',
      is_open_during_suhoor: 'is_open_during_suhoor',
      provides_iftar_tent: 'provides_iftar_tent',
      require_ticket: 'require_ticket',
      is_free_entry: 'is_free_entry',
      general_notes: 'general_notes',
      latitude: 'latitude',
      longitude: 'longitude',
    };

    // Build SET clause
    const setClauses = [];
    const params = [];
    for (const [field, col] of Object.entries(fieldMap)) {
      if (updates[field] !== undefined) {
        params.push(updates[field]);
        setClauses.push(`${col} = $${params.length}`);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    // Recalculate compliance
    const merged = { ...existing };
    for (const [field, col] of Object.entries(fieldMap)) {
      if (updates[field] !== undefined) merged[col] = updates[field];
    }

    const requiredFields = [
      merged.poi_name_ar, merged.poi_name_en, merged.category,
      merged.phone_number, merged.working_days, merged.working_hours, merged.company_status,
    ];
    const allFieldValues = [
      merged.poi_name_ar, merged.poi_name_en, merged.legal_name,
      merged.category, merged.secondary_category,
      merged.company_status, merged.phone_number, merged.website, merged.social_media,
      merged.working_days, merged.working_hours, merged.break_time, merged.holidays,
      merged.language, merged.payment_methods, merged.commercial_license,
      merged.building_number, merged.floor_number, merged.entrance_description,
      merged.dine_in, merged.has_family_seating, merged.has_parking_lot, merged.wifi,
      merged.is_wheelchair_accessible, merged.cuisine, merged.offers_iftar_menu, merged.is_open_during_suhoor,
      merged.valet_parking, merged.drive_thru, merged.only_delivery,
      merged.has_separate_rooms_for_dining, merged.large_groups_can_be_seated,
      merged.order_from_car, merged.music, merged.live_sport_broadcasting,
      merged.shisha, merged.children_area, merged.has_smoking_area,
      merged.has_a_waiting_area, merged.reservation, merged.has_women_only_prayer_room,
      merged.provides_iftar_tent, merged.is_landmark,
      merged.has_physical_menu, merged.has_digital_menu,
    ];

    const filledRequired = requiredFields.filter(f => f && f !== '' && f !== 'N/A').length;
    const totalFields = allFieldValues.length;
    const filledFields = allFieldValues.filter(f => f && f !== '' && f !== 'N/A').length;
    const complianceScore = totalFields > 0 ? parseFloat(((filledFields / totalFields) * 100).toFixed(2)) : 0;
    const isComplete = filledRequired === requiredFields.length ? 1 : 0;

    params.push(complianceScore);
    setClauses.push(`compliance_score = $${params.length}`);
    params.push(isComplete);
    setClauses.push(`is_complete = $${params.length}`);
    params.push(totalFields);
    setClauses.push(`total_fields = $${params.length}`);
    params.push(filledFields);
    setClauses.push(`filled_fields = $${params.length}`);

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
        // Map local fields to ArcGIS field names (exact Survey123 field names)
        const arcgisFieldMap = {
          poi_name_ar: 'name_ar',
          poi_name_en: 'name_en',
          legal_name: 'legal_name',
          category: 'category',
          secondary_category: 'secondary_category',
          company_status: 'company_status',
          status_notes: 'status_notes',
          identity_correct: 'identity_correct',
          identity_notes: 'identity_notes',
          surveyor_username: 'agent_name',
          phone_number: 'phone_number',
          website: 'website',
          social_media: 'social_media',
          language: 'language',
          working_days: 'working_days',
          working_hours: 'working_hours_each_day',
          break_time: 'break_time_each_day',
          holidays: 'holidays',
          payment_methods: 'accepted_payment_methods',
          commercial_license: 'commercial_license_number',
          building_number: 'building_number',
          floor_number: 'floor_number',
          entrance_description: 'entrance_description',
          is_landmark: 'is_landmark',
          pickup_point_exists: 'pickup_point_exists',
          pickup_description: 'pickup_description',
          has_physical_menu: 'has_physical_menu',
          has_digital_menu: 'has_digital_menu',
          menu_barcode_url: 'menu_barcode_url',
          cuisine: 'cuisine',
          dine_in: 'dine_in',
          only_delivery: 'only_delivery',
          drive_thru: 'drive_thru',
          order_from_car: 'order_from_car',
          has_family_seating: 'has_family_seating',
          has_separate_rooms_for_dining: 'has_separate_rooms_for_dining',
          large_groups_can_be_seated: 'large_groups_can_be_seated',
          reservation: 'reservation',
          has_parking_lot: 'has_parking_lot',
          valet_parking: 'valet_parking',
          wifi: 'wifi',
          is_wheelchair_accessible: 'is_wheelchair_accessible',
          has_smoking_area: 'has_smoking_area',
          has_a_waiting_area: 'has_a_waiting_area',
          has_women_only_prayer_room: 'has_women_only_prayer_room',
          children_area: 'children_area',
          music: 'music',
          live_sport_broadcasting: 'live_sport_broadcasting',
          shisha: 'shisha',
          offers_iftar_menu: 'offers_iftar_menu',
          is_open_during_suhoor: 'is_open_during_suhoor',
          provides_iftar_tent: 'provides_iftar_tent',
          require_ticket: 'require_ticket',
          is_free_entry: 'is_free_entry',
          general_notes: 'general_notes',
        };

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

        const arcgisAttrs = { objectid: objectId };
        for (const [field] of Object.entries(fieldMap)) {
          if (updates[field] !== undefined && arcgisFieldMap[field]) {
            arcgisAttrs[arcgisFieldMap[field]] = updates[field];
          }
        }

        const feature = { attributes: arcgisAttrs };
        if (updates.latitude !== undefined && updates.longitude !== undefined) {
          feature.geometry = { x: parseFloat(updates.longitude), y: parseFloat(updates.latitude), spatialReference: { wkid: 4326 } };
        }

        const results = await arcgisService.applyEdits([feature]);
        arcgisSync = { synced: true, results };
        console.log(`ArcGIS sync success for ${globalId}`);
      } catch (err) {
        console.error('ArcGIS sync error:', err.message);
        arcgisSync = { synced: false, error: err.message };
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
    console.error('Update survey error:', err);
    res.status(500).json({ success: false, error: 'Failed to update survey' });
  }
}

module.exports = { listSurveys, getSurveyById, getGeoJSON, updateSurvey };
