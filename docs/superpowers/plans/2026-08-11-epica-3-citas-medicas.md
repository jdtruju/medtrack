# Épica 3 (Citas Médicas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement HU-07 (Crear Cita), HU-08 (Reprogramar Cita) y HU-09 (Cancelar Cita) sobre la base de Express + `AppServices` ya existente, con la protección contra doble reserva garantizada por un índice único parcial en Postgres.

**Architecture:** Nuevo `CitasService` dentro de `AppServices` (mismo patrón que `horarios`/`medicos`): fake en memoria para tests, implementación real contra Supabase para producción. Dos funciones puras compartidas (`diaSemanaDeFecha`, `generarFranjas`) calculan qué horas de un bloque semanal de `horarios` están disponibles en una fecha concreta, cruzando con las citas ya `CONFIRMADA` de ese médico.

**Tech Stack:** Express, TypeScript, Zod, Supabase Postgres (índice único parcial), Vitest, supertest, React.

## Global Constraints

- La garantía real contra doble reserva es el índice único parcial de Postgres
  (`supabase/migrations/0006_citas.sql`), no una verificación en JavaScript — el código
  solo traduce el error `23505` de Postgres a un mensaje claro.
- `fechaHora` se representa en todo el sistema (backend, frontend, tests) como el string
  `"YYYY-MM-DDTHH:mm"` (sin zona horaria) — es una simplificación deliberada para este
  proyecto académico, documentada en el spec.
- Las franjas de reserva son de 30 minutos.
- Ningún test de esta sesión prueba concurrencia real de Postgres (no hay conexión real
  disponible) — los tests de "doble reserva" prueban que la lógica de la aplicación
  rechaza correctamente el segundo intento, no una carrera real a nivel de base.
- Todas las rutas de `/api/citas` requieren `requireAuth`; ninguna requiere rol ADMIN — un
  paciente solo puede ver/crear/modificar sus propias citas (`pacienteId` siempre sale de
  `req.user.id`, nunca de un parámetro de la petición).

---

### Task 1: Helpers de franjas + `CitasService` en el fake en memoria

**Files:**
- Create: `apps/backend/src/lib/citasSlots.ts`
- Modify: `apps/backend/src/services/appServices.ts`
- Modify: `apps/backend/src/repositories/inMemoryRepositories.ts`
- Test: `apps/backend/tests/citasSlots.test.ts`
- Test: `apps/backend/tests/inMemoryServices.test.ts`

**Interfaces:**
- Produces: `diaSemanaDeFecha(fecha: string): string`, `generarFranjas(horaInicio: string, horaFin: string, duracionMin?: number): string[]` desde `citasSlots.ts`. `Cita`, `CreateCitaInput`, `CitasService` en `appServices.ts` (`AppServices.citas: CitasService`). `createInMemoryServices()` ahora también devuelve `citas: CitasService`.

- [ ] **Step 1: Write the failing test — `apps/backend/tests/citasSlots.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/backend -- citasSlots`
Expected: FAIL — `Cannot find module '../src/lib/citasSlots'`.

- [ ] **Step 3: Crear `apps/backend/src/lib/citasSlots.ts`**

```ts
const DIAS_SEMANA = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'] as const;

export function diaSemanaDeFecha(fecha: string): string {
  const date = new Date(`${fecha}T00:00:00`);
  return DIAS_SEMANA[date.getDay()];
}

export function generarFranjas(horaInicio: string, horaFin: string, duracionMin = 30): string[] {
  const [hIni, mIni] = horaInicio.split(':').map(Number);
  const [hFin, mFin] = horaFin.split(':').map(Number);
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=apps/backend -- citasSlots`
Expected: PASS — 3 tests.

- [ ] **Step 5: Agregar los tipos a `apps/backend/src/services/appServices.ts`**

Agregar al final del archivo, antes de la interfaz `AppServices`:

```ts
export interface Cita {
  id: string;
  pacienteId: string;
  medicoId: string;
  especialidadId: string;
  fechaHora: string;
  estado: 'CONFIRMADA' | 'CANCELADA';
}

export interface CreateCitaInput {
  pacienteId: string;
  medicoId: string;
  fechaHora: string;
}

export interface CitasService {
  listSlotsDisponibles(medicoId: string, fecha: string): Promise<string[]>;
  create(input: CreateCitaInput): Promise<Result<Cita>>;
  listByPaciente(pacienteId: string): Promise<Cita[]>;
  reprogramar(id: string, pacienteId: string, fechaHora: string): Promise<Result<Cita>>;
  cancelar(id: string, pacienteId: string): Promise<Result<void>>;
}
```

Y actualizar la interfaz `AppServices` para incluir `citas: CitasService;`:

```ts
export interface AppServices {
  auth: AuthService;
  especialidades: EspecialidadesService;
  medicos: MedicosService;
  horarios: HorariosService;
  citas: CitasService;
}
```

- [ ] **Step 6: Write the failing test — agregar a `apps/backend/tests/inMemoryServices.test.ts`**

Agregar al final del archivo (dentro del mismo `describe('createInMemoryServices', ...)`):

