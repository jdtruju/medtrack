create table if not exists public.medicos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  apellido text not null,
  email text not null unique,
  telefono text,
  licencia text not null unique,
  especialidad_id uuid not null references public.especialidades(id),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table public.medicos enable row level security;

drop policy if exists "medicos_select_authenticated" on public.medicos;
create policy "medicos_select_authenticated"
on public.medicos
for select
to authenticated
using (true);

drop policy if exists "medicos_admin_all" on public.medicos;
create policy "medicos_admin_all"
on public.medicos
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
