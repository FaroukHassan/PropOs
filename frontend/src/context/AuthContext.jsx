// frontend/src/context/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';
import { DEMO_USER, DEMO_TOKEN } from '../utils/demoData';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    // Demo mode: restore user instantly
    if (token === DEMO_TOKEN) { setUser(DEMO_USER); setLoading(false); return; }
    api.get('/auth/me')
      .then(data => setUser(data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const data = await api.post('/auth/register', payload);
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data.user;
  };

  const loginDemo = () => {
    localStorage.setItem('token', DEMO_TOKEN);
    setUser(DEMO_USER);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginDemo, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
