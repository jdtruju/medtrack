import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseMock } from './mocks/supabaseMock';

vi.mock('../src/lib/supabaseClient', async () => {
  const { createSupabaseMock } = await import('./mocks/supabaseMock');
  return { supabase: createSupabaseMock() };
});

import { supabase } from '../src/lib/supabaseClient';
import { LoginPage } from '../src/pages/auth/LoginPage';

const supabaseMock = supabase as unknown as SupabaseMock;

function fillAndSubmit(email = 'ana@medtrack.test', password = 'Segura123') {
  fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Contrasena'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.rpc.mockImplementation((fn: string) => {
      if (fn === 'check_login_lock') {
        return Promise.resolve({ data: { bloqueado: false, bloqueado_hasta: null, intentos: 0 }, error: null });
      }
      return Promise.resolve({ data: { bloqueado: false, intentos: 1 }, error: null });
    });
  });

  it('HU-02 autentica con credenciales validas y navega segun el rol', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    const single = vi.fn().mockResolvedValue({ data: { rol: 'PACIENTE' }, error: null });
    supabaseMock.from.mockReturnValue({ select: () => ({ eq: () => ({ single }) }) });

    render(<LoginPage />, { wrapper: MemoryRouter });
    fillAndSubmit();

    expect(await screen.findByText(/inicio de sesion exitoso/i)).toBeInTheDocument();
  });

  it('HU-02 rechaza credenciales incorrectas mostrando el contador de intentos', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials' },
    });
    supabaseMock.rpc.mockImplementation((fn: string) => {
      if (fn === 'check_login_lock') {
        return Promise.resolve({ data: { bloqueado: false, bloqueado_hasta: null, intentos: 0 }, error: null });
      }
      return Promise.resolve({ data: { bloqueado: false, intentos: 2 }, error: null });
    });

    render(<LoginPage />, { wrapper: MemoryRouter });
    fillAndSubmit();

    expect(await screen.findByText('Correo o contraseña incorrectos. Intento 2 de 5.')).toBeInTheDocument();
  });

  it('HU-02 bloquea la cuenta cuando check_login_lock indica bloqueo activo', async () => {
    supabaseMock.rpc.mockImplementation((fn: string) => {
      if (fn === 'check_login_lock') {
        return Promise.resolve({
          data: { bloqueado: true, bloqueado_hasta: new Date().toISOString(), intentos: 5 },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    render(<LoginPage />, { wrapper: MemoryRouter });
    fillAndSubmit();

    expect(
      await screen.findByText('Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.')
    ).toBeInTheDocument();
    expect(supabaseMock.auth.signInWithPassword).not.toHaveBeenCalled();
  });
});
