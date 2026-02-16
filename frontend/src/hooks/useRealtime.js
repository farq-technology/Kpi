import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../api/client';

export function useRealtime() {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);

  useEffect(() => {
    const url = `${API_BASE}/api/v1/events`;
    const source = new EventSource(url);

    source.addEventListener('connected', () => {
      setConnected(true);
    });

    source.addEventListener('kpi:updated', (e) => {
      setLastEvent({ type: 'kpi:updated', data: JSON.parse(e.data), time: Date.now() });
    });

    source.addEventListener('survey:new', (e) => {
      setLastEvent({ type: 'survey:new', data: JSON.parse(e.data), time: Date.now() });
    });

    source.addEventListener('media:ready', (e) => {
      setLastEvent({ type: 'media:ready', data: JSON.parse(e.data), time: Date.now() });
    });

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);

    return () => {
      source.close();
      setConnected(false);
    };
  }, []);

  return { connected, lastEvent };
}
