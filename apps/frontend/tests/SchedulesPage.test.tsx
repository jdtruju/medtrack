import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  localStorage.setItem('medtrack.token', 'admin-token');
  localStorage.setItem(
    'medtrack.user',
    JSON.stringify({ id: 'admin-1', email: 'admin@medtrack.test', nombre: 'Admin', apellido: 'QA', rol: 'ADMIN' })
  );
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
});

import { AuthProvider } from '../src/context/AuthContext';
import { SchedulesPage } from '../src/pages/admin/SchedulesPage';

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  fetchMock.mockResolvedValueOnce({ ok, status, json: async () => body });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <SchedulesPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('SchedulesPage', () => {
  it('HU-05 crea un horario para el medico seleccionado', async () => {
    mockJsonResponse({ medicos: [{ id: 'med-1', nombre: 'Dr', apellido: 'Lopez' }] });
    mockJsonResponse({ horarios: [] });
    mockJsonResponse({ message: 'Horario creado correctamente.', horario: { id: 'h1' } }, true, 201);
    mockJsonResponse({ horarios: [{ id: 'h1', medicoId: 'med-1', diaSemana: 'LUN', horaInicio: '08:00', horaFin: '12:00' }] });

    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Medico')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Medico'), { target: { value: 'med-1' } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    fireEvent.change(screen.getByLabelText('Dia'), { target: { value: 'LUN' } });
    fireEvent.change(screen.getByLabelText('Hora inicio'), { target: { value: '08:00' } });
    fireEvent.change(screen.getByLabelText('Hora fin'), { target: { value: '12:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar horario' }));

    expect(await screen.findByText('Horario creado correctamente.')).toBeInTheDocument();
  });

  it('HU-05 elimina un horario existente', async () => {
    mockJsonResponse({ medicos: [{ id: 'med-1', nombre: 'Dr', apellido: 'Lopez' }] });
    mockJsonResponse({ horarios: [{ id: 'h1', medicoId: 'med-1', diaSemana: 'LUN', horaInicio: '08:00', horaFin: '12:00' }] });

    renderPage();
    fireEvent.change(await screen.findByLabelText('Medico'), { target: { value: 'med-1' } });

    await screen.findByText(/LUN 08:00 - 12:00/);

    mockJsonResponse({ message: 'Horario eliminado correctamente.' });
    mockJsonResponse({ horarios: [] });

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(screen.queryByText(/LUN 08:00 - 12:00/)).not.toBeInTheDocument());
  });
});
