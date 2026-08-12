do $$
begin
  if not exists (select 1 from pg_type where typname = 'dia_semana') then
    create type public.dia_semana as enum ('LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM');
  end if;
end $$;

create table if not exists public.horarios (
  id uuid primary key default gen_random_uuid(),
  medico_id uuid not null references public.medicos(id) on delete cascade,
  dia_semana public.dia_semana not null,
  hora_inicio time not null,
  hora_fin time not null,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint horarios_hora_valida check (hora_fin > hora_inicio)
);

alter table public.horarios enable row level security;

drop policy if exists "horarios_select_authenticated" on public.horarios;
create policy "horarios_select_authenticated"
on public.horarios
for select
to authenticated
using (true);

drop policy if exists "horarios_admin_all" on public.horarios;
create policy "horarios_admin_all"
on public.horarios
for all
to authenticated
using (
  exists (
    select 1
    from public.perfiles
    where perfiles.id = auth.uid()
      and perfiles.rol = 'ADMIN'
  )
)
with check (
  exists (
    select 1
    from public.perfiles
    where perfiles.id = auth.uid()
      and perfiles.rol = 'ADMIN'
  )
);

alter publication supabase_realtime add table public.horarios;
