import { describe, expect, it } from 'vitest';
import { diaSemanaDeFecha, generarFranjas, rangoSemanaActual, fechaDeDiaEnSemana } from '../src/lib/citasSlots';

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

describe('rangoSemanaActual', () => {
  it('devuelve el lunes y el domingo de la semana que contiene la fecha dada', () => {
    // 2026-07-16 es jueves (ver test de diaSemanaDeFecha)
    expect(rangoSemanaActual('2026-07-16')).toEqual({ inicio: '2026-07-13', fin: '2026-07-19' });
  });

  it('funciona cuando la fecha dada es domingo', () => {
    expect(rangoSemanaActual('2026-07-19')).toEqual({ inicio: '2026-07-13', fin: '2026-07-19' });
  });

  it('funciona cuando la fecha dada es lunes', () => {
    expect(rangoSemanaActual('2026-07-13')).toEqual({ inicio: '2026-07-13', fin: '2026-07-19' });
  });
});

describe('fechaDeDiaEnSemana', () => {
  it('devuelve la fecha del dia pedido dentro de la semana que empieza en inicioSemana', () => {
    expect(fechaDeDiaEnSemana('2026-07-13', 'JUE')).toBe('2026-07-16');
    expect(fechaDeDiaEnSemana('2026-07-13', 'LUN')).toBe('2026-07-13');
    expect(fechaDeDiaEnSemana('2026-07-13', 'DOM')).toBe('2026-07-19');
  });
});
