import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

import { ForgotPasswordPage } from '../src/pages/auth/ForgotPasswordPage';

describe('ForgotPasswordPage', () => {
  it('HU-03 envia la solicitud y muestra el mensaje generico', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ message: 'Si el correo existe, recibiras un enlace de recuperacion.' }),
    });
    render(<ForgotPasswordPage />, { wrapper: BrowserRouter });

    fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: 'ana@medtrack.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));

    expect(await screen.findByText('Si el correo existe, recibiras un enlace de recuperacion.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/forgot-password'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});
