const pool = require('../db/pool');
const arcgisService = require('./arcgis.service');

class KpiService {
  async getSummary(dateFrom, dateTo) {
    const params = [];
    let where = 'WHERE 1=1';
    if (dateFrom) { params.push(dateFrom); where += ` AND submitted_at >= $${params.length}`; }
    if (dateTo) { params.push(dateTo); where += ` AND submitted_at <= $${params.length}`; }

    const { rows } = await pool.query(`
      SELECT
        COUNT(*) AS total_responses,
        COUNT(DISTINCT surveyor_username) AS unique_surveyors,
        AVG(compliance_score) AS avg_compliance,
        SUM(CASE WHEN is_complete = 0 THEN 1 ELSE 0 END) AS incomplete_count,
        SUM(CASE WHEN is_complete = 1 THEN 1 ELSE 0 END) AS complete_count
      FROM survey_responses ${where}
    `, params);

    const s = rows[0];
    const total = parseInt(s.total_responses) || 0;

    // Media query - simplified
    const { rows: mediaRows } = await pool.query(`
      SELECT
        COUNT(DISTINCT ma.response_id) AS responses_with_media,
        SUM(CASE WHEN ma.media_category = 'image' THEN 1 ELSE 0 END) AS total_images,
        SUM(CASE WHEN ma.media_category = 'video' THEN 1 ELSE 0 END) AS total_videos
      FROM media_attachments ma
    `, []);

    const m = mediaRows[0];
    const responsesWithMedia = parseInt(m.responses_with_media) || 0;

    return {
      totalResponses: total,
      uniqueSurveyors: parseInt(s.unique_surveyors) || 0,
      avgCompliance: parseFloat(s.avg_compliance) || 0,
      missingDataPct: total > 0 ? ((parseInt(s.incomplete_count) || 0) / total * 100) : 0,
      completenessRate: total > 0 ? ((parseInt(s.complete_count) || 0) / total * 100) : 0,
      mediaUsageRate: total > 0 ? (responsesWithMedia / total * 100) : 0,
      totalImages: parseInt(m.total_images) || 0,
      totalVideos: parseInt(m.total_videos) || 0,
    };
  }

  async getDailyStats(dateFrom, dateTo) {
    const params = [];
    let where = 'WHERE submitted_at IS NOT NULL';
    if (dateFrom) { params.push(dateFrom); where += ` AND submitted_at >= $${params.length}`; }
    if (dateTo) { params.push(dateTo); where += ` AND submitted_at <= $${params.length}`; }

    const { rows } = await pool.query(`
      SELECT
        DATE_TRUNC('day', submitted_at)::DATE AS day,
        COUNT(*) AS total,
        COUNT(DISTINCT surveyor_username) AS surveyors,
        AVG(compliance_score) AS avg_compliance,
        SUM(CASE WHEN is_complete = 0 THEN 1 ELSE 0 END) AS incomplete
      FROM survey_responses ${where}
      GROUP BY DATE_TRUNC('day', submitted_at)::DATE
      ORDER BY day ASC
    `, params);

    return rows.map(r => ({
      day: r.day,
      total: parseInt(r.total),
      surveyors: parseInt(r.surveyors),
      avgCompliance: parseFloat(r.avg_compliance) || 0,
      incomplete: parseInt(r.incomplete),
    }));
  }

  async getWeeklyStats(dateFrom, dateTo) {
    const params = [];
    let where = 'WHERE submitted_at IS NOT NULL';
    if (dateFrom) { params.push(dateFrom); where += ` AND submitted_at >= $${params.length}`; }
    if (dateTo) { params.push(dateTo); where += ` AND submitted_at <= $${params.length}`; }

    const { rows } = await pool.query(`
      SELECT
        DATE_TRUNC('week', submitted_at)::DATE AS week,
        COUNT(*) AS total,
        COUNT(DISTINCT surveyor_username) AS surveyors,
        AVG(compliance_score) AS avg_compliance
      FROM survey_responses ${where}
      GROUP BY DATE_TRUNC('week', submitted_at)::DATE
      ORDER BY week ASC
    `, params);

    return rows.map(r => ({
      week: r.week,
      total: parseInt(r.total),
      surveyors: parseInt(r.surveyors),
      avgCompliance: parseFloat(r.avg_compliance) || 0,
    }));
  }

