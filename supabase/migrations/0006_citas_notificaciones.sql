create table if not exists public.citas (
  id uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references public.perfiles (id) on delete cascade,
  paciente_email text not null,
  medico_id uuid not null references public.medicos (id) on delete restrict,
  horario_id uuid not null references public.horarios (id) on delete restrict,
  fecha date not null,
  hora_inicio time not null,
  fecha_hora_inicio timestamp generated always as ((fecha::timestamp + hora_inicio)) stored,
  estado text not null default 'RESERVADA' check (estado in ('RESERVADA', 'CANCELADA')),
  motivo_cancelacion text,
  recordatorio_enviado boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists citas_medico_fecha_hora_reservada_idx
  on public.citas (medico_id, fecha, hora_inicio)
  where estado = 'RESERVADA';

create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  email text not null,
  tipo text not null check (tipo in ('CONFIRMACION_RESERVA', 'RECORDATORIO_24H', 'CANCELACION_CITA')),
  cita_id uuid not null references public.citas (id) on delete cascade,
  detalle text,
  enviado_en timestamptz not null default now()
);

alter table public.citas enable row level security;
alter table public.notificaciones enable row level security;

create policy "pacientes leen sus citas"
  on public.citas for select
  to authenticated
  using (paciente_id = auth.uid());

create policy "pacientes crean sus citas"
  on public.citas for insert
  to authenticated
  with check (paciente_id = auth.uid());

create policy "pacientes cancelan sus citas"
  on public.citas for update
  to authenticated
  using (paciente_id = auth.uid());

create policy "admins leen notificaciones"
  on public.notificaciones for select
  to authenticated
  using (
    exists (select 1 from public.perfiles where id = auth.uid() and rol = 'ADMIN')
  );

create policy "sistema registra notificaciones"
  on public.notificaciones for insert
  to authenticated
  with check (true);
