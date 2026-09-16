import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, User } from '../api/client';

interface AuthContextValue {
  user:    User | null;
  token:   string | null;
  loading: boolean;
  login:   (email: string, motDePasse: string) => Promise<void>;
  register:(nom: string, email: string, motDePasse: string) => Promise<void>;
  logout:  () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User | null>(null);
  const [token,   setToken]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('qhse_token');
    if (stored) {
      setToken(stored);
      authApi.me()
        .then(setUser)
        .catch(() => { localStorage.removeItem('qhse_token'); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, motDePasse: string) => {
    const res = await authApi.login(email, motDePasse);
    localStorage.setItem('qhse_token', res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const register = async (nom: string, email: string, motDePasse: string) => {
    const res = await authApi.register(nom, email, motDePasse);
    localStorage.setItem('qhse_token', res.token);
    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    localStorage.removeItem('qhse_token');
    setToken(null);
    setUser(null);
  };

  // Auto-logout quand le token expire (événement déclenché par le client API)
  useEffect(() => {
    const handler = () => { setUser(null); setToken(null); };
    window.addEventListener('qhse:session-expired', handler);
    return () => window.removeEventListener('qhse:session-expired', handler);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
