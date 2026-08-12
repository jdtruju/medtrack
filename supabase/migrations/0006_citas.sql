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
