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

import { DoctorsPage } from '../src/pages/admin/DoctorsPage';

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  fetchMock.mockResolvedValueOnce({ ok, status, json: async () => body });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <DoctorsPage />
    </MemoryRouter>
  );
}

describe('DoctorsPage', () => {
  it('HU-04 registra un medico con la especialidad seleccionada', async () => {
    mockJsonResponse({ especialidades: [{ id: 'esp-1', nombre: 'Cardiologia' }] });
    mockJsonResponse({ message: 'Medico registrado correctamente.' }, true, 201);
    renderPage();

    await waitFor(() => expect(screen.getAllByText('Cardiologia').length).toBeGreaterThan(0));

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Elena' } });
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Campos' } });
    fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: 'elena@medtrack.test' } });
    fireEvent.change(screen.getByLabelText('Numero de licencia'), { target: { value: 'MED-123' } });
    fireEvent.change(screen.getByLabelText('Especialidad'), { target: { value: 'esp-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar medico' }));

    expect(await screen.findByText('Medico registrado correctamente.')).toBeInTheDocument();
  });

  it('HU-04 muestra el error de licencia duplicada que devuelve el backend', async () => {
    mockJsonResponse({ especialidades: [{ id: 'esp-1', nombre: 'Cardiologia' }] });
    mockJsonResponse({ error: 'Ya existe un medico con esta cedula profesional.' }, false, 409);
    renderPage();

    await waitFor(() => expect(screen.getAllByText('Cardiologia').length).toBeGreaterThan(0));

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Elena' } });
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Campos' } });
    fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: 'elena@medtrack.test' } });
    fireEvent.change(screen.getByLabelText('Numero de licencia'), { target: { value: 'MED-123' } });
    fireEvent.change(screen.getByLabelText('Especialidad'), { target: { value: 'esp-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar medico' }));

    expect(await screen.findByText('Ya existe un medico con esta cedula profesional.')).toBeInTheDocument();
  });
});
