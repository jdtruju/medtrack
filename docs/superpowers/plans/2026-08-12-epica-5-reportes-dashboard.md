# Épica 5 — Reportes y Dashboard Administrativo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar HU-13 (Reporte de Disponibilidad), HU-14 (Reporte de Citas) y HU-15
(Dashboard Administrativo) con exportación a PDF y un gráfico de ocupación por médico.

**Architecture:** Un nuevo `ReportesService` en `AppServices` calcula las tres vistas
(dashboard, disponibilidad, citas) leyendo `citas`/`horarios`/`medicos`/`perfiles` — sin
tablas ni migraciones nuevas. Rutas Express nuevas bajo `/api/reportes`, protegidas con
`requireRole('ADMIN')`. El frontend reemplaza `AdminDashboardPage.tsx` (HU-15, con un
gráfico de Recharts) y `ReportsPage.tsx` (HU-13 + HU-14, con filtros y exportación a PDF
100% del lado del cliente).

**Tech Stack:** Express + TypeScript, Supabase (sin ORM), React + Vite, Recharts (gráfico),
jsPDF + jspdf-autotable (exportación PDF), Vitest + supertest + React Testing Library.

## Global Constraints

- `fechaHora` siempre es el string `"YYYY-MM-DDTHH:mm"` (sin zona horaria) — comparaciones
  de fecha son comparaciones de string (funciona porque el formato es lexicográficamente
  ordenable).
- Las funciones de `ReportesService` que dependen de "la semana actual"
  (`dashboard`, `disponibilidad`) reciben `hoy: string` (`YYYY-MM-DD`) como parámetro
  obligatorio — nunca leen `new Date()` internamente. Esto es lo único que las hace
  testeables sin mockear el reloj global.
- Cualquier cálculo de "hoy" (en rutas o helpers) usa componentes de fecha locales
  (`getFullYear`/`getMonth`/`getDate`), nunca `toISOString()` — `toISOString()` convierte a
  UTC y puede devolver el día anterior o siguiente según la zona horaria del servidor. Es
  el mismo criterio que ya usa `diaSemanaDeFecha` en `citasSlots.ts`.
- No se agrega ninguna tabla ni migración SQL en esta épica.
- El PDF se genera en el navegador (`jsPDF`), nunca en el backend.
- TypeScript estricto: cualquier `.split(...)[n]` o acceso indexado sobre un array no-tupla
  necesita `!` o un cast, por `noUncheckedIndexedAccess`.
- Ningún commit lleva trailer de co-autor de IA.

---

### Task 1: Helpers de fecha puros (`rangoSemanaActual`, `fechaDeDiaEnSemana`)

**Files:**
- Modify: `apps/backend/src/lib/citasSlots.ts`
- Test: `apps/backend/tests/citasSlots.test.ts`

**Interfaces:**
- Produces: `rangoSemanaActual(hoy: string): { inicio: string; fin: string }` y
  `fechaDeDiaEnSemana(inicioSemana: string, diaSemana: string): string`, usadas por el
  `ReportesService` de las Tasks 2 y 3.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `apps/backend/tests/citasSlots.test.ts`:

```ts
import { fechaDeDiaEnSemana, rangoSemanaActual } from '../src/lib/citasSlots';

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
```

(Nota: hay que mover el `import` existente de `diaSemanaDeFecha, generarFranjas` y el nuevo
en un único `import` al inicio del archivo, o agregar una segunda línea de `import` — ambas
formas son válidas en TypeScript.)

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npm test --workspace=@medtrack/backend -- citasSlots`
Expected: FAIL — `rangoSemanaActual`/`fechaDeDiaEnSemana` no existen todavía.

- [ ] **Step 3: Implementar las funciones**

En `apps/backend/src/lib/citasSlots.ts`, agregar debajo de `diaSemanaDeFecha`:

```ts
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
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npm test --workspace=@medtrack/backend -- citasSlots`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/backend/src/lib/citasSlots.ts apps/backend/tests/citasSlots.test.ts
git commit -m "feat: add week-range date helpers for reportes"
```

---

### Task 2: Tipos de Reportes + `ReportesService` en el fake

**Files:**
- Modify: `apps/backend/src/services/appServices.ts`
- Modify: `apps/backend/src/repositories/inMemoryRepositories.ts`
- Test: `apps/backend/tests/inMemoryServices.test.ts`

**Interfaces:**
- Consumes: `rangoSemanaActual`, `fechaDeDiaEnSemana`, `generarFranjas` de Task 1 /
  Épica 3.
- Produces: `ReportesService` (`dashboard`, `disponibilidad`, `citas`) y sus tipos —
  usados por las rutas de Task 4 y por la implementación real de Task 3.

**Nota:** después de este task, `apps/backend/src/repositories/supabaseRepositories.ts` no
compila (le falta el campo `reportes` en el objeto que devuelve) — es esperado y se
resuelve en la Task 3, igual que pasó con `CitasService` en la Épica 3. `npm test` sigue
en verde porque Vitest no type-checkea ese archivo.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `apps/backend/tests/inMemoryServices.test.ts` (dentro del mismo
`describe('createInMemoryServices')`):

