// frontend/src/lib/auth.jsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { api, tokenStore, setUnauthorizedHandler } from './api';
import { sectionOf } from './access';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokenStore.get());

  const logout = useCallback(() => { tokenStore.set(null); setUser(null); }, []);
  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);

  useEffect(() => {
    if (!tokenStore.get()) return;
    api.get('/auth/me').then(setUser).catch(() => tokenStore.set(null)).finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { token, user } = await api.post('/auth/login', { email, password });
    tokenStore.set(token);
    setUser(user);
  };

  const { pathname } = useLocation();
  const access = user?.access || {};
  const admin = user?.role === 'ADMIN';
  const view = section => admin || ['view', 'edit'].includes(access[section]);
  const edit = section => admin || access[section] === 'edit';
  // `write` follows the screen you're on, so every page's add/edit buttons obey that section's access
  const here = sectionOf(pathname);
  const can = { admin, view, edit, write: !!user && (here ? edit(here) : user.role !== 'VIEWER') };
  return <AuthCtx.Provider value={{ user, loading, login, logout, can }}>{children}</AuthCtx.Provider>;
}
