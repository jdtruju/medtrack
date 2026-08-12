import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseMock } from './mocks/supabaseMock';

vi.mock('../src/lib/supabaseClient', async () => {
  const { createSupabaseMock } = await import('./mocks/supabaseMock');
  return { supabase: createSupabaseMock() };
});

import { supabase } from '../src/lib/supabaseClient';
import { RegisterPage } from '../src/pages/auth/RegisterPage';

const supabaseMock = supabase as unknown as SupabaseMock;

function fillForm(overrides: Record<string, string> = {}) {
  const values = {
    nombre: 'Ana',
    apellido: 'Mora',
    email: 'ana@medtrack.test',
    password: 'Segura123',
    ...overrides,
  };

  if (values.nombre) fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: values.nombre } });
  fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: values.apellido } });
  fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: values.email } });
  fireEvent.change(screen.getByLabelText('Contrasena'), { target: { value: values.password } });
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('HU-01 muestra confirmacion cuando el registro es exitoso', async () => {
    supabaseMock.auth.signUp.mockResolvedValue({ data: {}, error: null });
    render(<RegisterPage />, { wrapper: BrowserRouter });

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Registrarme' }));

    expect(await screen.findByText('Cuenta creada exitosamente. Bienvenido a MedTrack.')).toBeInTheDocument();
    expect(supabaseMock.auth.signUp).toHaveBeenCalledWith({
      email: 'ana@medtrack.test',
      password: 'Segura123',
      options: { data: { nombre: 'Ana', apellido: 'Mora', telefono: '' } },
    });
  });

  it('HU-01 muestra error de correo duplicado', async () => {
    supabaseMock.auth.signUp.mockResolvedValue({
      data: {},
      error: { message: 'User already registered' },
    });
    render(<RegisterPage />, { wrapper: BrowserRouter });

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Registrarme' }));

    expect(
      await screen.findByText('Este correo ya está registrado. Por favor inicia sesión o usa otro correo.')
    ).toBeInTheDocument();
  });

  it('HU-01 exige el nombre antes de llamar a Supabase', async () => {
    render(<RegisterPage />, { wrapper: BrowserRouter });

    fillForm({ nombre: '' });
    fireEvent.click(screen.getByRole('button', { name: 'Registrarme' }));

    expect(await screen.findByText('El nombre es un campo obligatorio.')).toBeInTheDocument();
    expect(supabaseMock.auth.signUp).not.toHaveBeenCalled();
  });
});
