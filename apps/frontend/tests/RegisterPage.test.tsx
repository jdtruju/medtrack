import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

import { RegisterPage } from '../src/pages/auth/RegisterPage';

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  fetchMock.mockResolvedValueOnce({ ok, status, json: async () => body });
}

function fillForm(overrides: Record<string, string> = {}) {
  const values = { nombre: 'Ana', apellido: 'Mora', email: 'ana@medtrack.test', password: 'Segura123', ...overrides };
  if (values.nombre) fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: values.nombre } });
  fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: values.apellido } });
  fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: values.email } });
  fireEvent.change(screen.getByLabelText('Contrasena'), { target: { value: values.password } });
}

describe('RegisterPage', () => {
  it('HU-01 muestra confirmacion cuando el registro es exitoso', async () => {
    mockJsonResponse({ message: 'Cuenta creada exitosamente. Bienvenido a MedTrack.' }, true, 201);
    render(<RegisterPage />, { wrapper: BrowserRouter });

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Registrarme' }));

    expect(await screen.findByText('Cuenta creada exitosamente. Bienvenido a MedTrack.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/register'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('HU-01 muestra error de correo duplicado', async () => {
    mockJsonResponse(
      { error: 'Este correo ya esta registrado. Por favor inicia sesion o usa otro correo.' },
      false,
      409
    );
    render(<RegisterPage />, { wrapper: BrowserRouter });

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Registrarme' }));

    expect(
      await screen.findByText('Este correo ya esta registrado. Por favor inicia sesion o usa otro correo.')
    ).toBeInTheDocument();
  });

  it('HU-01 muestra el error de nombre obligatorio que devuelve el backend', async () => {
    mockJsonResponse({ error: 'El nombre es un campo obligatorio.' }, false, 400);
    render(<RegisterPage />, { wrapper: BrowserRouter });

    fillForm({ nombre: '   ' });
    fireEvent.click(screen.getByRole('button', { name: 'Registrarme' }));

    expect(await screen.findByText('El nombre es un campo obligatorio.')).toBeInTheDocument();
  });
});
