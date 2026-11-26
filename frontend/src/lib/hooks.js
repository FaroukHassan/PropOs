// frontend/src/lib/hooks.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './api';

// Load data from the API; refetch() reloads; reloads when `path` changes
export function useApi(path) {
  const [state, setState] = useState({ data: null, loading: !!path, error: null });
  const latest = useRef(path);
  const load = useCallback(async () => {
    if (!path) return;
    latest.current = path;
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await api.get(path);
      if (latest.current === path) setState({ data, loading: false, error: null });
    } catch (e) {
      if (latest.current === path) setState(s => ({ ...s, loading: false, error: e.message }));
    }
  }, [path]);
  useEffect(() => { load(); }, [load]);
  return { ...state, refetch: load };
}

// Remember a small UI choice (month, tab, filter) per browser
export function useSticky(key, initial) {
  const [v, setV] = useState(() => {
    try { const s = localStorage.getItem(`propos_${key}`); return s !== null ? JSON.parse(s) : initial; } catch { return initial; }
  });
  const set = useCallback(x => {
    setV(x);
    try { localStorage.setItem(`propos_${key}`, JSON.stringify(x)); } catch { /* ignore */ }
  }, [key]);
  return [v, set];
}
