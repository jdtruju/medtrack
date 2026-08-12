create table if not exists public.horarios (
  id uuid primary key default gen_random_uuid(),
  medico_id uuid not null references public.medicos (id) on delete cascade,
  dia_semana text not null check (dia_semana in ('LUN','MAR','MIE','JUE','VIE','SAB','DOM')),
  hora_inicio time not null,
  hora_fin time not null,
  created_at timestamptz not null default now(),
  constraint horario_rango_valido check (hora_fin > hora_inicio)
);

alter table public.horarios enable row level security;

create policy "autenticados leen horarios"
  on public.horarios for select
  to authenticated
  using (true);

create policy "admins crean horarios"
  on public.horarios for insert
  to authenticated
  with check (
    exists (select 1 from public.perfiles where id = auth.uid() and rol = 'ADMIN')
  );

create policy "admins editan horarios"
  on public.horarios for update
  to authenticated
  using (
    exists (select 1 from public.perfiles where id = auth.uid() and rol = 'ADMIN')
  );

create policy "admins eliminan horarios"
  on public.horarios for delete
  to authenticated
  using (
    exists (select 1 from public.perfiles where id = auth.uid() and rol = 'ADMIN')
  );

drop policy if exists "admins leen especialidades" on public.especialidades;
create policy "autenticados leen especialidades"
  on public.especialidades for select
  to authenticated
  using (true);

drop policy if exists "admins leen medicos" on public.medicos;
create policy "autenticados leen medicos"
  on public.medicos for select
  to authenticated
  using (true);

alter publication supabase_realtime add table public.horarios;