```ts
  it('calcula el dashboard de reportes: totales y ocupacion por medico', async () => {
    const services = createInMemoryServices();
    const [especialidad] = await services.especialidades.list();

    await services.auth.register({ nombre: 'Ana', apellido: 'Mora', email: 'ana@medtrack.test', password: 'Segura123' });

    const medico = await services.medicos.create({
      nombre: 'Dr',
      apellido: 'Lopez',
      email: 'lopez@medtrack.test',
      licencia: 'MED-9',
      especialidadId: especialidad.id,
    });
    if (!medico.ok) throw new Error('setup failed');

    // 2026-07-16 es jueves; el horario cubre 08:00-09:00 (2 franjas de 30 min)
    await services.horarios.create({ medicoId: medico.value.id, diaSemana: 'JUE', horaInicio: '08:00', horaFin: '09:00' });
    const cita = await services.citas.create({ pacienteId: 'paciente-1', medicoId: medico.value.id, fechaHora: '2026-07-16T08:00' });
    expect(cita.ok).toBe(true);

    const stats = await services.reportes.dashboard('2026-07-16');
    expect(stats.totalCitas).toBe(1);
    expect(stats.totalPacientes).toBe(1);
    expect(stats.ocupacionPorMedico).toEqual([
      { medicoId: medico.value.id, nombre: 'Dr', apellido: 'Lopez', franjasTotales: 2, franjasOcupadas: 1, porcentaje: 50 },
    ]);
  });

  it('calcula la disponibilidad por medico para la semana actual', async () => {
    const services = createInMemoryServices();
    const [especialidad] = await services.especialidades.list();
    const medico = await services.medicos.create({
      nombre: 'Dr',
      apellido: 'Garcia',
      email: 'garcia@medtrack.test',
      licencia: 'MED-10',
      especialidadId: especialidad.id,
    });
    if (!medico.ok) throw new Error('setup failed');

    await services.horarios.create({ medicoId: medico.value.id, diaSemana: 'JUE', horaInicio: '08:00', horaFin: '09:00' });
    await services.citas.create({ pacienteId: 'paciente-1', medicoId: medico.value.id, fechaHora: '2026-07-16T08:00' });

    const items = await services.reportes.disponibilidad('2026-07-16', medico.value.id);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      medicoId: medico.value.id,
      medicoNombre: 'Dr',
      medicoApellido: 'Garcia',
      diaSemana: 'JUE',
      franjasTotales: 2,
      franjasOcupadas: 1,
      franjasLibres: 1,
    });
  });

  it('filtra el reporte de citas por medico y rango de fechas', async () => {
    const services = createInMemoryServices();
    const [especialidad] = await services.especialidades.list();

    await services.auth.register({ nombre: 'Ana', apellido: 'Mora', email: 'ana@medtrack.test', password: 'Segura123' });
    const login = await services.auth.login('ana@medtrack.test', 'Segura123');
    if (!login.ok) throw new Error('setup failed');
    const pacienteId = login.value.usuario.id;

    const medico = await services.medicos.create({
      nombre: 'Dr',
      apellido: 'Torres',
      email: 'torres@medtrack.test',
      licencia: 'MED-11',
      especialidadId: especialidad.id,
    });
    if (!medico.ok) throw new Error('setup failed');

    await services.citas.create({ pacienteId, medicoId: medico.value.id, fechaHora: '2026-07-16T08:00' });
    await services.citas.create({ pacienteId, medicoId: medico.value.id, fechaHora: '2026-07-17T08:00' });

    const todas = await services.reportes.citas({ medicoId: medico.value.id });
    expect(todas).toHaveLength(2);
    expect(todas[0]).toMatchObject({
      medicoNombre: 'Dr',
      medicoApellido: 'Torres',
      pacienteNombre: 'Ana',
      pacienteApellido: 'Mora',
    });

    const soloJueves = await services.reportes.citas({ medicoId: medico.value.id, desde: '2026-07-16', hasta: '2026-07-16' });
    expect(soloJueves).toHaveLength(1);
    expect(soloJueves[0].fechaHora).toBe('2026-07-16T08:00');
  });
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npm test --workspace=@medtrack/backend -- inMemoryServices`
Expected: FAIL — `services.reportes` es `undefined`.

- [ ] **Step 3: Agregar los tipos en `appServices.ts`**

Al final de `apps/backend/src/services/appServices.ts`, antes de la interfaz
`AppServices`:

```ts
export interface OcupacionMedico {
  medicoId: string;
  nombre: string;
  apellido: string;
  franjasTotales: number;
  franjasOcupadas: number;
  porcentaje: number;
}

export interface DashboardStats {
  totalCitas: number;
  totalPacientes: number;
  ocupacionPorMedico: OcupacionMedico[];
}

export interface DisponibilidadReporteItem {
  horarioId: string;
  medicoId: string;
  medicoNombre: string;
  medicoApellido: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  franjasTotales: number;
  franjasOcupadas: number;
  franjasLibres: number;
}

export interface CitaReporteItem extends Cita {
  medicoNombre: string;
  medicoApellido: string;
  pacienteNombre: string;
  pacienteApellido: string;
}

export interface CitasReporteFilters {
  medicoId?: string;
  desde?: string;
  hasta?: string;
}

export interface ReportesService {
  dashboard(hoy: string): Promise<DashboardStats>;
  disponibilidad(hoy: string, medicoId?: string): Promise<DisponibilidadReporteItem[]>;
  citas(filters: CitasReporteFilters): Promise<CitaReporteItem[]>;
}
```

Y agregar el campo a `AppServices`:

```ts
export interface AppServices {
  auth: AuthService;
  especialidades: EspecialidadesService;
  medicos: MedicosService;
  horarios: HorariosService;
  citas: CitasService;
  reportes: ReportesService;
}
```

- [ ] **Step 4: Implementar `ReportesService` en el fake**

En `apps/backend/src/repositories/inMemoryRepositories.ts`:

Cambiar el import del Step 1 de Task 1 (agregar `fechaDeDiaEnSemana`, `rangoSemanaActual`)
y agregar los tipos nuevos al import de tipos:

```ts
import { diaSemanaDeFecha, fechaDeDiaEnSemana, generarFranjas, rangoSemanaActual } from '../lib/citasSlots';
import type {
  AuthService,
  Cita,
  CitasService,
  Especialidad,
  EspecialidadesService,
  Horario,
  HorariosService,
  Medico,
  MedicosService,
  OcupacionMedico,
  ReportesService,
} from '../services/appServices';
```

Agregar, después de la definición de `citasService` y antes de `testHelpers`:

