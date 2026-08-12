import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear();
  window.history.pushState({}, '', '/');
});

vi.mock('../src/lib/supabaseClient', async () => {
  const { createSupabaseMock } = await import('./mocks/supabaseMock');
  return { supabase: createSupabaseMock() };
});

import App from '../src/App';

describe('App', () => {
  it('renderiza la pantalla de login por defecto', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Inicio de sesion' })).toBeInTheDocument();
  });
});
