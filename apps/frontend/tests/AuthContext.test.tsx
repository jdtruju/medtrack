import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseMock } from './mocks/supabaseMock';

vi.mock('../src/lib/supabaseClient', async () => {
  const { createSupabaseMock } = await import('./mocks/supabaseMock');
  return { supabase: createSupabaseMock() };
});

import { supabase } from '../src/lib/supabaseClient';
import { AuthProvider, useAuth } from '../src/context/AuthContext';

const supabaseMock = supabase as unknown as SupabaseMock;

function Probe() {
  const { user, loading } = useAuth();
  if (loading) return <p>cargando</p>;
  return <p>{user ? `${user.nombre} (${user.rol})` : 'sin sesion'}</p>;
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null } });
    supabaseMock.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  it('expone user en null cuando no hay sesion', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText('sin sesion')).toBeInTheDocument());
  });

  it('carga el perfil desde la tabla perfiles cuando hay sesion', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1', email: 'ana@medtrack.test' } } },
    });
    const single = vi.fn().mockResolvedValue({
      data: { nombre: 'Ana', apellido: 'Mora', rol: 'PACIENTE' },
      error: null,
    });
    supabaseMock.from.mockReturnValue({
      select: () => ({ eq: () => ({ single }) }),
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText('Ana (PACIENTE)')).toBeInTheDocument());
  });
});