```ts
  const reportesService: ReportesService = {
    async dashboard(hoy) {
      const totalCitas = citas.filter((c) => c.estado === 'CONFIRMADA').length;
      const totalPacientes = users.filter((u) => u.rol === 'PACIENTE').length;
      const { inicio } = rangoSemanaActual(hoy);

      const ocupacionPorMedico: OcupacionMedico[] = medicos.map((medico) => {
        const bloques = horarios.filter((h) => h.medicoId === medico.id);
        let franjasTotales = 0;
        let franjasOcupadas = 0;
        for (const bloque of bloques) {
          const franjas = generarFranjas(bloque.horaInicio, bloque.horaFin);
          franjasTotales += franjas.length;
          const fecha = fechaDeDiaEnSemana(inicio, bloque.diaSemana);
          franjasOcupadas += citas.filter(
            (c) =>
              c.medicoId === medico.id &&
              c.estado === 'CONFIRMADA' &&
              c.fechaHora.startsWith(fecha) &&
              franjas.includes(c.fechaHora.split('T')[1]!)
          ).length;
        }
        return {
          medicoId: medico.id,
          nombre: medico.nombre,
          apellido: medico.apellido,
          franjasTotales,
          franjasOcupadas,
          porcentaje: franjasTotales === 0 ? 0 : Math.round((franjasOcupadas / franjasTotales) * 100),
        };
      });

      return { totalCitas, totalPacientes, ocupacionPorMedico };
    },

    async disponibilidad(hoy, medicoId) {
      const { inicio } = rangoSemanaActual(hoy);
      const bloques = horarios.filter((h) => !medicoId || h.medicoId === medicoId);

      return bloques.map((bloque) => {
        const medico = medicos.find((m) => m.id === bloque.medicoId);
        const franjas = generarFranjas(bloque.horaInicio, bloque.horaFin);
        const fecha = fechaDeDiaEnSemana(inicio, bloque.diaSemana);
        const franjasOcupadas = citas.filter(
          (c) =>
            c.medicoId === bloque.medicoId &&
            c.estado === 'CONFIRMADA' &&
            c.fechaHora.startsWith(fecha) &&
            franjas.includes(c.fechaHora.split('T')[1]!)
        ).length;

        return {
          horarioId: bloque.id,
          medicoId: bloque.medicoId,
          medicoNombre: medico?.nombre ?? '',
          medicoApellido: medico?.apellido ?? '',
          diaSemana: bloque.diaSemana,
          horaInicio: bloque.horaInicio,
          horaFin: bloque.horaFin,
          franjasTotales: franjas.length,
          franjasOcupadas,
          franjasLibres: franjas.length - franjasOcupadas,
        };
      });
    },

    async citas(filters) {
      return citas
        .filter((c) => !filters.medicoId || c.medicoId === filters.medicoId)
        .filter((c) => !filters.desde || c.fechaHora >= filters.desde)
        .filter((c) => !filters.hasta || c.fechaHora <= `${filters.hasta}T23:59`)
        .map((c) => {
          const medico = medicos.find((m) => m.id === c.medicoId);
          const paciente = users.find((u) => u.id === c.pacienteId);
          return {
            ...c,
            medicoNombre: medico?.nombre ?? '',
            medicoApellido: medico?.apellido ?? '',
            pacienteNombre: paciente?.nombre ?? '',
            pacienteApellido: paciente?.apellido ?? '',
          };
        });
    },
  };
```

Y actualizar el `return` final para incluir `reportes: reportesService`:

```ts
  return {
    auth,
    especialidades: especialidadesService,
    medicos: medicosService,
    horarios: horariosService,
    citas: citasService,
    reportes: reportesService,
    testHelpers,
  };
```

- [ ] **Step 5: Correr los tests y confirmar que pasan**

