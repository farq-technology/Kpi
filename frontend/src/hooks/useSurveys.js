import { useState, useEffect, useCallback } from 'react';
import * as surveysApi from '../api/surveys.api';

export function useSurveys(params = {}) {
  const [data, setData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await surveysApi.getSurveys(params);
      setData(res.data || []);
      setPagination(res.pagination || { page: 1, total: 0, totalPages: 0 });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(params)]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, pagination, loading, error, refetch: fetchData };
}
