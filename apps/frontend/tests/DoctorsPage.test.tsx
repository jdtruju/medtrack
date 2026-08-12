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
import { DoctorsPage } from '../src/pages/admin/DoctorsPage';

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  fetchMock.mockResolvedValueOnce({ ok, status, json: async () => body });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <DoctorsPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('DoctorsPage', () => {
  it('HU-04 registra un medico con la especialidad seleccionada', async () => {
    mockJsonResponse({ especialidades: [{ id: 'esp-1', nombre: 'Cardiología' }] });
    mockJsonResponse({ medicos: [] });
    renderPage();

    await waitFor(() => expect(screen.getAllByText('Cardiología').length).toBeGreaterThan(0));

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Elena' } });
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Campos' } });
    fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: 'elena@medtrack.test' } });
    fireEvent.change(screen.getByLabelText('Numero de licencia'), { target: { value: 'MED-123' } });
    fireEvent.change(screen.getByLabelText('Especialidad'), { target: { value: 'esp-1' } });

    mockJsonResponse({ message: 'Médico registrado correctamente.' }, true, 201);
    mockJsonResponse({ especialidades: [{ id: 'esp-1', nombre: 'Cardiología' }] });
    mockJsonResponse({ medicos: [{ id: 'med-1', nombre: 'Elena', apellido: 'Campos', email: 'elena@medtrack.test', licencia: 'MED-123', especialidadId: 'esp-1' }] });

    fireEvent.click(screen.getByRole('button', { name: 'Registrar medico' }));

    expect(await screen.findByText('Médico registrado correctamente.')).toBeInTheDocument();
  });

  it('HU-04 muestra el error de licencia duplicada que devuelve el backend', async () => {
    mockJsonResponse({ especialidades: [{ id: 'esp-1', nombre: 'Cardiología' }] });
    mockJsonResponse({ medicos: [] });
    renderPage();

    await waitFor(() => expect(screen.getAllByText('Cardiología').length).toBeGreaterThan(0));

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Elena' } });
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Campos' } });
    fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: 'elena@medtrack.test' } });
    fireEvent.change(screen.getByLabelText('Numero de licencia'), { target: { value: 'MED-123' } });
    fireEvent.change(screen.getByLabelText('Especialidad'), { target: { value: 'esp-1' } });

    mockJsonResponse({ error: 'Ya existe un médico con esta cédula profesional.' }, false, 409);

    fireEvent.click(screen.getByRole('button', { name: 'Registrar medico' }));

    expect(await screen.findByText('Ya existe un médico con esta cédula profesional.')).toBeInTheDocument();
  });
});