Run: `npm test --workspace=@medtrack/backend -- inMemoryServices`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/services/appServices.ts apps/backend/src/repositories/inMemoryRepositories.ts apps/backend/tests/inMemoryServices.test.ts
git commit -m "feat: add ReportesService to the in-memory fake"
```

---

### Task 3: `ReportesService` real contra Supabase

**Files:**
- Modify: `apps/backend/src/repositories/supabaseRepositories.ts`

**Interfaces:**
- Consumes: `ReportesService` y sus tipos de Task 2; `rangoSemanaActual`,
  `fechaDeDiaEnSemana`, `generarFranjas` de Task 1 / Épica 3.
- Produces: nada nuevo — esta task solo hace que `createSupabaseServices` vuelva a
  compilar contra la interfaz `AppServices` ya extendida en Task 2.

No hay pruebas automáticas para este archivo (no hay conexión real a Postgres en este
entorno — misma limitación ya documentada para `CitasService` en la Épica 3). La
verificación es que el backend compila.

- [ ] **Step 1: Actualizar los imports**

En `apps/backend/src/repositories/supabaseRepositories.ts`:

```ts
import { diaSemanaDeFecha, fechaDeDiaEnSemana, generarFranjas, rangoSemanaActual } from '../lib/citasSlots';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AppServices,
  AuthService,
  CitasService,
  DisponibilidadReporteItem,
  Especialidad,
  EspecialidadesService,
  Horario,
  HorariosService,
  Medico,
  MedicosService,
  ReportesService,
} from '../services/appServices';
```

- [ ] **Step 2: Implementar `reportes`**

Agregar, después de la definición de `citas` y antes del `return` final:

```ts
  const reportes: ReportesService = {
    async dashboard(hoy) {
      const { count: totalCitas } = await client
        .from('citas')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'CONFIRMADA');

      const { count: totalPacientes } = await client
        .from('perfiles')
        .select('*', { count: 'exact', head: true })
        .eq('rol', 'PACIENTE');

      const { data: medicosRows } = await client.from('medicos').select('id, nombre, apellido');
      const { data: horariosRows } = await client
        .from('horarios')
        .select('medico_id, dia_semana, hora_inicio, hora_fin');
      const { inicio, fin } = rangoSemanaActual(hoy);
      const { data: citasSemana } = await client
        .from('citas')
        .select('medico_id, fecha_hora')
        .eq('estado', 'CONFIRMADA')
        .gte('fecha_hora', `${inicio}T00:00`)
        .lte('fecha_hora', `${fin}T23:59`);

      const ocupacionPorMedico = ((medicosRows ?? []) as Array<Record<string, unknown>>).map((medico) => {
        const bloques = ((horariosRows ?? []) as Array<Record<string, unknown>>).filter(
          (h) => h.medico_id === medico.id
        );
        let franjasTotales = 0;
        let franjasOcupadas = 0;
        for (const bloque of bloques) {
          const franjas = generarFranjas(bloque.hora_inicio as string, bloque.hora_fin as string);
          franjasTotales += franjas.length;
          const fecha = fechaDeDiaEnSemana(inicio, bloque.dia_semana as string);
          franjasOcupadas += ((citasSemana ?? []) as Array<{ medico_id: string; fecha_hora: string }>).filter(
            (c) => c.medico_id === medico.id && c.fecha_hora.startsWith(fecha) && franjas.includes(c.fecha_hora.slice(11, 16))
          ).length;
        }
        return {
          medicoId: medico.id as string,
          nombre: medico.nombre as string,
          apellido: medico.apellido as string,
          franjasTotales,
          franjasOcupadas,
          porcentaje: franjasTotales === 0 ? 0 : Math.round((franjasOcupadas / franjasTotales) * 100),
        };
      });

      return { totalCitas: totalCitas ?? 0, totalPacientes: totalPacientes ?? 0, ocupacionPorMedico };
    },

    async disponibilidad(hoy, medicoId) {
      let query = client.from('horarios').select('id, medico_id, dia_semana, hora_inicio, hora_fin');
      if (medicoId) query = query.eq('medico_id', medicoId);
      const { data: bloques } = await query;

      const { data: medicosRows } = await client.from('medicos').select('id, nombre, apellido');
      const { inicio } = rangoSemanaActual(hoy);

      const resultado: DisponibilidadReporteItem[] = [];
      for (const bloque of (bloques ?? []) as Array<Record<string, unknown>>) {
        const medico = ((medicosRows ?? []) as Array<Record<string, unknown>>).find((m) => m.id === bloque.medico_id);
        const franjas = generarFranjas(bloque.hora_inicio as string, bloque.hora_fin as string);
        const fecha = fechaDeDiaEnSemana(inicio, bloque.dia_semana as string);
        const { data: citasDia } = await client
          .from('citas')
          .select('fecha_hora')
          .eq('medico_id', bloque.medico_id as string)
          .eq('estado', 'CONFIRMADA')
          .gte('fecha_hora', `${fecha}T00:00`)
          .lte('fecha_hora', `${fecha}T23:59`);
        const franjasOcupadas = ((citasDia ?? []) as Array<{ fecha_hora: string }>).filter((c) =>
          franjas.includes(c.fecha_hora.slice(11, 16))
        ).length;

        resultado.push({
          horarioId: bloque.id as string,
          medicoId: bloque.medico_id as string,
          medicoNombre: (medico?.nombre as string) ?? '',
          medicoApellido: (medico?.apellido as string) ?? '',
          diaSemana: bloque.dia_semana as string,
          horaInicio: bloque.hora_inicio as string,
          horaFin: bloque.hora_fin as string,
          franjasTotales: franjas.length,
          franjasOcupadas,
          franjasLibres: franjas.length - franjasOcupadas,
        });
      }
      return resultado;
    },

    async citas(filters) {
      let query = client
        .from('citas')
        .select('id, paciente_id, medico_id, especialidad_id, fecha_hora, estado')
        .order('fecha_hora');
      if (filters.medicoId) query = query.eq('medico_id', filters.medicoId);
      if (filters.desde) query = query.gte('fecha_hora', filters.desde);
      if (filters.hasta) query = query.lte('fecha_hora', `${filters.hasta}T23:59`);

      const { data } = await query;
      const rows = (data ?? []) as Array<Record<string, unknown>>;

      const { data: medicosRows } = await client.from('medicos').select('id, nombre, apellido');
      const { data: perfilesRows } = await client.from('perfiles').select('id, nombre, apellido');

      return rows.map((row) => {
        const medico = ((medicosRows ?? []) as Array<Record<string, unknown>>).find((m) => m.id === row.medico_id);
        const paciente = ((perfilesRows ?? []) as Array<Record<string, unknown>>).find(
          (p) => p.id === row.paciente_id
        );
        return {
          id: row.id as string,
          pacienteId: row.paciente_id as string,
          medicoId: row.medico_id as string,
          especialidadId: row.especialidad_id as string,
          fechaHora: row.fecha_hora as string,
          estado: row.estado as 'CONFIRMADA' | 'CANCELADA',
          medicoNombre: (medico?.nombre as string) ?? '',
          medicoApellido: (medico?.apellido as string) ?? '',
          pacienteNombre: (paciente?.nombre as string) ?? '',
          pacienteApellido: (paciente?.apellido as string) ?? '',
        };
      });
    },
  };
```

Y cambiar el `return` final a:

```ts
  return { auth, especialidades, medicos, horarios, citas, reportes };
```

- [ ] **Step 3: Verificar que el backend compila**

Run: `npx tsc -p apps/backend/tsconfig.json --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/repositories/supabaseRepositories.ts
git commit -m "feat: add real ReportesService against Supabase"
```

---

### Task 4: Rutas `/api/reportes` en Express

**Files:**
- Create: `apps/backend/src/routes/reportes.ts`
- Modify: `apps/backend/src/routes/index.ts`
- Test: `apps/backend/tests/reportes.test.ts`

**Interfaces:**
- Consumes: `services.reportes` (Task 2/3), `requireAuth`/`requireRole` de
  `apps/backend/src/middlewares/auth.ts`.

- [ ] **Step 1: Escribir el test que falla**

Crear `apps/backend/tests/reportes.test.ts`:

```ts
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { createInMemoryServices } from './helpers/inMemoryServices';

