const DIAS_SEMANA = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'] as const;

export function diaSemanaDeFecha(fecha: string): string {
  const date = new Date(`${fecha}T00:00:00`);
  return DIAS_SEMANA[date.getDay()]!;
}

export function rangoSemanaActual(hoy: string): { inicio: string; fin: string } {
  const fecha = new Date(`${hoy}T00:00:00`);
  const diaIndex = fecha.getDay(); // 0 = domingo .. 6 = sabado
  const offsetALunes = diaIndex === 0 ? 6 : diaIndex - 1;

  const lunes = new Date(fecha);
  lunes.setDate(fecha.getDate() - offsetALunes);

  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  return { inicio: formatearFecha(lunes), fin: formatearFecha(domingo) };
}

export function fechaDeDiaEnSemana(inicioSemana: string, diaSemana: string): string {
  const offset = DIAS_SEMANA.indexOf(diaSemana as (typeof DIAS_SEMANA)[number]);
  if (offset === -1) {
    throw new Error(`Día de la semana inválido: "${diaSemana}".`);
  }
  const lunesIndex = DIAS_SEMANA.indexOf('LUN');
  const diasDesdeElLunes = (offset - lunesIndex + 7) % 7;

  const fecha = new Date(`${inicioSemana}T00:00:00`);
  fecha.setDate(fecha.getDate() + diasDesdeElLunes);
  return formatearFecha(fecha);
}

function formatearFecha(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function bloquesSeSuperponen(
  inicioA: string,
  finA: string,
  inicioB: string,
  finB: string
): boolean {
  return inicioA < finB && inicioB < finA;
}

export function generarFranjas(horaInicio: string, horaFin: string, duracionMin = 30): string[] {
  const [hIni, mIni] = horaInicio.split(':').map(Number) as [number, number];
  const [hFin, mFin] = horaFin.split(':').map(Number) as [number, number];
  const inicioMin = hIni * 60 + mIni;
  const finMin = hFin * 60 + mFin;
  const franjas: string[] = [];

  for (let t = inicioMin; t + duracionMin <= finMin; t += duracionMin) {
    const h = String(Math.floor(t / 60)).padStart(2, '0');
    const m = String(t % 60).padStart(2, '0');
    franjas.push(`${h}:${m}`);
  }

  return franjas;
}
