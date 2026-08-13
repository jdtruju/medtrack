-- La tabla `citas` en esta base de datos se creo con el esquema del PR #7
-- (paciente_email, horario_id, fecha, hora_inicio, estado RESERVADA/CANCELADA),
-- que es incompatible con el codigo actual en main (fecha_hora combinado,
-- especialidad_id, estado CONFIRMADA/CANCELADA). Esta migracion alinea la tabla
-- real con el codigo, preservando las citas ya existentes.

-- 1. Agregar especialidad_id y completarla a partir del medico de cada cita.
alter table public.citas
  add column if not exists especialidad_id uuid references public.especialidades (id);

update public.citas c
set especialidad_id = m.especialidad_id
from public.medicos m
where c.medico_id = m.id and c.especialidad_id is null;

alter table public.citas
  alter column especialidad_id set not null;

-- 2. Agregar fecha_hora (fecha + hora combinadas, como espera el codigo) y
--    completarla a partir de fecha + hora_inicio.
alter table public.citas
  add column if not exists fecha_hora timestamptz;

update public.citas
set fecha_hora = (fecha::text || 'T' || to_char(hora_inicio, 'HH24:MI'))::timestamptz
where fecha_hora is null and fecha is not null and hora_inicio is not null;

alter table public.citas
  alter column fecha_hora set not null;

-- 3. Reconciliar estados: RESERVADA (esquema viejo) equivale a CONFIRMADA (esquema actual).
do $$
declare
  nombre_constraint text;
begin
  select conname into nombre_constraint
  from pg_constraint
  where conrelid = 'public.citas'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%estado%';
  if nombre_constraint is not null then
    execute format('alter table public.citas drop constraint %I', nombre_constraint);
  end if;
end $$;

update public.citas set estado = 'CONFIRMADA' where estado = 'RESERVADA';

alter table public.citas
  add constraint citas_estado_check check (estado in ('CONFIRMADA', 'CANCELADA'));

-- 4. Eliminar las columnas del esquema viejo que el codigo actual ya no usa
--    (los indices que dependen de ellas se eliminan solos). fecha_hora_inicio
--    se elimina primero porque es una columna generada a partir de fecha/hora_inicio.
alter table public.citas
  drop column if exists fecha_hora_inicio;

alter table public.citas
  drop column if exists paciente_email,
  drop column if exists horario_id,
  drop column if exists fecha,
  drop column if exists hora_inicio;

-- 5. Recrear el indice de proteccion contra doble reserva sobre fecha_hora
--    (el mismo mecanismo que ya documenta 0006_citas.sql).
create unique index if not exists citas_medico_fecha_activa
  on public.citas (medico_id, fecha_hora)
  where estado = 'CONFIRMADA';

create index if not exists citas_paciente_idx on public.citas (paciente_id);
create index if not exists citas_medico_fecha_idx on public.citas (medico_id, fecha_hora);

notify pgrst, 'reload schema';
