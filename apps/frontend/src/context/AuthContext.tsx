import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { apiRequest, clearSession, getSession, saveSession, type SessionUser } from '../lib/api';

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { user: storedUser } = getSession();
    setUser(storedUser);
    setLoading(false);
  }, []);

  async function login(email: string, password: string) {
    const response = await apiRequest<{ token: string; usuario: SessionUser }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    saveSession(response.token, response.usuario);
    setUser(response.usuario);
  }

  function logout() {
    clearSession();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}
