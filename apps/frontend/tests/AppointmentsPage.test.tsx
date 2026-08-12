import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
const confirmMock = vi.fn(() => true);

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('confirm', confirmMock);
  localStorage.setItem('medtrack.token', 'paciente-token');
  localStorage.setItem(
    'medtrack.user',
    JSON.stringify({ id: 'p1', email: 'ana@medtrack.test', nombre: 'Ana', apellido: 'Mora', rol: 'PACIENTE' })
  );
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  confirmMock.mockClear();
});

import { AuthProvider } from '../src/context/AuthContext';
import { AppointmentsPage } from '../src/pages/patient/AppointmentsPage';

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  fetchMock.mockResolvedValueOnce({ ok, status, json: async () => body });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <AppointmentsPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

const citaBase = {
  id: 'c1',
  pacienteId: 'p1',
  medicoId: 'med-1',
  especialidadId: 'esp-1',
  fechaHora: '2026-07-16T10:00',
  estado: 'CONFIRMADA',
};

describe('AppointmentsPage', () => {
  it('lista las citas del paciente', async () => {
    mockJsonResponse({ medicos: [{ id: 'med-1', nombre: 'Dr', apellido: 'Lopez', especialidadId: 'esp-1' }] });
    mockJsonResponse({ citas: [citaBase] });

    renderPage();

    expect(await screen.findByText(/Dr Lopez/)).toBeInTheDocument();
    expect(screen.getByText(/2026-07-16/)).toBeInTheDocument();
  });

  it('HU-09 cancela una cita con confirmacion', async () => {
    mockJsonResponse({ medicos: [{ id: 'med-1', nombre: 'Dr', apellido: 'Lopez', especialidadId: 'esp-1' }] });
    mockJsonResponse({ citas: [citaBase] });

    renderPage();
    await screen.findByText(/Dr Lopez/);

    mockJsonResponse({ message: 'Tu cita ha sido cancelada.' });
    mockJsonResponse({ medicos: [{ id: 'med-1', nombre: 'Dr', apellido: 'Lopez', especialidadId: 'esp-1' }] });
    mockJsonResponse({ citas: [{ ...citaBase, estado: 'CANCELADA' }] });

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(confirmMock).toHaveBeenCalled());
    expect(await screen.findByText('CANCELADA')).toBeInTheDocument();
  });

  it('HU-08 reprograma una cita a una nueva franja', async () => {
    mockJsonResponse({ medicos: [{ id: 'med-1', nombre: 'Dr', apellido: 'Lopez', especialidadId: 'esp-1' }] });
    mockJsonResponse({ citas: [citaBase] });

    renderPage();
    await screen.findByText(/Dr Lopez/);

    fireEvent.click(screen.getByRole('button', { name: 'Reprogramar' }));

    mockJsonResponse({ franjas: ['11:00', '11:30'] });
    fireEvent.change(screen.getByLabelText('Nueva fecha'), { target: { value: '2026-07-16' } });

    await waitFor(() => expect(screen.getByLabelText('Nueva hora')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Nueva hora'), { target: { value: '11:00' } });

    mockJsonResponse({ message: 'Tu cita ha sido reprogramada exitosamente.', cita: { ...citaBase, fechaHora: '2026-07-16T11:00' } }, true, 200);
    mockJsonResponse({ medicos: [{ id: 'med-1', nombre: 'Dr', apellido: 'Lopez', especialidadId: 'esp-1' }] });
    mockJsonResponse({ citas: [{ ...citaBase, fechaHora: '2026-07-16T11:00' }] });

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar nueva fecha' }));

    expect(await screen.findByText('Tu cita ha sido reprogramada exitosamente.')).toBeInTheDocument();
  });
});
