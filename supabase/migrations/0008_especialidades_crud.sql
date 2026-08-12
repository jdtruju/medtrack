drop policy if exists "admins crean especialidades" on public.especialidades;
create policy "admins crean especialidades"
  on public.especialidades for insert
  to authenticated
  with check (
    exists (select 1 from public.perfiles where id = auth.uid() and rol = 'ADMIN')
  );

drop policy if exists "admins editan especialidades" on public.especialidades;
create policy "admins editan especialidades"
  on public.especialidades for update
  to authenticated
  using (
    exists (select 1 from public.perfiles where id = auth.uid() and rol = 'ADMIN')
  );

drop policy if exists "admins eliminan especialidades" on public.especialidades;
create policy "admins eliminan especialidades"
  on public.especialidades for delete
  to authenticated
  using (
    exists (select 1 from public.perfiles where id = auth.uid() and rol = 'ADMIN')
  );
