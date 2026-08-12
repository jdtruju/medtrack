import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseMock } from './mocks/supabaseMock';

vi.mock('../src/lib/supabaseClient', async () => {
  const { createSupabaseMock } = await import('./mocks/supabaseMock');
  return { supabase: createSupabaseMock() };
});

import { supabase } from '../src/lib/supabaseClient';
import { ResetPasswordPage } from '../src/pages/auth/ResetPasswordPage';

const supabaseMock = supabase as unknown as SupabaseMock;

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('HU-03 muestra error cuando el enlace ya expiro', async () => {
    supabaseMock.auth.updateUser.mockResolvedValue({
      data: {},
      error: { message: 'Token has expired or is invalid' },
    });
    render(<ResetPasswordPage />, { wrapper: BrowserRouter });

    fireEvent.change(screen.getByLabelText('Nueva contrasena'), { target: { value: 'Nueva1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contrasena' }));

    expect(await screen.findByText('Este enlace ha expirado. Por favor solicita uno nuevo.')).toBeInTheDocument();
  });

  it('HU-03 permite crear una nueva contrasena con un enlace vigente', async () => {
    supabaseMock.auth.updateUser.mockResolvedValue({ data: {}, error: null });
    render(<ResetPasswordPage />, { wrapper: BrowserRouter });

    fireEvent.change(screen.getByLabelText('Nueva contrasena'), { target: { value: 'Nueva1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contrasena' }));

    expect(await screen.findByText('Contraseña actualizada correctamente.')).toBeInTheDocument();
    expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith({ password: 'Nueva1234' });
  });
});
