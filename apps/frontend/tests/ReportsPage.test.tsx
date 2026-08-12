import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { exportarTablaPdfMock } = vi.hoisted(() => ({ exportarTablaPdfMock: vi.fn() }));
vi.mock('../src/lib/exportPdf', () => ({ exportarTablaPdf: exportarTablaPdfMock }));

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
import { ReportsPage } from '../src/pages/admin/ReportsPage';

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  fetchMock.mockResolvedValueOnce({ ok, status, json: async () => body });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ReportsPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('ReportsPage', () => {
  it('HU-13 muestra la disponibilidad y filtra por medico', async () => {
    mockJsonResponse({ medicos: [{ id: 'med-1', nombre: 'Dr', apellido: 'Lopez' }] });
    mockJsonResponse({
      items: [
        {
          horarioId: 'h1',
          medicoId: 'med-1',
          medicoNombre: 'Dr',
          medicoApellido: 'Lopez',
          diaSemana: 'JUE',
          horaInicio: '08:00',
          horaFin: '09:00',
          franjasTotales: 2,
          franjasOcupadas: 1,
          franjasLibres: 1,
        },
      ],
    });
    mockJsonResponse({ items: [] }); // citas, disparado por el segundo useEffect al montar

    renderPage();

    expect(await screen.findByRole('cell', { name: /Dr Lopez/ })).toBeInTheDocument();
    expect(screen.getByText('JUE')).toBeInTheDocument();

    mockJsonResponse({ items: [] });
    fireEvent.change(screen.getByLabelText('Medico', { selector: '#medicoDisponibilidad' }), {
      target: { value: 'med-1' },
    });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/reportes/disponibilidad?medicoId=med-1'),
        expect.anything()
      )
    );
  });

  it('HU-14 muestra las citas y filtra por rango de fechas', async () => {
    mockJsonResponse({ medicos: [{ id: 'med-1', nombre: 'Dr', apellido: 'Lopez' }] });
    mockJsonResponse({ items: [] }); // disponibilidad
    mockJsonResponse({
      items: [
        {
          id: 'c1',
          medicoId: 'med-1',
          medicoNombre: 'Dr',
          medicoApellido: 'Lopez',
          pacienteId: 'p1',
          pacienteNombre: 'Ana',
          pacienteApellido: 'Mora',
          especialidadId: 'esp-1',
          fechaHora: '2026-07-16T08:00',
          estado: 'CONFIRMADA',
        },
      ],
    });

    renderPage();

    expect(await screen.findByText('Ana Mora')).toBeInTheDocument();

    mockJsonResponse({ items: [] });
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-07-17' } });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('desde=2026-07-17'),
        expect.anything()
      )
    );
  });

  it('HU-13 exporta la disponibilidad visible a PDF', async () => {
    mockJsonResponse({ medicos: [{ id: 'med-1', nombre: 'Dr', apellido: 'Lopez' }] });
    mockJsonResponse({
      items: [
        {
          horarioId: 'h1',
          medicoId: 'med-1',
          medicoNombre: 'Dr',
          medicoApellido: 'Lopez',
          diaSemana: 'JUE',
          horaInicio: '08:00',
          horaFin: '09:00',
          franjasTotales: 2,
          franjasOcupadas: 1,
          franjasLibres: 1,
        },
      ],
    });
    mockJsonResponse({ items: [] });

    renderPage();
    await screen.findByRole('cell', { name: /Dr Lopez/ });

    fireEvent.click(screen.getByRole('button', { name: 'Exportar PDF disponibilidad' }));

    expect(exportarTablaPdfMock).toHaveBeenCalledWith(
      'Reporte de disponibilidad',
      ['Medico', 'Dia', 'Hora inicio', 'Hora fin', 'Franjas totales', 'Ocupadas', 'Libres'],
      [['Dr Dr Lopez', 'JUE', '08:00', '09:00', '2', '1', '1']]
    );
  });

  it('HU-14 exporta las citas visibles a PDF', async () => {
    mockJsonResponse({ medicos: [{ id: 'med-1', nombre: 'Dr', apellido: 'Lopez' }] });
    mockJsonResponse({ items: [] });
    mockJsonResponse({
      items: [
        {
          id: 'c1',
          medicoId: 'med-1',
          medicoNombre: 'Dr',
          medicoApellido: 'Lopez',
          pacienteId: 'p1',
          pacienteNombre: 'Ana',
          pacienteApellido: 'Mora',
          especialidadId: 'esp-1',
          fechaHora: '2026-07-16T08:00',
          estado: 'CONFIRMADA',
        },
      ],
    });

    renderPage();
    await screen.findByText('Ana Mora');

    fireEvent.click(screen.getByRole('button', { name: 'Exportar PDF citas' }));

    expect(exportarTablaPdfMock).toHaveBeenCalledWith(
      'Reporte de citas',
      ['Paciente', 'Medico', 'Fecha y hora', 'Estado'],
      [['Ana Mora', 'Dr Dr Lopez', '2026-07-16T08:00', 'CONFIRMADA']]
    );
  });
});
