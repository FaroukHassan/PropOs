// frontend/src/hooks/useFetch.js
import { useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';

/**
 * Generic data-fetching hook.
 * @param {string} path - API path, e.g. '/properties'
 * @param {any[]}  deps - extra dependencies that trigger a refetch
 */
export function useFetch(path, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get(path);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, refetch: load };
}
