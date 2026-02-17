import { useState, useEffect, useCallback } from 'react';
import * as kpiApi from '../api/kpi.api';

export function useKpiData(dateFrom, dateTo) {
  const [summary, setSummary] = useState(null);
  const [daily, setDaily] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [categories, setCategories] = useState([]);
  const [agents, setAgents] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [missingFields, setMissingFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [summaryRes, dailyRes, weeklyRes, catRes, agentRes, statusRes, missingRes] = await Promise.all([
        kpiApi.getKpiSummary(dateFrom, dateTo),
        kpiApi.getDailyStats(dateFrom, dateTo),
        kpiApi.getWeeklyStats(dateFrom, dateTo),
        kpiApi.getCategoryDistribution(dateFrom, dateTo),
        kpiApi.getAgentPerformance(dateFrom, dateTo),
        kpiApi.getStatusDistribution(dateFrom, dateTo),
        kpiApi.getMissingFields(dateFrom, dateTo),
      ]);

      setSummary(summaryRes.data);
      setDaily(dailyRes.data || []);
      setWeekly(weeklyRes.data || []);
      setCategories(catRes.data || []);
      setAgents(agentRes.data || []);
      setStatuses(statusRes.data || []);
      setMissingFields(missingRes.data || []);
    } catch (err) {
      console.error('Error fetching KPI data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    summary, daily, weekly, categories, agents, statuses, missingFields,
    loading, error, refetch: fetchData,
  };
}
