import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  window.location.hash = '#access_token=abc123&type=recovery';
});

import { ResetPasswordPage } from '../src/pages/auth/ResetPasswordPage';

describe('ResetPasswordPage', () => {
  it('HU-03 muestra error cuando el backend rechaza el token', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Este enlace ha expirado. Por favor solicita uno nuevo.' }),
    });
    render(<ResetPasswordPage />, { wrapper: BrowserRouter });

    fireEvent.change(screen.getByLabelText('Nueva contrasena'), { target: { value: 'Nueva1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contrasena' }));

    expect(await screen.findByText('Este enlace ha expirado. Por favor solicita uno nuevo.')).toBeInTheDocument();
  });

  it('HU-03 permite crear una nueva contrasena y manda el access_token del fragmento de la URL', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ message: 'Contraseña actualizada correctamente.' }),
    });
    render(<ResetPasswordPage />, { wrapper: BrowserRouter });

    fireEvent.change(screen.getByLabelText('Nueva contrasena'), { target: { value: 'Nueva1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contrasena' }));

    expect(await screen.findByText('Contraseña actualizada correctamente.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/reset-password'),
      expect.objectContaining({ body: JSON.stringify({ accessToken: 'abc123', password: 'Nueva1234' }) })
    );
  });
});
