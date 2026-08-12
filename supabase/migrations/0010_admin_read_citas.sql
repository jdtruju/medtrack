drop policy if exists "admins leen citas" on public.citas;
create policy "admins leen citas"
  on public.citas for select
  to authenticated
  using (
    exists (select 1 from public.perfiles where id = auth.uid() and rol = 'ADMIN')
  );

notify pgrst, 'reload schema';
