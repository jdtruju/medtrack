const DIAS_SEMANA = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'] as const;

export function diaSemanaDeFecha(fecha: string): string {
  const date = new Date(`${fecha}T00:00:00`);
  return DIAS_SEMANA[date.getDay()]!;
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
