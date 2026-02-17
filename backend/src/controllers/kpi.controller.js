const kpiService = require('../services/kpi.service');

async function getSummary(req, res) {
  try {
    const { from, to } = req.query;
    const summary = await kpiService.getSummary(from, to);
    res.json({ success: true, data: summary });
  } catch (err) {
    console.error('KPI summary error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch KPI summary' });
  }
}

async function getDaily(req, res) {
  try {
    const { from, to } = req.query;
    const daily = await kpiService.getDailyStats(from, to);
    res.json({ success: true, data: daily });
  } catch (err) {
    console.error('KPI daily error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch daily stats' });
  }
}

async function getWeekly(req, res) {
  try {
    const { from, to } = req.query;
    const weekly = await kpiService.getWeeklyStats(from, to);
    res.json({ success: true, data: weekly });
  } catch (err) {
    console.error('KPI weekly error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch weekly stats' });
  }
}

async function getCategories(req, res) {
  try {
    const { from, to } = req.query;
    const categories = await kpiService.getCategoryDistribution(from, to);
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
}

async function getAgentPerformance(req, res) {
  try {
    const { from, to } = req.query;
    const agents = await kpiService.getAgentPerformance(from, to);
    res.json({ success: true, data: agents });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch agent performance' });
  }
}

async function getStatusDistribution(req, res) {
  try {
    const { from, to } = req.query;
    const statuses = await kpiService.getStatusDistribution(from, to);
    res.json({ success: true, data: statuses });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch status distribution' });
  }
}

async function getMissingFields(req, res) {
  try {
    const { from, to } = req.query;
    const data = await kpiService.getTopMissingFields(from, to);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch missing fields' });
  }
}

async function getLiveKpi(req, res) {
  try {
    const live = await kpiService.getLiveKpiFromArcGIS();
    res.json({ success: true, data: live });
  } catch (err) {
    console.error('Live KPI error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch live KPIs from ArcGIS' });
  }
}

module.exports = {
  getSummary, getDaily, getWeekly,
  getCategories, getAgentPerformance, getStatusDistribution,
  getMissingFields, getLiveKpi,
};
