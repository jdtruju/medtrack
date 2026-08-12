import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseMock } from './mocks/supabaseMock';

vi.mock('../src/lib/supabaseClient', async () => {
  const { createSupabaseMock } = await import('./mocks/supabaseMock');
  return { supabase: createSupabaseMock() };
});

import { supabase } from '../src/lib/supabaseClient';
import App from '../src/App';

const supabaseMock = supabase as unknown as SupabaseMock;

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null } });
    supabaseMock.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    window.history.pushState({}, '', '/');
  });

  it('renderiza la pantalla de login por defecto', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Inicio de sesion' })).toBeInTheDocument();
  });
});
