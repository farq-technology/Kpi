import { useState, useEffect } from 'react';
import * as surveysApi from '../api/surveys.api';

export function useNeedsReviewCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    surveysApi
      .getSurveys({ needsReview: true, limit: 1, page: 1 })
      .then((res) => {
        if (!cancelled && res.pagination) {
          setCount(res.pagination.total || 0);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return count;
}
