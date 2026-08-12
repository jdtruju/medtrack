import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SchedulesPage } from '../src/pages/admin/SchedulesPage';

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
  localStorage.clear();
});

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  fetchMock.mockResolvedValueOnce({ ok, status, json: async () => body });
}

describe('SchedulesPage', () => {
  it('HU-05 crea un horario para el medico seleccionado', async () => {
    mockJsonResponse({ medicos: [{ id: 'med-1', nombre: 'Elena', apellido: 'Campos' }] });
    mockJsonResponse({ horarios: [] });
    mockJsonResponse(
      {
        message: 'Horario creado correctamente.',
        horario: { id: 'hor-1', medicoId: 'med-1', diaSemana: 'LUN', horaInicio: '08:00', horaFin: '12:00' },
      },
      true,
      201
    );

    render(
      <MemoryRouter>
        <SchedulesPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText('Dr Elena Campos')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Medico'), { target: { value: 'med-1' } });
    fireEvent.change(screen.getByLabelText('Dia'), { target: { value: 'LUN' } });
    fireEvent.change(screen.getByLabelText('Hora inicio'), { target: { value: '08:00' } });
    fireEvent.change(screen.getByLabelText('Hora fin'), { target: { value: '12:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar horario' }));

    expect(await screen.findByText('Horario creado correctamente.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/horarios'), expect.objectContaining({ method: 'POST' }));
  });
});