  async getCategoryDistribution() {
    const { rows } = await pool.query(`
      SELECT category, COUNT(*) AS count
      FROM survey_responses
      WHERE category IS NOT NULL AND category != ''
      GROUP BY category ORDER BY count DESC
    `);
    return rows;
  }

  async getAgentPerformance() {
    const { rows } = await pool.query(`
      SELECT
        surveyor_username AS agent,
        COUNT(*) AS total_submissions,
        AVG(compliance_score) AS avg_compliance,
        SUM(CASE WHEN is_complete = 1 THEN 1 ELSE 0 END) AS complete,
        SUM(CASE WHEN is_complete = 0 THEN 1 ELSE 0 END) AS incomplete,
        COUNT(DISTINCT category) AS categories_covered
      FROM survey_responses
      WHERE surveyor_username IS NOT NULL AND surveyor_username != ''
      GROUP BY surveyor_username ORDER BY total_submissions DESC
    `);
    return rows.map(r => ({
      agent: r.agent,
      totalSubmissions: parseInt(r.total_submissions),
      avgCompliance: parseFloat(r.avg_compliance) || 0,
      complete: parseInt(r.complete),
      incomplete: parseInt(r.incomplete),
      categoriesCovered: parseInt(r.categories_covered),
    }));
  }

  async getStatusDistribution() {
    const { rows } = await pool.query(`
      SELECT company_status AS status, COUNT(*) AS count
      FROM survey_responses
      WHERE company_status IS NOT NULL AND company_status != ''
      GROUP BY company_status ORDER BY count DESC
    `);
    return rows;
  }

  async getTopMissingFields() {
    const { rows } = await pool.query(`
      SELECT missing_fields
      FROM survey_responses
      WHERE missing_fields IS NOT NULL AND missing_fields != '[]'
    `);

    const totalResult = await pool.query('SELECT COUNT(*) AS cnt FROM survey_responses');
    const total = parseInt(totalResult.rows[0].cnt) || 1;

    const fieldCounts = {};
    for (const row of rows) {
      let fields = [];
      try {
        fields = typeof row.missing_fields === 'string'
          ? JSON.parse(row.missing_fields)
          : row.missing_fields;
      } catch { continue; }

      if (Array.isArray(fields)) {
        for (const f of fields) {
          fieldCounts[f] = (fieldCounts[f] || 0) + 1;
        }
      }
    }

    return Object.entries(fieldCounts)
      .map(([field, count]) => ({
        field,
        count,
        percentage: (count / total) * 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  async getLiveKpiFromArcGIS() {
    try {
      const totalCount = await arcgisService.queryCount();
      const categoryStats = await arcgisService.queryStats(
        [{ statisticType: 'count', onStatisticField: 'objectid', outStatisticFieldName: 'poi_count' }],
        'category'
      );
      const agentStats = await arcgisService.queryStats(
        [{ statisticType: 'count', onStatisticField: 'objectid', outStatisticFieldName: 'submission_count' }],
        'agent_name'
      );
      const statusStats = await arcgisService.queryStats(
        [{ statisticType: 'count', onStatisticField: 'objectid', outStatisticFieldName: 'cnt' }],
        'company_status'
      );
      return {
        totalCount,
        categories: categoryStats.features?.map(f => f.attributes) || [],
        agents: agentStats.features?.map(f => f.attributes) || [],
        statuses: statusStats.features?.map(f => f.attributes) || [],
      };
    } catch (err) {
      console.error('Live KPI error:', err.message);
      throw err;
    }
  }
}

module.exports = new KpiService();
