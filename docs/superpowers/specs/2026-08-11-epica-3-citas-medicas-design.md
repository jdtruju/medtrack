# Épica 3 — Gestión de Citas Médicas — Diseño

**Fecha:** 2026-08-11
**Alcance:** HU-07 (Crear Cita), HU-08 (Reprogramar Cita), HU-09 (Cancelar Cita). Mismo
patrón que las épicas anteriores: Express + `AppServices` (fake en memoria para tests,
Supabase real en producción).

## Contexto

Hasta ahora existe `horarios` (Épica 2): bloques semanales recurrentes por médico (día +
hora inicio/fin). Una `cita` es distinta: reserva un **instante específico** (fecha + hora
concreta, ej. "miércoles 16 de julio a las 10:00") dentro de uno de esos bloques. Esta
épica introduce esa tabla y la lógica de reserva/reprogramación/cancelación.

## El punto crítico: evitar doble reserva a nivel de base de datos

El requisito explícito del usuario es que la validación de "dos pacientes no pueden
reservar el mismo horario" sea segura a nivel de base de datos, no solo en el frontend o
en JavaScript del backend. La solución es un **índice único parcial** en Postgres:

```sql
create unique index citas_medico_fecha_activa
  on public.citas (medico_id, fecha_hora)
  where estado = 'CONFIRMADA';
```

Esto hace que, ante dos `INSERT` concurrentes para el mismo `(medico_id, fecha_hora)`,
Postgres deje pasar solo uno de forma atómica y rechace el otro con un error
`23505` (unique_violation) — sin ninguna ventana de carrera posible, sin importar qué
tan rápido lleguen las peticiones. El código de Express solo traduce ese error a un
mensaje claro para el usuario; **la garantía real la da el índice, no el código**.

Como el índice es parcial (`where estado = 'CONFIRMADA'`), cancelar una cita
(`estado = 'CANCELADA'`) libera automáticamente ese horario para que alguien más lo
reserve — no hace falta ninguna lógica adicional de "liberación".

**Limitación de esta sesión:** no hay conexión real a Postgres desde aquí. El fake en
memoria replica la misma regla ("un solo `CONFIRMADA` por médico+hora"), lo que prueba
que la lógica de la aplicación maneja bien el rechazo del segundo intento — pero la
prueba de concurrencia *real* (dos inserciones verdaderamente simultáneas) solo la
garantiza el índice único cuando corra contra el Postgres real del usuario. Esto queda
documentado explícitamente, no se finge una prueba de concurrencia real que no se puede
ejecutar aquí.

## Modelo de datos — `supabase/migrations/0006_citas.sql`

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

create unique index citas_medico_fecha_activa
  on public.citas (medico_id, fecha_hora)
  where estado = 'CONFIRMADA';

alter table public.citas enable row level security;

create policy "pacientes leen sus propias citas"
  on public.citas for select to authenticated
  using (paciente_id = auth.uid());

create policy "pacientes crean sus propias citas"
  on public.citas for insert to authenticated
  with check (paciente_id = auth.uid());

create policy "pacientes actualizan sus propias citas"
  on public.citas for update to authenticated
  using (paciente_id = auth.uid());
```

Express usa el `service_role` para todo (igual que en las épicas anteriores), así que la
RLS es una capa de defensa adicional, no el mecanismo principal de autorización — eso lo
sigue haciendo Express filtrando siempre por `paciente_id = req.user.id`.

## Reglas de negocio

- **Franjas de reserva:** se generan en bloques de **30 minutos** dentro de cada `horario`
  del médico (decisión de diseño, no viene especificada en el backlog — el usuario puede
  pedir otra duración si lo prefiere).
- **Crear cita (HU-07):** el paciente elige médico + fecha + una franja disponible ese
  día. Se valida que la franja caiga dentro de un bloque de `horarios` del médico para
  ese día de la semana, y que no exista ya una cita `CONFIRMADA` en ese instante para ese
  médico (el índice único es la garantía final; el chequeo previo en la app es solo para
  dar un mensaje más rápido en el caso no concurrente).
- **Reprogramar (HU-08):** actualiza el `fecha_hora` de la **misma fila** (no crea una
  cita nueva). El horario anterior queda libre automáticamente porque la fila que lo
  ocupaba ya no apunta ahí. La nueva fecha/hora pasa por la misma validación de
  disponibilidad y el mismo índice único.
- **Cancelar (HU-09):** el frontend pide confirmación (diálogo nativo) antes de llamar al
  endpoint. Marca `estado = 'CANCELADA'`. La notificación por correo real (HU-12, Épica 4)
  queda fuera de alcance — por ahora el evento queda registrado en la propia fila
  (`actualizada_en`); no se envía ningún correo todavía.

## Endpoints (`/api/citas`)

| Método y ruta | Auth | Detalle |
|---|---|---|
| `GET /citas/disponibilidad?medicoId=&fecha=` | requireAuth | Franjas de 30 min libres ese día para ese médico, cruzando `horarios` con las citas `CONFIRMADA` existentes. |
| `POST /citas` | requireAuth | `{ medicoId, fechaHora }`. Deriva `especialidadId` del médico. Conflicto → 409. |
| `GET /citas` | requireAuth | Solo las citas del usuario autenticado (`paciente_id` se toma de `req.user.id`, nunca de un parámetro). |
| `PUT /citas/:id/reprogramar` | requireAuth | `{ fechaHora }`. Solo si la cita es del usuario autenticado. |
| `PUT /citas/:id/cancelar` | requireAuth | Solo si la cita es del usuario autenticado. |

## Frontend

- `AvailabilityPage` (HU-06, ya existe): se agrega un botón "Reservar" por médico que
  abre un selector de fecha → trae las franjas disponibles → confirma la reserva.
- `AppointmentsPage` (ya existe como placeholder "Mis citas"): pasa a listar las citas
  reales del paciente, con acciones "Reprogramar" (elige nueva fecha/franja) y "Cancelar"
  (confirmación nativa antes de llamar al endpoint).

## Testing

- Backend: se extiende `AppServices`/el fake en memoria con `CitasService`. Test
  explícito de doble reserva: dos llamadas a `create` con el mismo `medicoId`+`fechaHora`
  — la segunda debe fallar con el mensaje de conflicto (esto prueba la lógica de la
  aplicación, no la concurrencia real de Postgres, como se aclaró arriba). Tests para
  disponibilidad de franjas, reprogramar (libera la franja vieja, ocupa la nueva) y
  cancelar (libera la franja).
- Frontend: mock de `fetch` como en las épicas anteriores, cubriendo reservar, ver "no
  disponible" cuando el backend rechaza, reprogramar y cancelar.

## Fuera de alcance

- Notificaciones reales por correo (Épica 4 — HU-10/11/12).
- Reportes de citas (Épica 5).
- Que el cambio de un `horario` (Épica 2) actualice automáticamente las citas ya
  agendadas — ya estaba anotado como fuera de alcance desde el diseño de Épica 2.
