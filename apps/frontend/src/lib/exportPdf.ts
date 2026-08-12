import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportarTablaPdf(titulo: string, columnas: string[], filas: string[][]): void {
  const doc = new jsPDF();
  doc.text(titulo, 14, 16);
  // jspdf-autotable v5 solo expone la API funcional autoTable(doc, options);
  // ya no registra doc.autoTable en el prototipo de jsPDF (eso era v3). No "simplificar" a doc.autoTable(...).
  autoTable(doc, { head: [columnas], body: filas, startY: 22 });
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
