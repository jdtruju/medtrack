import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear();
});

import { AuthProvider, useAuth } from '../src/context/AuthContext';

function Probe() {
  const { user, loading } = useAuth();
  if (loading) return <p>cargando</p>;
  return <p>{user ? `${user.nombre} (${user.rol})` : 'sin sesion'}</p>;
}

describe('AuthContext', () => {
  it('expone user en null cuando no hay sesion guardada', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText('sin sesion')).toBeInTheDocument());
  });

  it('lee la sesion guardada en localStorage al montar', async () => {
    localStorage.setItem('medtrack.token', 'token-1');
    localStorage.setItem(
      'medtrack.user',
      JSON.stringify({ id: 'user-1', email: 'ana@medtrack.test', nombre: 'Ana', apellido: 'Mora', rol: 'PACIENTE' })
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText('Ana (PACIENTE)')).toBeInTheDocument());
  });
});
