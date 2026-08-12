# Épica 4 — Notificaciones (Design)

## Contexto

HU-10 (Confirmación por Correo), HU-11 (Recordatorio de Citas), HU-12 (Notificación de
Cancelación). El equipo saltó esta épica para adelantar Épica 5 (Reportes); ahora se retoma
porque un compañero (SKY-887) abrió el PR #7 (`sprint-3-notificaciones`) implementándola,
y ese PR **tiene que quedar mergeado a `main` desde GitHub** (requisito del equipo/curso).

`sprint-3-notificaciones` se ramificó antes de que existieran Épica 3 (citas) y Épica 5
(reportes) en `main`, así que reimplementó su propia versión incompatible de `citas` y de
reportes. Su modelo de `Cita` (`estado: 'RESERVADA'|'CANCELADA'`, `horarioId`+`fecha`+
`horaInicio` separados) es estructuralmente distinto del que ya está en producción
(`estado: 'CONFIRMADA'|'CANCELADA'`, `fechaHora` combinado, protegido por el índice único
parcial anti-doble-reserva, con soporte de reprogramar). No se pueden fusionar ambos
modelos sin romper compilación o retroceder funcionalidad ya en producción.

**Estrategia:** resolver el merge del PR #7 quedándonos con el `citas`/`reportes` que ya
funciona en `main`, y adaptando la parte de notificaciones del PR (que está bien diseñada y
desacoplada del modelo de `Cita`) para que enganche con nuestro `CitasService` real. El
commit de merge resultante tiene como padre el commit original de `sprint-3-notificaciones`
(su autoría queda en el historial de git), pero el árbol de archivos final es nuestro código
+ notificaciones — no su reimplementación de citas/reportes.

## Qué se porta del PR #7 (adaptado)

- `apps/backend/src/services/emailService.ts` — se porta casi textual. `createEmailSender()`
  devuelve un `MockEmailSender` (loguea en consola) o un `ResendEmailSender` según
  `env.emailProvider`. **Se usa el mock** (decisión del equipo): no se configura
  `RESEND_API_KEY`, así que `createEmailSender()` siempre devuelve el mock en este entorno.
- `apps/backend/src/routes/notificaciones.ts` — se porta tal cual: `GET /api/notificaciones`,
  admin-only, devuelve `services.notificaciones.list()`.
- `apps/backend/src/jobs/reminderJob.ts` — se porta tal cual: `setInterval` que llama a
  `services.citas.send24HourReminders()` cada hora, más una corrida inmediata al arrancar.
  Se engancha en `server.ts` con `startReminderJob(services)`.
- `apps/frontend/src/pages/admin/NotificationsPage.tsx` — se porta tal cual (ya está
  desacoplada del modelo de `Cita`, solo lee `tipo`/`email`/`detalle`/`enviadoEn`).
- `env.ts` gana `emailProvider`, `resendApiKey`, `resendFrom` (mismos nombres que el PR).

## Qué se adapta (no se porta tal cual)

### Tipos nuevos en `apps/backend/src/services/appServices.ts`

```ts
export type TipoNotificacion = 'CONFIRMACION_RESERVA' | 'RECORDATORIO_24H' | 'CANCELACION_CITA';

export interface Notificacion {
  id: string;
  usuarioId: string;
  email: string;
  tipo: TipoNotificacion;
  citaId: string;
  enviadoEn: string;
  detalle?: string;
}

export interface NotificacionesService {
  list(): Promise<Notificacion[]>;
}
```

`AppServices` gana `notificaciones: NotificacionesService`.

### Extensión de `Cita` y `CitasService` (NO se reemplaza, se extiende)

```ts
export interface Cita {
  id: string;
  pacienteId: string;
  medicoId: string;
  especialidadId: string;
  fechaHora: string;
  estado: 'CONFIRMADA' | 'CANCELADA';
  motivoCancelacion?: string;   // nuevo
  recordatorioEnviado: boolean; // nuevo
}

export interface CitasService {
  listSlotsDisponibles(medicoId: string, fecha: string): Promise<string[]>;
  create(input: CreateCitaInput): Promise<Result<Cita>>;
  listByPaciente(pacienteId: string): Promise<Cita[]>;
  reprogramar(id: string, pacienteId: string, fechaHora: string): Promise<Result<Cita>>;
  cancelar(id: string, pacienteId: string, motivo?: string): Promise<Result<void>>; // gana motivo
  send24HourReminders(ahora?: Date): Promise<{ processed: number }>; // nuevo
}
```

`cancelar` gana un tercer parámetro opcional `motivo?: string` — todos los call sites
existentes (`routes/citas.ts`, ambos repositorios, todos los tests que ya llaman
`cancelar(id, pacienteId)`) siguen compilando sin cambios porque el parámetro es opcional.

### Disparo de notificaciones

Al crear una cita exitosamente (`CitasService.create`), además de insertar la fila en
`citas`, se llama a `emailSender.send(...)` (mock) y se registra una fila en
`notificaciones` con `tipo: 'CONFIRMACION_RESERVA'`.

