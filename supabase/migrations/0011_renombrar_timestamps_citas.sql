-- La tabla `citas` de esta base traia created_at/updated_at (esquema del PR #7,
-- en ingles) en vez de creada_en/actualizada_en (lo que espera el codigo actual,
-- ver 0006_citas.sql). Renombrarlas en vez de agregar columnas nuevas evita
-- duplicar el timestamp de creacion/actualizacion de las citas existentes.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'citas' and column_name = 'created_at'
  ) then
    alter table public.citas rename column created_at to creada_en;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'citas' and column_name = 'updated_at'
  ) then
    alter table public.citas rename column updated_at to actualizada_en;
  end if;
end $$;

alter table public.citas
  alter column actualizada_en set default now();

notify pgrst, 'reload schema';