```ts
  it('crea citas evitando doble reserva y respeta los bloques de horarios', async () => {
    const services = createInMemoryServices();
    const [especialidad] = await services.especialidades.list();
    const medico = await services.medicos.create({
      nombre: 'Dr',
      apellido: 'Garcia',
      email: 'garcia@medtrack.test',
      licencia: 'MED-3',
      especialidadId: especialidad.id,
    });
    if (!medico.ok) throw new Error('setup failed');

    // 2026-07-16 es jueves
    await services.horarios.create({ medicoId: medico.value.id, diaSemana: 'JUE', horaInicio: '08:00', horaFin: '12:00' });

    const franjas = await services.citas.listSlotsDisponibles(medico.value.id, '2026-07-16');
    expect(franjas).toContain('10:00');

    const primera = await services.citas.create({
      pacienteId: 'paciente-1',
      medicoId: medico.value.id,
      fechaHora: '2026-07-16T10:00',
    });
    expect(primera.ok).toBe(true);

    // HU-07 criterio "evita citas duplicadas": doble reserva del mismo horario
    const segunda = await services.citas.create({
      pacienteId: 'paciente-2',
      medicoId: medico.value.id,
      fechaHora: '2026-07-16T10:00',
    });
    expect(segunda).toEqual({
      ok: false,
      error: { status: 409, message: 'Lo sentimos, este horario ya no está disponible. Por favor selecciona otro.' },
    });

    const fueraDeHorario = await services.citas.create({
      pacienteId: 'paciente-3',
      medicoId: medico.value.id,
      fechaHora: '2026-07-16T20:00',
    });
    expect(fueraDeHorario.ok).toBe(false);

    if (!primera.ok) throw new Error('unreachable');

    const reprogramada = await services.citas.reprogramar(primera.value.id, 'paciente-1', '2026-07-16T11:00');
    expect(reprogramada.ok).toBe(true);

    const franjasTrasReprogramar = await services.citas.listSlotsDisponibles(medico.value.id, '2026-07-16');
    expect(franjasTrasReprogramar).toContain('10:00'); // se liberó
    expect(franjasTrasReprogramar).not.toContain('11:00'); // ahora ocupado

    const cancelada = await services.citas.cancelar(primera.value.id, 'paciente-1');
    expect(cancelada.ok).toBe(true);

    const franjasTrasCancelar = await services.citas.listSlotsDisponibles(medico.value.id, '2026-07-16');
    expect(franjasTrasCancelar).toContain('11:00'); // se liberó al cancelar

    const misCitas = await services.citas.listByPaciente('paciente-1');
    expect(misCitas).toHaveLength(1);
    expect(misCitas[0].estado).toBe('CANCELADA');
  });
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm run test --workspace=apps/backend -- inMemoryServices`
Expected: FAIL — `services.citas` es `undefined`.

- [ ] **Step 8: Implementar `CitasService` en `apps/backend/src/repositories/inMemoryRepositories.ts`**

Agregar el import al principio del archivo:

```ts
import { diaSemanaDeFecha, generarFranjas } from '../lib/citasSlots';
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
} from '../services/appServices';
```

Agregar el array `citas: Cita[] = [];` junto a los demás arrays (`medicos`, `horarios`), y agregar el servicio antes del `return` final:

```ts
  const citas: Cita[] = [];

  const citasService: CitasService = {
    async listSlotsDisponibles(medicoId, fecha) {
      const dia = diaSemanaDeFecha(fecha);
      const bloques = horarios.filter((h) => h.medicoId === medicoId && h.diaSemana === dia);
      const franjasValidas = bloques.flatMap((h) => generarFranjas(h.horaInicio, h.horaFin));
      const ocupadas = new Set(
        citas
          .filter((c) => c.medicoId === medicoId && c.estado === 'CONFIRMADA' && c.fechaHora.startsWith(fecha))
          .map((c) => c.fechaHora.split('T')[1])
      );
      return franjasValidas.filter((hora) => !ocupadas.has(hora));
    },
    async create({ pacienteId, medicoId, fechaHora }) {
      const medico = medicos.find((m) => m.id === medicoId);
      if (!medico) {
        return { ok: false, error: { status: 404, message: 'Médico no encontrado.' } };
      }

      const [fecha, hora] = fechaHora.split('T');
      const dia = diaSemanaDeFecha(fecha);
      const franjasValidas = horarios
        .filter((h) => h.medicoId === medicoId && h.diaSemana === dia)
        .flatMap((h) => generarFranjas(h.horaInicio, h.horaFin));

      if (!franjasValidas.includes(hora)) {
        return {
          ok: false,
          error: { status: 400, message: 'El horario seleccionado no está disponible. Elige otro para continuar.' },
        };
      }

      const ocupado = citas.some(
        (c) => c.medicoId === medicoId && c.fechaHora === fechaHora && c.estado === 'CONFIRMADA'
      );
      if (ocupado) {
        return {
          ok: false,
          error: { status: 409, message: 'Lo sentimos, este horario ya no está disponible. Por favor selecciona otro.' },
        };
      }

      const cita: Cita = {
        id: newId('cita'),
        pacienteId,
        medicoId,
        especialidadId: medico.especialidadId,
        fechaHora,
        estado: 'CONFIRMADA',
      };
      citas.push(cita);
      return { ok: true, value: cita };
    },
    async listByPaciente(pacienteId) {
      return citas.filter((c) => c.pacienteId === pacienteId);
    },
    async reprogramar(id, pacienteId, fechaHora) {
      const cita = citas.find((c) => c.id === id && c.pacienteId === pacienteId && c.estado === 'CONFIRMADA');
      if (!cita) {
        return { ok: false, error: { status: 404, message: 'Cita no encontrada.' } };
      }

      const [fecha, hora] = fechaHora.split('T');
      const dia = diaSemanaDeFecha(fecha);
      const franjasValidas = horarios
        .filter((h) => h.medicoId === cita.medicoId && h.diaSemana === dia)
        .flatMap((h) => generarFranjas(h.horaInicio, h.horaFin));

      if (!franjasValidas.includes(hora)) {
        return {
          ok: false,
          error: { status: 400, message: 'El horario seleccionado no está disponible. Elige otro para continuar.' },
        };
      }

      const ocupado = citas.some(
        (c) => c.id !== id && c.medicoId === cita.medicoId && c.fechaHora === fechaHora && c.estado === 'CONFIRMADA'
      );
      if (ocupado) {
        return {
          ok: false,
          error: { status: 409, message: 'Lo sentimos, este horario ya no está disponible. Por favor selecciona otro.' },
        };
      }

      cita.fechaHora = fechaHora;
      return { ok: true, value: cita };
    },
    async cancelar(id, pacienteId) {
      const cita = citas.find((c) => c.id === id && c.pacienteId === pacienteId);
      if (!cita) {
        return { ok: false, error: { status: 404, message: 'Cita no encontrada.' } };
      }
      cita.estado = 'CANCELADA';
      return { ok: true, value: undefined };
    },
  };
```

Y actualizar el `return` final para incluir `citas: citasService,`:

