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

drop policy if exists "admins leen notificaciones" on public.notificaciones;
create policy "admins leen notificaciones"
  on public.notificaciones for select
  to authenticated
  using (
    exists (select 1 from public.perfiles where id = auth.uid() and rol = 'ADMIN')
  );

notify pgrst, 'reload schema';