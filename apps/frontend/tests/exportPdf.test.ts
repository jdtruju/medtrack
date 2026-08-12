import { afterEach, describe, expect, it, vi } from 'vitest';

const { autoTable, save, text, docInstance } = vi.hoisted(() => {
  const autoTable = vi.fn();
  const save = vi.fn();
  const text = vi.fn();
  return { autoTable, save, text, docInstance: { text, save } };
});

vi.mock('jspdf', () => ({
  jsPDF: vi.fn().mockImplementation(() => docInstance),
}));
// jspdf-autotable v5 expone su API como export default (la funcion autoTable(doc, options)),
// no como un metodo agregado al prototipo de jsPDF. Mockeamos ese default export directamente
// para que el test falle si exportPdf.ts vuelve a llamar doc.autoTable(...) en vez de autoTable(doc, ...).
vi.mock('jspdf-autotable', () => ({ default: autoTable }));

import { exportarTablaPdf } from '../src/lib/exportPdf';

afterEach(() => {
  autoTable.mockClear();
  save.mockClear();
  text.mockClear();
});

describe('exportarTablaPdf', () => {
  it('genera la tabla con las columnas y filas dadas y descarga el pdf', () => {
    exportarTablaPdf('Reporte de citas', ['Paciente', 'Estado'], [['Ana Mora', 'CONFIRMADA']]);

    expect(autoTable).toHaveBeenCalledWith(docInstance, {
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
