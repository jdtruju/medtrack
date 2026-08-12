import { afterEach, describe, expect, it, vi } from 'vitest';

const autoTable = vi.fn();
const save = vi.fn();
const text = vi.fn();

vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(() => ({ text, autoTable, save })),
}));
vi.mock('jspdf-autotable', () => ({}));

import { exportarTablaPdf } from '../src/lib/exportPdf';

afterEach(() => {
  autoTable.mockClear();
  save.mockClear();
  text.mockClear();
});

describe('exportarTablaPdf', () => {
  it('genera la tabla con las columnas y filas dadas y descarga el pdf', () => {
    exportarTablaPdf('Reporte de citas', ['Paciente', 'Estado'], [['Ana Mora', 'CONFIRMADA']]);

    expect(autoTable).toHaveBeenCalledWith({
      head: [['Paciente', 'Estado']],
      body: [['Ana Mora', 'CONFIRMADA']],
      startY: 22,
    });
    expect(save).toHaveBeenCalledWith('reporte-de-citas.pdf');
  });

  it('convierte el titulo a un nombre de archivo valido sin acentos ni espacios', () => {
    exportarTablaPdf('Reporte de Disponibilidad Médica', [], []);
    expect(save).toHaveBeenCalledWith('reporte-de-disponibilidad-medica.pdf');
  });
});
