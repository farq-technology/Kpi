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

export const getCategoryDistribution = (from, to) => {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  return client.get('/kpi/categories', { params });
};

export const getAgentPerformance = (from, to) => {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  return client.get('/kpi/agents', { params });
};

export const getStatusDistribution = (from, to) => {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  return client.get('/kpi/statuses', { params });
};

export const getMissingFields = (from, to) => {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  return client.get('/kpi/missing-fields', { params });
};

export const getLiveKpi = () =>
  client.get('/kpi/live');