```ts
  return {
    auth,
    especialidades: especialidadesService,
    medicos: medicosService,
    horarios: horariosService,
    citas: citasService,
    testHelpers,
  };
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npm run test --workspace=apps/backend -- inMemoryServices citasSlots`
Expected: PASS — 4 + 3 tests.

- [ ] **Step 10: Commit**

```bash
git add apps/backend/src/lib/citasSlots.ts apps/backend/src/services/appServices.ts apps/backend/src/repositories/inMemoryRepositories.ts apps/backend/tests/citasSlots.test.ts apps/backend/tests/inMemoryServices.test.ts
git commit -m "feat: add CitasService to the in-memory fake, with slot generation and double-booking rejection"
```

---

### Task 2: Migración SQL de citas + `CitasService` real contra Supabase

**Files:**
- Create: `supabase/migrations/0006_citas.sql`
- Modify: `supabase/README.md`
- Modify: `apps/backend/src/repositories/supabaseRepositories.ts`

**Interfaces:**
- Consumes: `Cita`, `CitasService`, `CreateCitaInput` (Tarea 1), `diaSemanaDeFecha`,
  `generarFranjas` (Tarea 1).
- Produces: nada nuevo para otras tareas — esta es la implementación de producción, sin
  test propio (no hay conexión real a Supabase en esta sesión).

- [ ] **Step 1: Crear `supabase/migrations/0006_citas.sql`**

```sql
create table if not exists public.citas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references auth.users (id) on delete cascade,
  medico_id uuid not null references public.medicos (id),
  especialidad_id uuid not null references public.especialidades (id),
  fecha_hora timestamptz not null,
  estado text not null default 'CONFIRMADA' check (estado in ('CONFIRMADA', 'CANCELADA')),
  creada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);

-- La proteccion real contra doble reserva: Postgres aplica este indice de forma
-- atomica incluso ante inserciones concurrentes. Es parcial (solo CONFIRMADA) para
-- que cancelar una cita libere el horario para que otro paciente lo reserve.
create unique index if not exists citas_medico_fecha_activa
  on public.citas (medico_id, fecha_hora)
  where estado = 'CONFIRMADA';

create index if not exists citas_paciente_idx on public.citas (paciente_id);
create index if not exists citas_medico_fecha_idx on public.citas (medico_id, fecha_hora);

alter table public.citas enable row level security;

create policy "pacientes leen sus propias citas"
  on public.citas for select
  to authenticated
  using (paciente_id = auth.uid());

create policy "pacientes crean sus propias citas"
  on public.citas for insert
  to authenticated
  with check (paciente_id = auth.uid());

create policy "pacientes actualizan sus propias citas"
  on public.citas for update
  to authenticated
  using (paciente_id = auth.uid());
```

- [ ] **Step 2: Agregar el archivo a la lista de `supabase/README.md`**

Agregar a la lista numerada:

```markdown
6. `migrations/0006_citas.sql`
```

- [ ] **Step 3: Agregar el import a `apps/backend/src/repositories/supabaseRepositories.ts`**

Modificar el bloque de imports al principio del archivo:

```ts
import { diaSemanaDeFecha, generarFranjas } from '../lib/citasSlots';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AppServices,
  AuthService,
  Cita,
  CitasService,
  Especialidad,
  EspecialidadesService,
  Horario,
  HorariosService,
  Medico,
  MedicosService,
} from '../services/appServices';
```

- [ ] **Step 4: Agregar el `CitasService` real, antes del `return { auth, ... }` final**

