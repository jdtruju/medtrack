import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import type { RolUsuario } from '@medtrack/shared';
import { supabase } from '../lib/supabaseClient';

export interface SessionUser {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: RolUsuario;
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadProfile(userId: string, email: string): Promise<SessionUser | null> {
  const { data, error } = await supabase
    .from('perfiles')
    .select('nombre, apellido, rol')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return { id: userId, email, nombre: data.nombre, apellido: data.apellido, rol: data.rol };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshProfile() {
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session) {
      setUser(null);
      return;
    }

    const profile = await loadProfile(session.user.id, session.user.email ?? '');
    setUser(profile);
  }

  useEffect(() => {
    refreshProfile().finally(() => setLoading(false));

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      refreshProfile();
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, refreshProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}
