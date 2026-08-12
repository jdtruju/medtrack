alter table public.especialidades
  add column if not exists descripcion text;

notify pgrst, 'reload schema';