```ts
  const citas: CitasService = {
    async listSlotsDisponibles(medicoId, fecha) {
      const dia = diaSemanaDeFecha(fecha);
      const { data: bloques } = await client
        .from('horarios')
        .select('hora_inicio, hora_fin')
        .eq('medico_id', medicoId)
        .eq('dia_semana', dia);
      const franjasValidas = ((bloques ?? []) as Array<{ hora_inicio: string; hora_fin: string }>).flatMap((h) =>
        generarFranjas(h.hora_inicio, h.hora_fin)
      );

      const { data: ocupadasRows } = await client
        .from('citas')
        .select('fecha_hora')
        .eq('medico_id', medicoId)
        .eq('estado', 'CONFIRMADA')
        .gte('fecha_hora', `${fecha}T00:00:00`)
        .lte('fecha_hora', `${fecha}T23:59:59`);
      const ocupadas = new Set(
        ((ocupadasRows ?? []) as Array<{ fecha_hora: string }>).map((row) => row.fecha_hora.slice(11, 16))
      );

      return franjasValidas.filter((hora) => !ocupadas.has(hora));
    },

    async create({ pacienteId, medicoId, fechaHora }) {
      const { data: medico } = await client.from('medicos').select('especialidad_id').eq('id', medicoId).single();
      if (!medico) {
        return { ok: false, error: { status: 404, message: 'Médico no encontrado.' } };
      }

      const [fecha, hora] = fechaHora.split('T');
      const dia = diaSemanaDeFecha(fecha);
      const { data: bloques } = await client
        .from('horarios')
        .select('hora_inicio, hora_fin')
        .eq('medico_id', medicoId)
        .eq('dia_semana', dia);
      const franjasValidas = ((bloques ?? []) as Array<{ hora_inicio: string; hora_fin: string }>).flatMap((h) =>
        generarFranjas(h.hora_inicio, h.hora_fin)
      );

      if (!franjasValidas.includes(hora)) {
        return {
          ok: false,
          error: { status: 400, message: 'El horario seleccionado no está disponible. Elige otro para continuar.' },
        };
      }

      const { data, error } = await client
        .from('citas')
        .insert({
          paciente_id: pacienteId,
          medico_id: medicoId,
          especialidad_id: medico.especialidad_id,
          fecha_hora: fechaHora,
          estado: 'CONFIRMADA',
        })
        .select()
        .single();

      if (error) {
        const isDuplicate = error.code === '23505';
        return {
          ok: false,
          error: {
            status: isDuplicate ? 409 : 400,
            message: isDuplicate
              ? 'Lo sentimos, este horario ya no está disponible. Por favor selecciona otro.'
              : error.message,
          },
        };
      }

      return {
        ok: true,
        value: {
          id: data.id,
          pacienteId: data.paciente_id,
          medicoId: data.medico_id,
          especialidadId: data.especialidad_id,
          fechaHora: data.fecha_hora,
          estado: data.estado,
        },
      };
    },

    async listByPaciente(pacienteId) {
      const { data } = await client.from('citas').select('*').eq('paciente_id', pacienteId).order('fecha_hora');
      return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: row.id as string,
        pacienteId: row.paciente_id as string,
        medicoId: row.medico_id as string,
        especialidadId: row.especialidad_id as string,
        fechaHora: row.fecha_hora as string,
        estado: row.estado as 'CONFIRMADA' | 'CANCELADA',
      }));
    },

    async reprogramar(id, pacienteId, fechaHora) {
      const { data: existing } = await client
        .from('citas')
        .select('medico_id')
        .eq('id', id)
        .eq('paciente_id', pacienteId)
        .eq('estado', 'CONFIRMADA')
        .single();

      if (!existing) {
        return { ok: false, error: { status: 404, message: 'Cita no encontrada.' } };
      }

      const [fecha, hora] = fechaHora.split('T');
      const dia = diaSemanaDeFecha(fecha);
      const { data: bloques } = await client
        .from('horarios')
        .select('hora_inicio, hora_fin')
        .eq('medico_id', existing.medico_id)
        .eq('dia_semana', dia);
      const franjasValidas = ((bloques ?? []) as Array<{ hora_inicio: string; hora_fin: string }>).flatMap((h) =>
        generarFranjas(h.hora_inicio, h.hora_fin)
      );

      if (!franjasValidas.includes(hora)) {
        return {
          ok: false,
          error: { status: 400, message: 'El horario seleccionado no está disponible. Elige otro para continuar.' },
        };
      }

      const { data, error } = await client
        .from('citas')
        .update({ fecha_hora: fechaHora, actualizada_en: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        const isDuplicate = error.code === '23505';
        return {
          ok: false,
          error: {
            status: isDuplicate ? 409 : 400,
            message: isDuplicate
              ? 'Lo sentimos, este horario ya no está disponible. Por favor selecciona otro.'
              : error.message,
          },
        };
      }

      return {
        ok: true,
        value: {
          id: data.id,
          pacienteId: data.paciente_id,
          medicoId: data.medico_id,
          especialidadId: data.especialidad_id,
          fechaHora: data.fecha_hora,
          estado: data.estado,
        },
      };
    },

    async cancelar(id, pacienteId) {
      const { data, error } = await client
        .from('citas')
        .update({ estado: 'CANCELADA', actualizada_en: new Date().toISOString() })
        .eq('id', id)
        .eq('paciente_id', pacienteId)
        .select()
        .single();

      if (error || !data) {
        return { ok: false, error: { status: 404, message: 'Cita no encontrada.' } };
      }

      return { ok: true, value: undefined };
    },
  };
```

Y actualizar el `return` final de `createSupabaseServices` para incluir `citas,`:

```ts
  return { auth, especialidades, medicos, horarios, citas };
```

- [ ] **Step 5: Verificar que compila**

Run: `npx tsc -p apps/backend/tsconfig.json --noEmit`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add supabase apps/backend/src/repositories/supabaseRepositories.ts
git commit -m "feat: add citas table with concurrency-safe unique index, and real CitasService"
```

---

### Task 3: Rutas `/api/citas` en Express

**Files:**
- Create: `apps/backend/src/routes/citas.ts`
- Modify: `apps/backend/src/routes/index.ts`
- Test: `apps/backend/tests/citas.test.ts`

**Interfaces:**
- Consumes: `AppServices.citas`, `requireAuth` (Tareas 1, 2).
- Produces: `createCitasRouter(services)`, montado en `/api/citas`.

- [ ] **Step 1: Write the failing tests — `apps/backend/tests/citas.test.ts`**

```ts
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createInMemoryServices } from './helpers/inMemoryServices';

let services: ReturnType<typeof createInMemoryServices>;
let app: ReturnType<typeof createApp>;
let pacienteToken: string;
let pacienteId: string;
let medicoId: string;

beforeEach(async () => {
  services = createInMemoryServices();
  app = createApp(services);

  await services.auth.register({ nombre: 'Ana', apellido: 'Mora', email: 'ana@medtrack.test', password: 'Segura123' });
  const login = await services.auth.login('ana@medtrack.test', 'Segura123');
  if (login.ok) {
    pacienteToken = login.value.token;
    pacienteId = login.value.usuario.id;
  }

  const especialidades = await services.especialidades.list();
  const medico = await services.medicos.create({
    nombre: 'Dr',
    apellido: 'Garcia',
    email: 'garcia@medtrack.test',
    licencia: 'MED-1',
    especialidadId: especialidades[0].id,
  });
  if (medico.ok) medicoId = medico.value.id;

  // 2026-07-16 es jueves
  await services.horarios.create({ medicoId, diaSemana: 'JUE', horaInicio: '08:00', horaFin: '12:00' });
});

describe('GET /api/citas/disponibilidad', () => {
  it('devuelve las franjas libres de un medico en una fecha', async () => {
    const response = await request(app)
      .get(`/api/citas/disponibilidad?medicoId=${medicoId}&fecha=2026-07-16`)
      .set('Authorization', `Bearer ${pacienteToken}`);

    expect(response.status).toBe(200);
    expect(response.body.franjas).toContain('10:00');
  });
});

