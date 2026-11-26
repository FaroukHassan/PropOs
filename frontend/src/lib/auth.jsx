// frontend/src/lib/auth.jsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, tokenStore, setUnauthorizedHandler } from './api';

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

  const can = { write: user && user.role !== 'VIEWER', admin: user?.role === 'ADMIN' };
  return <AuthCtx.Provider value={{ user, loading, login, logout, can }}>{children}</AuthCtx.Provider>;
}
