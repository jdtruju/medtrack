create table if not exists public.especialidades (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  activa boolean not null default true,
  creado_en timestamptz not null default now()
);

alter table public.especialidades enable row level security;

drop policy if exists "especialidades_select_public" on public.especialidades;
create policy "especialidades_select_public"
on public.especialidades
for select
using (true);

insert into public.especialidades (nombre)
values
  ('Cardiologia'),
  ('Pediatria'),
  ('Dermatologia')
on conflict (nombre) do nothing;
