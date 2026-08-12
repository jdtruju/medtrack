import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseMock } from './mocks/supabaseMock';

vi.mock('../src/lib/supabaseClient', async () => {
  const { createSupabaseMock } = await import('./mocks/supabaseMock');
  return { supabase: createSupabaseMock() };
});

import { supabase } from '../src/lib/supabaseClient';
import { ForgotPasswordPage } from '../src/pages/auth/ForgotPasswordPage';

const supabaseMock = supabase as unknown as SupabaseMock;

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('HU-03 envia el correo de recuperacion y muestra el mensaje generico', async () => {
    supabaseMock.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    render(<ForgotPasswordPage />, { wrapper: BrowserRouter });

    fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: 'ana@medtrack.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));

    expect(
      await screen.findByText('Si el correo existe, recibirás un enlace de recuperación.')
    ).toBeInTheDocument();
    expect(supabaseMock.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'ana@medtrack.test',
      expect.objectContaining({ redirectTo: expect.stringContaining('/reset-password') })
    );
  });
});
