import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  localStorage.setItem('medtrack.token', 'admin-token');
  localStorage.setItem(
    'medtrack.user',
    JSON.stringify({
      id: 'a1',
      email: 'admin@medtrack.test',
      nombre: 'Admin',
      apellido: 'QA',
      rol: 'ADMIN',
    })
  );
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
});

import { AuthProvider } from '../src/context/AuthContext';
import { AdminDashboardPage } from '../src/pages/admin/AdminDashboardPage';

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  fetchMock.mockResolvedValueOnce({ ok, status, json: async () => body });
}

describe('AdminDashboardPage', () => {
  it('HU-15 muestra los totales y el grafico de ocupacion por medico', async () => {
    mockJsonResponse({
      stats: {
        totalCitas: 12,
        totalPacientes: 5,
        ocupacionPorMedico: [
          {
            medicoId: 'med-1',
            nombre: 'Ana',
            apellido: 'Torres',
            franjasTotales: 8,
            franjasOcupadas: 4,
            porcentaje: 50,
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <AdminDashboardPage />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(await screen.findByText('Dr Ana Torres')).toBeInTheDocument();
  });

  it('HU-15 muestra un mensaje cuando no hay ocupacion todavia', async () => {
    mockJsonResponse({ stats: { totalCitas: 0, totalPacientes: 0, ocupacionPorMedico: [] } });

    render(
      <MemoryRouter>
        <AuthProvider>
          <AdminDashboardPage />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('Sin datos de ocupacion todavia.')).toBeInTheDocument();
  });
});
