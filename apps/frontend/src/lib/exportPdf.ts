import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

type JsPdfConAutoTable = jsPDF & {
  autoTable: (options: { head: string[][]; body: string[][]; startY?: number }) => void;
};

export function exportarTablaPdf(titulo: string, columnas: string[], filas: string[][]): void {
  const doc = new jsPDF() as JsPdfConAutoTable;
  doc.text(titulo, 14, 16);
  doc.autoTable({ head: [columnas], body: filas, startY: 22 });
  doc.save(`${slugify(titulo)}.pdf`);
}

function slugify(titulo: string): string {
  return titulo
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