Al cancelar exitosamente (`CitasService.cancelar`), se guarda `motivoCancelacion` en la
cita, se envía el correo mock, y se registra `tipo: 'CANCELACION_CITA'` con el motivo en
`detalle`.

### `send24HourReminders(ahora = new Date())`

Recorre las citas `CONFIRMADA` con `recordatorioEnviado === false` cuya `fechaHora` cae
entre `ahora` y `ahora + 24h` (comparación de fecha/hora real, no de string — a diferencia
del resto del sistema, acá sí hace falta aritmética de fechas real porque es una ventana
deslizante, no un día calendario). Por cada una: envía el correo mock, marca
`recordatorioEnviado = true`, registra una notificación `RECORDATORIO_24H`, y no la vuelve a
procesar en la siguiente corrida (de ahí el parámetro `ahora` inyectable — mismo patrón que
`hoy: string` en `ReportesService`, para que el test controle el reloj sin mockear `Date`
global).

## Migración SQL nueva — `supabase/migrations/0007_notificaciones.sql`

No se toca el esquema de `citas` de forma incompatible — se le agregan dos columnas:

```sql
alter table public.citas
  add column if not exists motivo_cancelacion text,
  add column if not exists recordatorio_enviado boolean not null default false;

create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  email text not null,
  tipo text not null check (tipo in ('CONFIRMACION_RESERVA', 'RECORDATORIO_24H', 'CANCELACION_CITA')),
  cita_id uuid not null references public.citas (id) on delete cascade,
  detalle text,
  enviado_en timestamptz not null default now()
);

alter table public.notificaciones enable row level security;

create policy "admins leen notificaciones"
  on public.notificaciones for select
  using (exists (select 1 from public.perfiles where id = auth.uid() and rol = 'ADMIN'));
```

(Tomado casi textual de la tabla `notificaciones` del PR #7 — esa parte sí era compatible,
porque `cita_id` es solo una referencia UUID, no depende de la forma interna de `citas`.)

## Backend — rutas

`GET /api/notificaciones` (nueva, admin-only) — igual que el PR #7.

`PUT /api/citas/:id/cancelar` (ya existe) — el body gana un campo opcional `motivo`:

```ts
const cancelarSchema = z.object({ motivo: z.string().trim().max(500).optional() });
```

## Frontend

- `NotificationsPage.tsx` — se porta tal cual, montada en `/admin/notifications`, con su
  entrada en `adminNavItems`.
- `AppointmentsPage.tsx` (ya existe) — el botón "Cancelar" pasa de un `window.confirm` simple
  a un pequeño formulario inline que pide el motivo (texto libre, opcional) antes de
  confirmar, y lo manda en el body del `PUT .../cancelar`.

## Testing

**Backend:**
- `inMemoryServices.test.ts` — casos nuevos: `cancelar` con motivo lo persiste; `create`
  registra una notificación `CONFIRMACION_RESERVA`; `cancelar` registra
  `CANCELACION_CITA` con el motivo en `detalle`; `send24HourReminders` procesa una vez y no
  duplica en la segunda corrida (con una fecha `ahora` fija inyectada, igual que el test del
  PR #7 pero contra nuestro modelo de `Cita`).
- `notificaciones.test.ts` (nuevo) — supertest sobre `GET /api/notificaciones` (incluye
  403 para no-ADMIN) y sobre el flujo completo reserva→notificación/cancelación→notificación
  vía HTTP.
- `reminderJob.test.ts` (nuevo, opcional si el tiempo alcanza) — verifica que
  `startReminderJob` llama a `send24HourReminders` al arrancar y en cada intervalo (con
  `vi.useFakeTimers()`).

**Frontend:**
- `NotificationsPage.test.tsx` (nuevo) — lista y filtra por tipo.
- `AppointmentsPage.test.tsx` (existente) — caso nuevo: cancelar con motivo lo manda en el
  body del PUT.

## Fuera de alcance (explícito, se descarta del PR #7)

- Su reimplementación completa de citas/reservas (rutas, `AvailabilityPage`,
  `AppointmentsPage` de reserva, `PatientDashboardPage`) — se descarta, la nuestra ya
  funciona con protección de concurrencia y reprogramar.
- Su duplicado de reportes (`GET /api/reportes/resumen`, cambios a `ReportsPage.tsx` y
  `AdminDashboardPage.tsx`) — se descarta, ya está Épica 5.
- CRUD de especialidades (crear/editar/eliminar), cambios a `DoctorsPage.tsx`/
  `SchedulesPage.tsx`, datos semilla, política `admin_read_citas` — fuera de alcance de
  Épica 4, no se tocan.
- Envío real de correo vía Resend — se deja el mock; `RESEND_API_KEY` no se configura.

## Integración con el PR #7

El resultado se commitea como un **merge commit** en una rama local que trackea
`origin/sprint-3-notificaciones`, con `origin/main` mergeado adentro — así el commit
original de SKY-887 queda como ancestro real (su autoría se preserva en el historial de
git). Se pushea a `origin/sprint-3-notificaciones` (con confirmación explícita antes del
push, por tratarse de la rama de otra persona), y desde ahí el PR #7 deja de mostrar
conflictos en GitHub y se puede mergear con el botón normal.