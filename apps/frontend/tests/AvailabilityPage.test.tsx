import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseMock } from './mocks/supabaseMock';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  localStorage.setItem('medtrack.token', 'paciente-token');
  localStorage.setItem(
    'medtrack.user',
    JSON.stringify({ id: 'p1', email: 'ana@medtrack.test', nombre: 'Ana', apellido: 'Mora', rol: 'PACIENTE' })
  );
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
});

vi.mock('../src/lib/supabaseClient', async () => {
  const { createSupabaseMock } = await import('./mocks/supabaseMock');
  return { supabase: createSupabaseMock() };
});

import { supabase } from '../src/lib/supabaseClient';
import { AuthProvider } from '../src/context/AuthContext';
import { AvailabilityPage } from '../src/pages/patient/AvailabilityPage';

const supabaseMock = supabase as unknown as SupabaseMock;

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  fetchMock.mockResolvedValueOnce({ ok, status, json: async () => body });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <AvailabilityPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('AvailabilityPage', () => {
  it('HU-06 muestra los horarios disponibles filtrados por especialidad', async () => {
    mockJsonResponse({ especialidades: [{ id: 'esp-1', nombre: 'Cardiología' }] });
    mockJsonResponse({ medicos: [{ id: 'med-1', nombre: 'Dr', apellido: 'Lopez', especialidadId: 'esp-1' }] });
    mockJsonResponse({ horarios: [{ id: 'h1', medicoId: 'med-1', diaSemana: 'LUN', horaInicio: '08:00', horaFin: '12:00' }] });

    renderPage();

    expect(await screen.findByText(/Dr Lopez/)).toBeInTheDocument();
    expect(screen.getByText(/LUN 08:00 - 12:00/)).toBeInTheDocument();
  });

  it('HU-06 filtra por especialidad seleccionada', async () => {
    mockJsonResponse({ especialidades: [{ id: 'esp-1', nombre: 'Cardiología' }, { id: 'esp-2', nombre: 'Pediatría' }] });
    mockJsonResponse({ medicos: [{ id: 'med-1', nombre: 'Dr', apellido: 'Lopez', especialidadId: 'esp-1' }] });
    mockJsonResponse({ horarios: [{ id: 'h1', medicoId: 'med-1', diaSemana: 'LUN', horaInicio: '08:00', horaFin: '12:00' }] });

    renderPage();
    await screen.findByText(/Dr Lopez/);

    mockJsonResponse({ especialidades: [{ id: 'esp-1', nombre: 'Cardiología' }, { id: 'esp-2', nombre: 'Pediatría' }] });
    mockJsonResponse({ medicos: [{ id: 'med-1', nombre: 'Dr', apellido: 'Lopez', especialidadId: 'esp-1' }] });
    mockJsonResponse({ horarios: [] });
    fireEvent.change(screen.getByLabelText('Especialidad'), { target: { value: 'esp-2' } });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('especialidadId=esp-2'), expect.anything())
    );
  });

  it('HU-06 se suscribe a Realtime y refresca cuando llega un cambio', async () => {
    mockJsonResponse({ especialidades: [] });
    mockJsonResponse({ medicos: [] });
    mockJsonResponse({ horarios: [] });

    renderPage();
    await waitFor(() => expect(supabaseMock.channel).toHaveBeenCalledWith('horarios-disponibilidad'));

    const channelInstance = supabaseMock.channel.mock.results[0]!.value;
    const changeHandler = channelInstance.on.mock.calls[0]![2];

    mockJsonResponse({ especialidades: [] });
    mockJsonResponse({ medicos: [] });
    mockJsonResponse({ horarios: [{ id: 'h2', medicoId: 'med-2', diaSemana: 'MAR', horaInicio: '09:00', horaFin: '10:00' }] });

    changeHandler();

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(6));
  });
});
