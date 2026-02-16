import client from './client';

export const getKpiSummary = (from, to) => {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  return client.get('/kpi/summary', { params });
};

export const getDailyStats = (from, to) => {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  return client.get('/kpi/daily', { params });
};

export const getWeeklyStats = (from, to) => {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  return client.get('/kpi/weekly', { params });
};

export const getCategoryDistribution = () =>
  client.get('/kpi/categories');

export const getAgentPerformance = () =>
  client.get('/kpi/agents');

export const getStatusDistribution = () =>
  client.get('/kpi/statuses');

export const getMissingFields = () =>
  client.get('/kpi/missing-fields');

export const getLiveKpi = () =>
  client.get('/kpi/live');
