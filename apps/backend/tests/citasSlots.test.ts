import { describe, expect, it } from 'vitest';
import { diaSemanaDeFecha, generarFranjas } from '../src/lib/citasSlots';

describe('diaSemanaDeFecha', () => {
  it('mapea una fecha al codigo de dia de la semana', () => {
    expect(diaSemanaDeFecha('2026-07-13')).toBe('LUN'); // lunes
    expect(diaSemanaDeFecha('2026-07-16')).toBe('JUE'); // jueves
    expect(diaSemanaDeFecha('2026-07-19')).toBe('DOM'); // domingo
  });
});

describe('generarFranjas', () => {
  it('genera franjas de 30 minutos sin incluir el limite final', () => {
    expect(generarFranjas('08:00', '09:30')).toEqual(['08:00', '08:30', '09:00']);
  });

  it('no genera franjas si el bloque es mas corto que la duracion', () => {
    expect(generarFranjas('08:00', '08:15')).toEqual([]);
  });
});
