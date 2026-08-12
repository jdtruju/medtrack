create table if not exists public.medicos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  apellido text not null,
  email text not null unique,
  telefono text,
  licencia text not null unique,
  especialidad_id uuid not null references public.especialidades (id),
  created_at timestamptz not null default now()
);

alter table public.medicos enable row level security;

create policy "admins leen medicos"
  on public.medicos for select
  to authenticated
  using (
    exists (select 1 from public.perfiles where id = auth.uid() and rol = 'ADMIN')
  );

create policy "admins registran medicos"
  on public.medicos for insert
  to authenticated
  with check (
    exists (select 1 from public.perfiles where id = auth.uid() and rol = 'ADMIN')
  );