describe('POST /api/citas', () => {
  it('HU-07 agenda una cita valida', async () => {
    const response = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${pacienteToken}`)
      .send({ medicoId, fechaHora: '2026-07-16T10:00' });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Tu cita ha sido agendada exitosamente.');
  });

  it('HU-07 rechaza la doble reserva del mismo horario (dos pacientes distintos)', async () => {
    await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${pacienteToken}`)
      .send({ medicoId, fechaHora: '2026-07-16T10:00' });

    await services.auth.register({ nombre: 'Otro', apellido: 'Paciente', email: 'otro@medtrack.test', password: 'Segura123' });
    const otroLogin = await services.auth.login('otro@medtrack.test', 'Segura123');
    if (!otroLogin.ok) throw new Error('setup failed');

    const response = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${otroLogin.value.token}`)
      .send({ medicoId, fechaHora: '2026-07-16T10:00' });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Lo sentimos, este horario ya no está disponible. Por favor selecciona otro.');
  });
});

describe('GET /api/citas', () => {
  it('solo devuelve las citas del paciente autenticado', async () => {
    await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${pacienteToken}`)
      .send({ medicoId, fechaHora: '2026-07-16T10:00' });

    const response = await request(app).get('/api/citas').set('Authorization', `Bearer ${pacienteToken}`);

    expect(response.status).toBe(200);
    expect(response.body.citas).toHaveLength(1);
    expect(response.body.citas[0].pacienteId).toBe(pacienteId);
  });
});

describe('PUT /api/citas/:id/reprogramar y /cancelar', () => {
  it('HU-08 reprograma una cita a un nuevo horario', async () => {
    const created = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${pacienteToken}`)
      .send({ medicoId, fechaHora: '2026-07-16T10:00' });

    const response = await request(app)
      .put(`/api/citas/${created.body.cita.id}/reprogramar`)
      .set('Authorization', `Bearer ${pacienteToken}`)
      .send({ fechaHora: '2026-07-16T11:00' });

    expect(response.status).toBe(200);
    expect(response.body.cita.fechaHora).toBe('2026-07-16T11:00');
  });

  it('HU-09 cancela una cita y libera el horario', async () => {
    const created = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${pacienteToken}`)
      .send({ medicoId, fechaHora: '2026-07-16T10:00' });

    const cancelResponse = await request(app)
      .put(`/api/citas/${created.body.cita.id}/cancelar`)
      .set('Authorization', `Bearer ${pacienteToken}`);
    expect(cancelResponse.status).toBe(200);

    const disponibilidad = await request(app)
      .get(`/api/citas/disponibilidad?medicoId=${medicoId}&fecha=2026-07-16`)
      .set('Authorization', `Bearer ${pacienteToken}`);
    expect(disponibilidad.body.franjas).toContain('10:00');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test --workspace=apps/backend -- tests/citas.test.ts`
Expected: FAIL — 404 (no existe `/api/citas` todavía).

- [ ] **Step 3: Crear `apps/backend/src/routes/citas.ts`**

```ts
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth';
import type { AppServices } from '../services/appServices';

const fechaHoraSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'La fecha y hora no son válidas.');

const crearCitaSchema = z.object({
  medicoId: z.string().trim().min(1, 'El médico es obligatorio.'),
  fechaHora: fechaHoraSchema,
});

const reprogramarSchema = z.object({
  fechaHora: fechaHoraSchema,
});

export function createCitasRouter(services: AppServices) {
  const router = Router();

  router.get('/disponibilidad', requireAuth(services), async (req, res) => {
    const medicoId = typeof req.query.medicoId === 'string' ? req.query.medicoId : '';
    const fecha = typeof req.query.fecha === 'string' ? req.query.fecha : '';
    if (!medicoId || !fecha) {
      res.status(400).json({ error: 'Médico y fecha son obligatorios.' });
      return;
    }

    const franjas = await services.citas.listSlotsDisponibles(medicoId, fecha);
    res.status(200).json({ franjas });
  });

  router.get('/', requireAuth(services), async (req, res) => {
    const citas = await services.citas.listByPaciente(req.user!.id);
    res.status(200).json({ citas });
  });

  router.post('/', requireAuth(services), async (req, res) => {
    const parsed = crearCitaSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]!.message });
      return;
    }

    const result = await services.citas.create({
      pacienteId: req.user!.id,
      medicoId: parsed.data.medicoId,
      fechaHora: parsed.data.fechaHora,
    });
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.message });
      return;
    }

    res.status(201).json({ message: 'Tu cita ha sido agendada exitosamente.', cita: result.value });
  });

  router.put('/:id/reprogramar', requireAuth(services), async (req, res) => {
    const parsed = reprogramarSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]!.message });
      return;
    }

    const result = await services.citas.reprogramar(req.params.id!, req.user!.id, parsed.data.fechaHora);
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.message });
      return;
    }

    res.status(200).json({ message: 'Tu cita ha sido reprogramada exitosamente.', cita: result.value });
  });

  router.put('/:id/cancelar', requireAuth(services), async (req, res) => {
    const result = await services.citas.cancelar(req.params.id!, req.user!.id);
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.message });
      return;
    }

    res.status(200).json({ message: 'Tu cita ha sido cancelada.' });
  });

  return router;
}
```

- [ ] **Step 4: Montar el router — modificar `apps/backend/src/routes/index.ts`**

```ts
import { Router } from 'express';
import type { AppServices } from '../services/appServices';
import { createAuthRouter } from './auth';
import { createCitasRouter } from './citas';
import { createEspecialidadesRouter } from './especialidades';
import { createHorariosRouter } from './horarios';
import { createMedicosRouter } from './medicos';
import { healthRouter } from './health';