let services: ReturnType<typeof createInMemoryServices>;
let app: ReturnType<typeof createApp>;
let adminToken: string;
let pacienteToken: string;
let medicoId: string;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-16T12:00:00')); // jueves, semana 2026-07-13..2026-07-19

  services = createInMemoryServices();
  app = createApp(services);

  await services.auth.register({ nombre: 'Admin', apellido: 'QA', email: 'admin@medtrack.test', password: 'Admin1234' });
  services.testHelpers.promoteToAdmin('admin@medtrack.test');
  const loginAdmin = await services.auth.login('admin@medtrack.test', 'Admin1234');
  if (loginAdmin.ok) adminToken = loginAdmin.value.token;

  await services.auth.register({ nombre: 'Ana', apellido: 'Mora', email: 'paciente@medtrack.test', password: 'Paciente1' });
  const loginPaciente = await services.auth.login('paciente@medtrack.test', 'Paciente1');
  if (loginPaciente.ok) pacienteToken = loginPaciente.value.token;

  const especialidades = await services.especialidades.list();
  const medico = await services.medicos.create({
    nombre: 'Dr',
    apellido: 'Lopez',
    email: 'lopez@medtrack.test',
    licencia: 'MED-20',
    especialidadId: especialidades[0].id,
  });
  if (medico.ok) medicoId = medico.value.id;

  await services.horarios.create({ medicoId, diaSemana: 'JUE', horaInicio: '08:00', horaFin: '09:00' });
  await services.citas.create({ pacienteId: 'paciente-1', medicoId, fechaHora: '2026-07-16T08:00' });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GET /api/reportes/*', () => {
  it('HU-15 rechaza si el usuario no es ADMIN', async () => {
    const dashboard = await request(app).get('/api/reportes/dashboard').set('Authorization', `Bearer ${pacienteToken}`);
    const disponibilidad = await request(app).get('/api/reportes/disponibilidad').set('Authorization', `Bearer ${pacienteToken}`);
    const citas = await request(app).get('/api/reportes/citas').set('Authorization', `Bearer ${pacienteToken}`);

    expect(dashboard.status).toBe(403);
    expect(disponibilidad.status).toBe(403);
    expect(citas.status).toBe(403);
  });

  it('HU-15 devuelve totales y ocupacion por medico', async () => {
    const response = await request(app).get('/api/reportes/dashboard').set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.stats.totalCitas).toBe(1);
    expect(response.body.stats.ocupacionPorMedico).toEqual([
      { medicoId, nombre: 'Dr', apellido: 'Lopez', franjasTotales: 2, franjasOcupadas: 1, porcentaje: 50 },
    ]);
  });

  it('HU-13 filtra la disponibilidad por medico', async () => {
    const response = await request(app)
      .get(`/api/reportes/disponibilidad?medicoId=${medicoId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({ medicoId, franjasTotales: 2, franjasOcupadas: 1 });
  });

  it('HU-14 filtra las citas por medico y rango de fechas', async () => {
    const response = await request(app)
      .get(`/api/reportes/citas?medicoId=${medicoId}&desde=2026-07-16&hasta=2026-07-16`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({ medicoNombre: 'Dr', medicoApellido: 'Lopez' });

    const fueraDeRango = await request(app)
      .get(`/api/reportes/citas?medicoId=${medicoId}&desde=2026-07-17&hasta=2026-07-19`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(fueraDeRango.body.items).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Correr el test y confirmar que falla**

Run: `npm test --workspace=@medtrack/backend -- reportes`
Expected: FAIL — 404, la ruta no existe todavía.

- [ ] **Step 3: Crear la ruta**

Crear `apps/backend/src/routes/reportes.ts`:

```ts
import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import type { AppServices } from '../services/appServices';

function hoyISO(): string {
  const ahora = new Date();
  const y = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  const d = String(ahora.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createReportesRouter(services: AppServices) {
  const router = Router();
  router.use(requireAuth(services), requireRole(services, 'ADMIN'));

  router.get('/dashboard', async (_req, res) => {
    const stats = await services.reportes.dashboard(hoyISO());
    res.status(200).json({ stats });
  });

  router.get('/disponibilidad', async (req, res) => {
    const medicoId = typeof req.query.medicoId === 'string' ? req.query.medicoId : undefined;
    const items = await services.reportes.disponibilidad(hoyISO(), medicoId);
    res.status(200).json({ items });
  });

  router.get('/citas', async (req, res) => {
    const medicoId = typeof req.query.medicoId === 'string' ? req.query.medicoId : undefined;
    const desde = typeof req.query.desde === 'string' ? req.query.desde : undefined;
    const hasta = typeof req.query.hasta === 'string' ? req.query.hasta : undefined;
    const items = await services.reportes.citas({ medicoId, desde, hasta });
    res.status(200).json({ items });
  });

  return router;
}
```

- [ ] **Step 4: Montar la ruta**

En `apps/backend/src/routes/index.ts`, agregar el import y el `router.use`:

```ts
import { createReportesRouter } from './reportes';
```

```ts
  router.use('/api/reportes', createReportesRouter(services));
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `npm test --workspace=@medtrack/backend -- reportes`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/routes/reportes.ts apps/backend/src/routes/index.ts apps/backend/tests/reportes.test.ts
git commit -m "feat(HU-13,HU-14,HU-15): add /api/reportes routes with admin-only access"
```

---

### Task 5: Dashboard administrativo real (HU-15)

**Files:**
- Modify: `apps/frontend/src/pages/admin/AdminDashboardPage.tsx`
- Modify: `apps/frontend/package.json` (agregar `recharts`)
- Test: `apps/frontend/tests/AdminDashboardPage.test.tsx` (nuevo)

**Interfaces:**
- Consumes: `GET /api/reportes/dashboard` (Task 4).

**Decisión de implementación:** el `BarChart` de Recharts se usa con ancho/alto fijos
(`width={640} height={300}`), **sin** `ResponsiveContainer`. Esto evita por completo el
problema conocido de Recharts + `ResponsiveContainer` en jsdom (mide 0×0 porque
`ResizeObserver` no funciona en el entorno de test) — no hace falta ningún workaround
especial en los tests, ni tratar producción distinto de test.

- [ ] **Step 1: Instalar la dependencia**

```bash
npm install recharts --workspace=@medtrack/frontend
```

- [ ] **Step 2: Escribir el test que falla**

Crear `apps/frontend/tests/AdminDashboardPage.test.tsx`:

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  localStorage.setItem('medtrack.token', 'admin-token');
  localStorage.setItem(
    'medtrack.user',
    JSON.stringify({ id: 'a1', email: 'admin@medtrack.test', nombre: 'Admin', apellido: 'QA', rol: 'ADMIN' })
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
          { medicoId: 'med-1', nombre: 'Ana', apellido: 'Torres', franjasTotales: 8, franjasOcupadas: 4, porcentaje: 50 },
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
```

- [ ] **Step 3: Correr el test y confirmar que falla**

Run: `npm test --workspace=@medtrack/frontend -- AdminDashboardPage`
Expected: FAIL — el componente actual no hace fetch ni muestra estos datos.

- [ ] **Step 4: Reescribir `AdminDashboardPage.tsx`**

Reemplazar todo el contenido de `apps/frontend/src/pages/admin/AdminDashboardPage.tsx` por:

```tsx
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { AppShell, StatGrid, WorkPanel } from '../../components/AppShell';
import { apiRequest, getSession } from '../../lib/api';
import { adminNavItems } from '../../lib/nav';

interface OcupacionMedico {
  medicoId: string;
  nombre: string;
  apellido: string;
  franjasTotales: number;
  franjasOcupadas: number;
  porcentaje: number;
}

interface DashboardStats {
  totalCitas: number;
  totalPacientes: number;
  ocupacionPorMedico: OcupacionMedico[];
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    const { token } = getSession();
    apiRequest<{ stats: DashboardStats }>('/api/reportes/dashboard', { token })
      .then((response) => setStats(response.stats))
      .catch(() => setStats(null));
  }, []);

  const datosGrafico = (stats?.ocupacionPorMedico ?? []).map((item) => ({
    nombre: `Dr ${item.nombre} ${item.apellido}`,
    porcentaje: item.porcentaje,
  }));

  return (
    <AppShell title="Panel administrativo" subtitle="Resumen operativo para gestion de MedTrack." navItems={adminNavItems}>
      <StatGrid
        stats={[
          { label: 'Citas confirmadas', value: String(stats?.totalCitas ?? 0), detail: 'Historico' },
          { label: 'Pacientes registrados', value: String(stats?.totalPacientes ?? 0), detail: 'Total en el sistema' },
        ]}
      />
      <div className="mt-6">
        <WorkPanel title="Ocupacion por medico (esta semana)">
          {datosGrafico.length ? (
            <BarChart width={640} height={300} data={datosGrafico} className="mt-4">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="nombre" />
              <YAxis unit="%" domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="porcentaje" fill="#0f766e" />
            </BarChart>
          ) : (
            <p className="mt-4 text-sm text-slate-600">Sin datos de ocupacion todavia.</p>
          )}
        </WorkPanel>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `npm test --workspace=@medtrack/frontend -- AdminDashboardPage`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/package.json apps/frontend/package-lock.json apps/frontend/src/pages/admin/AdminDashboardPage.tsx apps/frontend/tests/AdminDashboardPage.test.tsx package-lock.json
git commit -m "feat(HU-15): dashboard administrativo real con grafico de ocupacion"
```

(El `package-lock.json` puede estar en la raíz del monorepo o en
`apps/frontend/` según cómo resuelva npm workspaces — agregar el que exista.)

---

### Task 6: Pantalla de Reportes — tablas y filtros (HU-13, HU-14)

**Files:**
- Modify: `apps/frontend/src/pages/admin/ReportsPage.tsx`
- Test: `apps/frontend/tests/ReportsPage.test.tsx` (nuevo)

**Interfaces:**
- Consumes: `GET /api/medicos`, `GET /api/reportes/disponibilidad`,
  `GET /api/reportes/citas` (Task 4).
- Produces: estructura de la página que la Task 7 extiende con los botones de exportar
  PDF.

Todavía **sin** botones de exportar PDF — eso es la Task 7.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `apps/frontend/tests/ReportsPage.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  localStorage.setItem('medtrack.token', 'admin-token');
  localStorage.setItem(
    'medtrack.user',
    JSON.stringify({ id: 'a1', email: 'admin@medtrack.test', nombre: 'Admin', apellido: 'QA', rol: 'ADMIN' })
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

    expect(await screen.findByText(/Dr Lopez/)).toBeInTheDocument();
    expect(screen.getByText('JUE')).toBeInTheDocument();

    mockJsonResponse({ items: [] });
    fireEvent.change(screen.getByLabelText('Medico', { selector: '#medicoDisponibilidad' }), { target: { value: 'med-1' } });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/reportes/disponibilidad?medicoId=med-1'), expect.anything())
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
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('desde=2026-07-17'), expect.anything())
    );
  });
});
```

- [ ] **Step 2: Correr los tests y confirmar que fallan**

Run: `npm test --workspace=@medtrack/frontend -- ReportsPage`
Expected: FAIL — la página actual no hace fetch de estos endpoints.

- [ ] **Step 3: Reescribir `ReportsPage.tsx`**

Reemplazar todo el contenido de `apps/frontend/src/pages/admin/ReportsPage.tsx` por:

```tsx
import { useEffect, useState } from 'react';
import { AppShell, WorkPanel } from '../../components/AppShell';
import { apiRequest, getSession } from '../../lib/api';
import { adminNavItems } from '../../lib/nav';

interface MedicoOption {
  id: string;
  nombre: string;
  apellido: string;
}

interface DisponibilidadItem {
  horarioId: string;
  medicoId: string;
  medicoNombre: string;
  medicoApellido: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  franjasTotales: number;
  franjasOcupadas: number;
  franjasLibres: number;
}

interface CitaReporteItem {
  id: string;
  medicoNombre: string;
  medicoApellido: string;
  pacienteNombre: string;
  pacienteApellido: string;
  fechaHora: string;
  estado: 'CONFIRMADA' | 'CANCELADA';
}

function medicoLabel(nombre: string, apellido: string) {
  return `Dr ${nombre} ${apellido}`;
}

export function ReportsPage() {
  const [medicos, setMedicos] = useState<MedicoOption[]>([]);

  const [medicoDisponibilidad, setMedicoDisponibilidad] = useState('');
  const [disponibilidad, setDisponibilidad] = useState<DisponibilidadItem[]>([]);

  const [medicoCitas, setMedicoCitas] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [citas, setCitas] = useState<CitaReporteItem[]>([]);

  useEffect(() => {
    const { token } = getSession();
    apiRequest<{ medicos: MedicoOption[] }>('/api/medicos', { token })
      .then((response) => setMedicos(response.medicos))
      .catch(() => setMedicos([]));
  }, []);

  useEffect(() => {
    const { token } = getSession();
    const query = medicoDisponibilidad ? `?medicoId=${medicoDisponibilidad}` : '';
    apiRequest<{ items: DisponibilidadItem[] }>(`/api/reportes/disponibilidad${query}`, { token })
      .then((response) => setDisponibilidad(response.items))
      .catch(() => setDisponibilidad([]));
  }, [medicoDisponibilidad]);

  useEffect(() => {
    const { token } = getSession();
    const params = new URLSearchParams();
    if (medicoCitas) params.set('medicoId', medicoCitas);
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    const query = params.toString() ? `?${params.toString()}` : '';
    apiRequest<{ items: CitaReporteItem[] }>(`/api/reportes/citas${query}`, { token })
      .then((response) => setCitas(response.items))
      .catch(() => setCitas([]));
  }, [medicoCitas, desde, hasta]);

  return (
    <AppShell title="Reportes" subtitle="Disponibilidad y citas para seguimiento operativo." navItems={adminNavItems}>
      <WorkPanel title="Disponibilidad por medico">
        <div className="flex flex-wrap items-end gap-4">
          <label className="block text-sm font-semibold text-slate-700" htmlFor="medicoDisponibilidad">
            Medico
            <select
              id="medicoDisponibilidad"
              value={medicoDisponibilidad}
              onChange={(event) => setMedicoDisponibilidad(event.target.value)}
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
            >
              <option value="">Todos los medicos</option>
              {medicos.map((medico) => (
                <option key={medico.id} value={medico.id}>
                  {medico.nombre} {medico.apellido}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-2 pr-4">Medico</th>
                <th className="py-2 pr-4">Dia</th>
                <th className="py-2 pr-4">Hora inicio</th>
                <th className="py-2 pr-4">Hora fin</th>
                <th className="py-2 pr-4">Franjas totales</th>
                <th className="py-2 pr-4">Ocupadas</th>
                <th className="py-2 pr-4">Libres</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {disponibilidad.map((item) => (
                <tr key={item.horarioId}>
                  <td className="py-3 pr-4">{medicoLabel(item.medicoNombre, item.medicoApellido)}</td>
                  <td className="py-3 pr-4">{item.diaSemana}</td>
                  <td className="py-3 pr-4">{item.horaInicio}</td>
                  <td className="py-3 pr-4">{item.horaFin}</td>
                  <td className="py-3 pr-4">{item.franjasTotales}</td>
                  <td className="py-3 pr-4">{item.franjasOcupadas}</td>
                  <td className="py-3 pr-4">{item.franjasLibres}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {disponibilidad.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">Sin horarios para este filtro.</p>
          ) : null}
        </div>
      </WorkPanel>

      <div className="mt-6">
        <WorkPanel title="Citas">
          <div className="flex flex-wrap items-end gap-4">
            <label className="block text-sm font-semibold text-slate-700" htmlFor="medicoCitas">
              Medico
              <select
                id="medicoCitas"
                value={medicoCitas}
                onChange={(event) => setMedicoCitas(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
              >
                <option value="">Todos los medicos</option>
                {medicos.map((medico) => (
                  <option key={medico.id} value={medico.id}>
                    {medico.nombre} {medico.apellido}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700" htmlFor="desde">
              Desde
              <input
                id="desde"
                type="date"
                value={desde}
                onChange={(event) => setDesde(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700" htmlFor="hasta">
              Hasta
              <input
                id="hasta"
                type="date"
                value={hasta}
                onChange={(event) => setHasta(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
              />
            </label>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2 pr-4">Paciente</th>
                  <th className="py-2 pr-4">Medico</th>
                  <th className="py-2 pr-4">Fecha y hora</th>
                  <th className="py-2 pr-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {citas.map((cita) => (
                  <tr key={cita.id}>
                    <td className="py-3 pr-4">
                      {cita.pacienteNombre} {cita.pacienteApellido}
                    </td>
                    <td className="py-3 pr-4">{medicoLabel(cita.medicoNombre, cita.medicoApellido)}</td>
                    <td className="py-3 pr-4">{cita.fechaHora}</td>
                    <td className="py-3 pr-4">{cita.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {citas.length === 0 ? <p className="mt-4 text-sm text-slate-600">Sin citas para este filtro.</p> : null}
          </div>
        </WorkPanel>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 4: Correr los tests y confirmar que pasan**

Run: `npm test --workspace=@medtrack/frontend -- ReportsPage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/pages/admin/ReportsPage.tsx apps/frontend/tests/ReportsPage.test.tsx
git commit -m "feat(HU-13,HU-14): reportes de disponibilidad y citas con filtros"
```

---

### Task 7: Exportar a PDF

**Files:**
- Create: `apps/frontend/src/lib/exportPdf.ts`
- Modify: `apps/frontend/src/pages/admin/ReportsPage.tsx`
- Modify: `apps/frontend/package.json` (agregar `jspdf`, `jspdf-autotable`)
- Test: `apps/frontend/tests/exportPdf.test.ts` (nuevo)
- Modify: `apps/frontend/tests/ReportsPage.test.tsx` (agregar los dos casos de exportar)

**Interfaces:**
- Produces: `exportarTablaPdf(titulo: string, columnas: string[], filas: string[][]): void`,
  usada por `ReportsPage.tsx`.

- [ ] **Step 1: Instalar las dependencias**

```bash
npm install jspdf jspdf-autotable --workspace=@medtrack/frontend
```

- [ ] **Step 2: Escribir el test que falla — `exportPdf.ts`**

Crear `apps/frontend/tests/exportPdf.test.ts`:

```ts
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
```

- [ ] **Step 3: Correr el test y confirmar que falla**

Run: `npm test --workspace=@medtrack/frontend -- exportPdf`
Expected: FAIL — `apps/frontend/src/lib/exportPdf.ts` no existe.

- [ ] **Step 4: Implementar el helper**

Crear `apps/frontend/src/lib/exportPdf.ts`:

```ts
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
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
```

- [ ] **Step 5: Correr el test y confirmar que pasa**

Run: `npm test --workspace=@medtrack/frontend -- exportPdf`
Expected: PASS

- [ ] **Step 6: Escribir los tests que fallan — wiring en `ReportsPage`**

Agregar a `apps/frontend/tests/ReportsPage.test.tsx`, al inicio del archivo (antes de los
imports de React Testing Library está bien, junto a los otros `vi.mock`):

```tsx
const exportarTablaPdfMock = vi.fn();
vi.mock('../src/lib/exportPdf', () => ({ exportarTablaPdf: exportarTablaPdfMock }));
```

Y dentro del `describe('ReportsPage', ...)`, agregar:

```tsx
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
    await screen.findByText(/Dr Lopez/);

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
```

(Nota: `medicoLabel('Dr', 'Lopez')` da `"Dr Dr Lopez"` porque el fixture usa `nombre: 'Dr'`
como nombre de pila — es el mismo patrón ya usado en `AppointmentsPage.test.tsx` y
`AvailabilityPage.test.tsx` de la Épica 3.)

- [ ] **Step 7: Correr los tests y confirmar que fallan**

Run: `npm test --workspace=@medtrack/frontend -- ReportsPage`
Expected: FAIL — no existen los botones "Exportar PDF disponibilidad"/"Exportar PDF citas".

- [ ] **Step 8: Agregar los botones en `ReportsPage.tsx`**

Agregar el import al inicio de `apps/frontend/src/pages/admin/ReportsPage.tsx`:

```tsx
import { exportarTablaPdf } from '../../lib/exportPdf';
```

Agregar, antes del `return` del componente:

```tsx
  function exportarDisponibilidad() {
    exportarTablaPdf(
      'Reporte de disponibilidad',
      ['Medico', 'Dia', 'Hora inicio', 'Hora fin', 'Franjas totales', 'Ocupadas', 'Libres'],
      disponibilidad.map((item) => [
        medicoLabel(item.medicoNombre, item.medicoApellido),
        item.diaSemana,
        item.horaInicio,
        item.horaFin,
        String(item.franjasTotales),
        String(item.franjasOcupadas),
        String(item.franjasLibres),
      ])
    );
  }

  function exportarCitas() {
    exportarTablaPdf(
      'Reporte de citas',
      ['Paciente', 'Medico', 'Fecha y hora', 'Estado'],
      citas.map((cita) => [
        `${cita.pacienteNombre} ${cita.pacienteApellido}`,
        medicoLabel(cita.medicoNombre, cita.medicoApellido),
        cita.fechaHora,
        cita.estado,
      ])
    );
  }
```

Cambiar el `<div className="flex flex-wrap items-end gap-4">` de la sección de
disponibilidad para agregar el botón al final:

```tsx
          </label>
          <button
            type="button"
            className="rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
            onClick={exportarDisponibilidad}
          >
            Exportar PDF disponibilidad
          </button>
        </div>
```

Y el `<div className="flex flex-wrap items-end gap-4">` de la sección de citas:

```tsx
          </label>
          <button
            type="button"
            className="rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
            onClick={exportarCitas}
          >
            Exportar PDF citas
          </button>
        </div>
```

- [ ] **Step 9: Correr los tests y confirmar que pasan**

Run: `npm test --workspace=@medtrack/frontend -- ReportsPage exportPdf`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add apps/frontend/package.json apps/frontend/package-lock.json package-lock.json apps/frontend/src/lib/exportPdf.ts apps/frontend/src/pages/admin/ReportsPage.tsx apps/frontend/tests/exportPdf.test.ts apps/frontend/tests/ReportsPage.test.tsx
git commit -m "feat(HU-13,HU-14): exportar reportes a PDF desde el navegador"
```

---

### Task 8: `CLAUDE.md` y verificación final

**Files:**
- Modify: `c:\Users\jdtru\Downloads\medtrack\medtrack\CLAUDE.md`

- [ ] **Step 1: Marcar HU-13, HU-14 y HU-15 como completadas**

En la sección `### Épica 5 – Reportes`, cambiar:

```markdown
- [ ] HU-13 Reporte de Disponibilidad — pendiente
- [ ] HU-14 Reporte de Citas — pendiente
- [ ] HU-15 Dashboard Administrativo — pendiente
```

por:

```markdown
- [x] HU-13 Reporte de Disponibilidad — completada en Sprint 4
- [x] HU-14 Reporte de Citas — completada en Sprint 4
- [x] HU-15 Dashboard Administrativo — completada en Sprint 4
```

- [ ] **Step 2: Documentar la épica en las notas**

Renombrar `## Notas de Épica 1, 2 y 3 (Express + Supabase)` a
`## Notas de Épica 1, 2, 3 y 5 (Express + Supabase)`, y agregar al final de esa lista:

```markdown
- Los reportes (Épica 5) no agregan tablas nuevas: son vistas calculadas al momento sobre
  `citas`/`horarios`/`medicos`/`perfiles`. La "ocupación por médico" se calcula sobre la
  semana actual (lunes a domingo).
- La exportación a PDF (HU-13/HU-14) es 100% del lado del cliente (`jsPDF` +
  `jspdf-autotable`), sin tocar el backend — no requiere la `service_role key`.
```

- [ ] **Step 3: Actualizar el stack**

En la sección `## Stack`, en la línea de `**Frontend:**`, agregar al final:
`, Recharts (gráficos), jsPDF (exportar reportes a PDF)`.

- [ ] **Step 4: Correr toda la suite**

Run: `npm install && npm test`
Expected: todos los tests de `apps/backend` y `apps/frontend` pasan.

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc -p apps/backend/tsconfig.json --noEmit && npx tsc -p apps/frontend/tsconfig.json --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: mark Epica 5 as completed"
```
