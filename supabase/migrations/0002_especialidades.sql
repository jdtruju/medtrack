create table if not exists public.especialidades (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text
);

alter table public.especialidades enable row level security;

create policy "admins leen especialidades"
  on public.especialidades for select
  to authenticated
  using (
    exists (select 1 from public.perfiles where id = auth.uid() and rol = 'ADMIN')
  );

insert into public.especialidades (nombre, descripcion) values
  ('Cardiología', 'Diagnóstico y tratamiento de enfermedades del corazón'),
  ('Pediatría', 'Atención médica de niños y adolescentes'),
  ('Dermatología', 'Diagnóstico y tratamiento de enfermedades de la piel')
on conflict (nombre) do nothing;