export function apiRouter(services: AppServices) {
  const router = Router();
  router.use(healthRouter);
  router.use('/api/auth', createAuthRouter(services));
  router.use('/api/especialidades', createEspecialidadesRouter(services));
  router.use('/api/medicos', createMedicosRouter(services));
  router.use('/api/horarios', createHorariosRouter(services));
  router.use('/api/citas', createCitasRouter(services));
  return router;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test --workspace=apps/backend -- tests/citas.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 6: Run the full backend suite**

Run: `npm run test --workspace=apps/backend`
Expected: todos los archivos en verde.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/routes/citas.ts apps/backend/src/routes/index.ts apps/backend/tests/citas.test.ts
git commit -m "feat(HU-07,HU-08,HU-09): rutas de citas via Express, con test explicito de doble reserva"
```

---

### Task 4: Frontend — reservar cita desde `AvailabilityPage` (HU-07)

**Files:**
- Modify: `apps/frontend/src/pages/patient/AvailabilityPage.tsx`
- Modify: `apps/frontend/tests/AvailabilityPage.test.tsx`

**Interfaces:**
- Consumes: `apiRequest`, `getSession` (`lib/api.ts`).

- [ ] **Step 1: Write the failing test — agregar a `apps/frontend/tests/AvailabilityPage.test.tsx`**

Agregar al final del `describe('AvailabilityPage', ...)`, después del test de Realtime:

```tsx
  it('HU-07 permite reservar una franja disponible', async () => {
    mockJsonResponse({ especialidades: [] });
    mockJsonResponse({ medicos: [{ id: 'med-1', nombre: 'Dr', apellido: 'Lopez', especialidadId: 'esp-1' }] });
    mockJsonResponse({ horarios: [{ id: 'h1', medicoId: 'med-1', diaSemana: 'JUE', horaInicio: '08:00', horaFin: '12:00' }] });

    renderPage();
    await screen.findByText(/Dr Lopez/);

    fireEvent.click(screen.getByRole('button', { name: 'Reservar' }));

    mockJsonResponse({ franjas: ['08:00', '08:30', '09:00'] });
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-07-16' } });

    await waitFor(() => expect(screen.getByLabelText('Hora disponible')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Hora disponible'), { target: { value: '08:30' } });

    mockJsonResponse({ message: 'Tu cita ha sido agendada exitosamente.', cita: { id: 'c1' } }, true, 201);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar reserva' }));

    expect(await screen.findByText('Tu cita ha sido agendada exitosamente.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/citas'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ medicoId: 'med-1', fechaHora: '2026-07-16T08:30' }),
      })
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/frontend -- AvailabilityPage`
Expected: FAIL — no existe el botón "Reservar" todavía.

- [ ] **Step 3: Leer el archivo actual antes de editar**

Antes de modificar, releer `apps/frontend/src/pages/patient/AvailabilityPage.tsx` completo
para conservar el bloque de Realtime (`useEffect` con `supabase.channel(...)`) y el
filtro por especialidad tal cual — solo se agrega el flujo de reserva.

- [ ] **Step 4: Agregar el flujo de reserva a `apps/frontend/src/pages/patient/AvailabilityPage.tsx`**

Agregar estos imports:

```tsx
import { FormEvent, useEffect, useState } from 'react';
```

(reemplaza el `import { useEffect, useState } from 'react';` existente).

Agregar estos tipos e interfaces, junto a los existentes (`Especialidad`, `Medico`, `Horario`):

```tsx
interface Reserva {
  medicoId: string;
  fecha: string;
  franjas: string[];
  franjaSeleccionada: string;
}
```

Dentro del componente `AvailabilityPage`, agregar el estado nuevo (junto a los `useState` existentes):

```tsx
  const [reserva, setReserva] = useState<Reserva | null>(null);
  const [reservaStatus, setReservaStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
```

Agregar estas funciones dentro del componente, antes del `return`:

```tsx
  function iniciarReserva(medicoId: string) {
    setReservaStatus(null);
    setReserva({ medicoId, fecha: '', franjas: [], franjaSeleccionada: '' });
  }

  async function handleFechaChange(fecha: string) {
    if (!reserva) return;
    const { token } = getSession();
    const response = await apiRequest<{ franjas: string[] }>(
      `/api/citas/disponibilidad?medicoId=${reserva.medicoId}&fecha=${fecha}`,
      { token }
    );
    setReserva({ ...reserva, fecha, franjas: response.franjas, franjaSeleccionada: '' });
  }

  async function handleConfirmarReserva(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reserva) return;
    const { token } = getSession();

    try {
      const response = await apiRequest<{ message: string }>('/api/citas', {
        method: 'POST',
        token,
        body: { medicoId: reserva.medicoId, fechaHora: `${reserva.fecha}T${reserva.franjaSeleccionada}` },
      });
      setReservaStatus({ tone: 'success', message: response.message });
      setReserva(null);
    } catch (error) {
      setReservaStatus({ tone: 'error', message: (error as Error).message });
    }
  }
```

Dentro del `.map((horario) => (...))` que renderiza cada horario, agregar un botón "Reservar"
justo después del `<p>` que muestra el día/hora (dentro del mismo `<div key={horario.id}>`):

```tsx
              <button
                type="button"
                className="mt-3 rounded-md bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800"
                onClick={() => iniciarReserva(horario.medicoId)}
              >
                Reservar
              </button>
```

Y justo antes del `</AppShell>` de cierre, agregar el panel de reserva (usa `WorkPanel`, ya
importado):

```tsx
      {reserva ? (
        <div className="mt-6">
          <WorkPanel title="Reservar cita">
            <form className="grid gap-4" onSubmit={handleConfirmarReserva}>
              <label className="block text-sm font-semibold text-slate-700" htmlFor="fechaReserva">
                Fecha
                <input
                  id="fechaReserva"
                  type="date"
                  required
                  value={reserva.fecha}
                  onChange={(event) => handleFechaChange(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
                />
              </label>
              {reserva.fecha ? (
                <label className="block text-sm font-semibold text-slate-700" htmlFor="horaReserva">
                  Hora disponible
                  <select
                    id="horaReserva"
                    required
                    value={reserva.franjaSeleccionada}
                    onChange={(event) => setReserva({ ...reserva, franjaSeleccionada: event.target.value })}
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
                  >
                    <option value="">Seleccione una hora</option>
                    {reserva.franjas.map((franja) => (
                      <option key={franja} value={franja}>
                        {franja}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {reservaStatus ? <StatusMessage tone={reservaStatus.tone} message={reservaStatus.message} /> : null}
              <button className="rounded-md bg-teal-700 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-800 sm:w-fit">
                Confirmar reserva
              </button>
            </form>
          </WorkPanel>
        </div>
      ) : null}
```

Agregar el import de `StatusMessage` (usado arriba) junto a los demás imports:

```tsx
import { StatusMessage } from '../../components/StatusMessage';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test --workspace=apps/frontend -- AvailabilityPage`
Expected: PASS — 4 tests en total en este archivo.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/pages/patient/AvailabilityPage.tsx apps/frontend/tests/AvailabilityPage.test.tsx
git commit -m "feat(HU-07): reservar cita desde AvailabilityPage"
```

---

### Task 5: Frontend — `AppointmentsPage` real (HU-08, HU-09)

**Files:**
- Modify: `apps/frontend/src/pages/patient/AppointmentsPage.tsx`
- Create: `apps/frontend/tests/AppointmentsPage.test.tsx`

**Interfaces:**
- Consumes: `apiRequest`, `getSession` (`lib/api.ts`), `patientNavItems` (`lib/nav.ts`).

- [ ] **Step 1: Write the failing tests — `apps/frontend/tests/AppointmentsPage.test.tsx`**

```tsx
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
const confirmMock = vi.fn(() => true);

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('confirm', confirmMock);
  localStorage.setItem('medtrack.token', 'paciente-token');
  localStorage.setItem(
    'medtrack.user',
    JSON.stringify({ id: 'p1', email: 'ana@medtrack.test', nombre: 'Ana', apellido: 'Mora', rol: 'PACIENTE' })
  );
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  confirmMock.mockClear();
});

import { AuthProvider } from '../src/context/AuthContext';
import { AppointmentsPage } from '../src/pages/patient/AppointmentsPage';

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  fetchMock.mockResolvedValueOnce({ ok, status, json: async () => body });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <AppointmentsPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

const citaBase = {
  id: 'c1',
  pacienteId: 'p1',
  medicoId: 'med-1',
  especialidadId: 'esp-1',
  fechaHora: '2026-07-16T10:00',
  estado: 'CONFIRMADA',
};

describe('AppointmentsPage', () => {
  it('lista las citas del paciente', async () => {
    mockJsonResponse({ medicos: [{ id: 'med-1', nombre: 'Dr', apellido: 'Lopez', especialidadId: 'esp-1' }] });
    mockJsonResponse({ citas: [citaBase] });

    renderPage();

    expect(await screen.findByText(/Dr Lopez/)).toBeInTheDocument();
    expect(screen.getByText(/2026-07-16/)).toBeInTheDocument();
  });

  it('HU-09 cancela una cita con confirmacion', async () => {
    mockJsonResponse({ medicos: [{ id: 'med-1', nombre: 'Dr', apellido: 'Lopez', especialidadId: 'esp-1' }] });
    mockJsonResponse({ citas: [citaBase] });

    renderPage();
    await screen.findByText(/Dr Lopez/);

    mockJsonResponse({ message: 'Tu cita ha sido cancelada.' });
    mockJsonResponse({ medicos: [{ id: 'med-1', nombre: 'Dr', apellido: 'Lopez', especialidadId: 'esp-1' }] });
    mockJsonResponse({ citas: [{ ...citaBase, estado: 'CANCELADA' }] });

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(confirmMock).toHaveBeenCalled());
    expect(await screen.findByText('CANCELADA')).toBeInTheDocument();
  });

  it('HU-08 reprograma una cita a una nueva franja', async () => {
    mockJsonResponse({ medicos: [{ id: 'med-1', nombre: 'Dr', apellido: 'Lopez', especialidadId: 'esp-1' }] });
    mockJsonResponse({ citas: [citaBase] });

    renderPage();
    await screen.findByText(/Dr Lopez/);

    fireEvent.click(screen.getByRole('button', { name: 'Reprogramar' }));

    mockJsonResponse({ franjas: ['11:00', '11:30'] });
    fireEvent.change(screen.getByLabelText('Nueva fecha'), { target: { value: '2026-07-16' } });

    await waitFor(() => expect(screen.getByLabelText('Nueva hora')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Nueva hora'), { target: { value: '11:00' } });

    mockJsonResponse({ message: 'Tu cita ha sido reprogramada exitosamente.', cita: { ...citaBase, fechaHora: '2026-07-16T11:00' } }, true, 200);
    mockJsonResponse({ medicos: [{ id: 'med-1', nombre: 'Dr', apellido: 'Lopez', especialidadId: 'esp-1' }] });
    mockJsonResponse({ citas: [{ ...citaBase, fechaHora: '2026-07-16T11:00' }] });

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar nueva fecha' }));

    expect(await screen.findByText('Tu cita ha sido reprogramada exitosamente.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test --workspace=apps/frontend -- AppointmentsPage`
Expected: FAIL — la página actual solo muestra el placeholder estático.

- [ ] **Step 3: Reescribir `apps/frontend/src/pages/patient/AppointmentsPage.tsx`**

```tsx
import { FormEvent, useEffect, useState } from 'react';
import { AppShell, WorkPanel } from '../../components/AppShell';
import { StatusMessage } from '../../components/StatusMessage';
import { apiRequest, getSession } from '../../lib/api';
import { patientNavItems } from '../../lib/nav';

interface MedicoOption {
  id: string;
  nombre: string;
  apellido: string;
  especialidadId: string;
}

interface Cita {
  id: string;
  pacienteId: string;
  medicoId: string;
  especialidadId: string;
  fechaHora: string;
  estado: 'CONFIRMADA' | 'CANCELADA';
}

interface Reprogramacion {
  citaId: string;
  medicoId: string;
  fecha: string;
  franjas: string[];
  franjaSeleccionada: string;
}

export function AppointmentsPage() {
  const [medicos, setMedicos] = useState<MedicoOption[]>([]);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [reprogramacion, setReprogramacion] = useState<Reprogramacion | null>(null);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  async function cargarDatos() {
    const { token } = getSession();
    const [medicosRes, citasRes] = await Promise.all([
      apiRequest<{ medicos: MedicoOption[] }>('/api/medicos', { token }),
      apiRequest<{ citas: Cita[] }>('/api/citas', { token }),
    ]);
    setMedicos(medicosRes.medicos);
    setCitas(citasRes.citas);
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  function medicoLabel(medicoId: string) {
    const medico = medicos.find((m) => m.id === medicoId);
    return medico ? `Dr ${medico.nombre} ${medico.apellido}` : medicoId;
  }

  async function handleCancelar(citaId: string) {
    if (!window.confirm('¿Seguro que querés cancelar esta cita?')) {
      return;
    }
    setStatus(null);
    const { token } = getSession();
    try {
      const response = await apiRequest<{ message: string }>(`/api/citas/${citaId}/cancelar`, {
        method: 'PUT',
        token,
      });
      setStatus({ tone: 'success', message: response.message });
      await cargarDatos();
    } catch (error) {
      setStatus({ tone: 'error', message: (error as Error).message });
    }
  }

  function iniciarReprogramacion(cita: Cita) {
    setStatus(null);
    setReprogramacion({ citaId: cita.id, medicoId: cita.medicoId, fecha: '', franjas: [], franjaSeleccionada: '' });
  }

  async function handleNuevaFecha(fecha: string) {
    if (!reprogramacion) return;
    const { token } = getSession();
    const response = await apiRequest<{ franjas: string[] }>(
      `/api/citas/disponibilidad?medicoId=${reprogramacion.medicoId}&fecha=${fecha}`,
      { token }
    );
    setReprogramacion({ ...reprogramacion, fecha, franjas: response.franjas, franjaSeleccionada: '' });
  }

  async function handleConfirmarReprogramacion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reprogramacion) return;
    const { token } = getSession();

    try {
      const response = await apiRequest<{ message: string }>(`/api/citas/${reprogramacion.citaId}/reprogramar`, {
        method: 'PUT',
        token,
        body: { fechaHora: `${reprogramacion.fecha}T${reprogramacion.franjaSeleccionada}` },
      });
      setStatus({ tone: 'success', message: response.message });
      setReprogramacion(null);
      await cargarDatos();
    } catch (error) {
      setStatus({ tone: 'error', message: (error as Error).message });
    }
  }

  return (
    <AppShell title="Mis citas" subtitle="Consulta de solicitudes y proximas citas medicas." navItems={patientNavItems}>
      {status ? <StatusMessage tone={status.tone} message={status.message} /> : null}

      {citas.length ? (
        <div className="mt-4 grid gap-4">
          {citas.map((cita) => (
            <div key={cita.id} className="rounded-md border border-slate-200 bg-white p-4">
              <p className="font-semibold">{medicoLabel(cita.medicoId)}</p>
              <p className="mt-1 text-sm text-slate-600">{cita.fechaHora}</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">{cita.estado}</p>
              {cita.estado === 'CONFIRMADA' ? (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => iniciarReprogramacion(cita)}
                  >
                    Reprogramar
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-rose-300 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                    onClick={() => handleCancelar(cita.id)}
                  >
                    Cancelar
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-600">Todavia no hay citas registradas.</p>
      )}

      {reprogramacion ? (
        <div className="mt-6">
          <WorkPanel title="Reprogramar cita">
            <form className="grid gap-4" onSubmit={handleConfirmarReprogramacion}>
              <label className="block text-sm font-semibold text-slate-700" htmlFor="nuevaFecha">
                Nueva fecha
                <input
                  id="nuevaFecha"
                  type="date"
                  required
                  value={reprogramacion.fecha}
                  onChange={(event) => handleNuevaFecha(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
                />
              </label>
              {reprogramacion.fecha ? (
                <label className="block text-sm font-semibold text-slate-700" htmlFor="nuevaHora">
                  Nueva hora
                  <select
                    id="nuevaHora"
                    required
                    value={reprogramacion.franjaSeleccionada}
                    onChange={(event) => setReprogramacion({ ...reprogramacion, franjaSeleccionada: event.target.value })}
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
                  >
                    <option value="">Seleccione una hora</option>
                    {reprogramacion.franjas.map((franja) => (
                      <option key={franja} value={franja}>
                        {franja}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button className="rounded-md bg-teal-700 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-800 sm:w-fit">
                Confirmar nueva fecha
              </button>
            </form>
          </WorkPanel>
        </div>
      ) : null}
    </AppShell>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test --workspace=apps/frontend -- AppointmentsPage`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/pages/patient/AppointmentsPage.tsx apps/frontend/tests/AppointmentsPage.test.tsx
git commit -m "feat(HU-08,HU-09): reprogramar y cancelar citas desde AppointmentsPage"
```

---

### Task 6: `CLAUDE.md` y verificación final

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Actualizar el backlog en `CLAUDE.md`**

Reemplazar:

```markdown
### Épica 3 – Gestión de Citas Médicas

- [ ] HU-07 Crear Cita Médica — pendiente
- [ ] HU-08 Reprogramar Cita — pendiente
- [ ] HU-09 Cancelar Cita — pendiente
```

por:

```markdown
### Épica 3 – Gestión de Citas Médicas

- [x] HU-07 Crear Cita Médica — completada en Sprint 2
- [x] HU-08 Reprogramar Cita — completada en Sprint 2
- [x] HU-09 Cancelar Cita — completada en Sprint 2
```

- [ ] **Step 2: Agregar una nota sobre la protección de concurrencia**

Agregar al final de la sección `## Notas de Épica 1 y 2 (Express + Supabase)` (y
renombrar el título a `## Notas de Épica 1, 2 y 3 (Express + Supabase)`):

```markdown
- HU-07/08/09 (citas): la protección contra doble reserva es un índice único parcial en
  Postgres (`citas_medico_fecha_activa` en `supabase/migrations/0006_citas.sql`), no una
  verificación en JavaScript — es lo único que garantiza que dos pacientes no puedan
  reservar el mismo médico a la misma hora aunque lo intenten al mismo tiempo.
- `fechaHora` se maneja como el string `"YYYY-MM-DDTHH:mm"` en todo el sistema (sin zona
  horaria) — simplificación deliberada para este proyecto académico.
```

- [ ] **Step 3: Verificación final**

Run: `npm install && npm test`
Expected: todos los tests de `apps/backend` y `apps/frontend` pasan.

Run: `npx tsc -p apps/backend/tsconfig.json --noEmit && npx tsc -p apps/frontend/tsconfig.json`
Expected: sin errores de tipos.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: mark Epica 3 as completed and document the concurrency guarantee"
```
