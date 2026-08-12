import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseMock } from './mocks/supabaseMock';

vi.mock('../src/lib/supabaseClient', async () => {
  const { createSupabaseMock } = await import('./mocks/supabaseMock');
  return { supabase: createSupabaseMock() };
});

import { supabase } from '../src/lib/supabaseClient';
import { AuthProvider } from '../src/context/AuthContext';
import { DoctorsPage } from '../src/pages/admin/DoctorsPage';

const supabaseMock = supabase as unknown as SupabaseMock;

const specialties = [
  { id: 'esp-1', nombre: 'Cardiología' },
  { id: 'esp-2', nombre: 'Pediatría' },
];

function renderAsAdmin(fromImpl: (table: string) => unknown) {
  supabaseMock.auth.getSession.mockResolvedValue({
    data: { session: { user: { id: 'admin-1', email: 'admin@medtrack.test' } } },
  });
  supabaseMock.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });

  const single = vi.fn().mockResolvedValue({
    data: { nombre: 'Admin', apellido: 'QA', rol: 'ADMIN' },
    error: null,
  });

  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'perfiles') {
      return { select: () => ({ eq: () => ({ single }) }) };
    }
    return fromImpl(table);
  });

  return render(
    <MemoryRouter>
      <AuthProvider>
        <DoctorsPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('DoctorsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('HU-04 registra un medico con la especialidad seleccionada', async () => {
    const insert = vi.fn().mockResolvedValue({ data: {}, error: null });
    renderAsAdmin((table) =>
      table === 'especialidades'
        ? { select: () => Promise.resolve({ data: specialties, error: null }) }
        : { insert }
    );

    await waitFor(() => expect(screen.getAllByText('Cardiología').length).toBeGreaterThan(0));

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Elena' } });
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Campos' } });
    fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: 'elena@medtrack.test' } });
    fireEvent.change(screen.getByLabelText('Numero de licencia'), { target: { value: 'MED-123' } });
    fireEvent.change(screen.getByLabelText('Especialidad'), { target: { value: 'esp-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar medico' }));

    expect(await screen.findByText('Médico registrado correctamente.')).toBeInTheDocument();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ licencia: 'MED-123', especialidad_id: 'esp-2' })
    );
  });

  it('HU-04 bloquea el registro si la licencia ya existe', async () => {
    renderAsAdmin((table) =>
      table === 'especialidades'
        ? { select: () => Promise.resolve({ data: specialties, error: null }) }
        : { insert: vi.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate' } }) }
    );

    await waitFor(() => expect(screen.getAllByText('Cardiología').length).toBeGreaterThan(0));

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Elena' } });
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Campos' } });
    fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: 'elena@medtrack.test' } });
    fireEvent.change(screen.getByLabelText('Numero de licencia'), { target: { value: 'MED-123' } });
    fireEvent.change(screen.getByLabelText('Especialidad'), { target: { value: 'esp-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar medico' }));

    expect(await screen.findByText('Ya existe un médico con esta cédula profesional.')).toBeInTheDocument();
  });
});
