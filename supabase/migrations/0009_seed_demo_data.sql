alter table public.horarios
  alter column dia_semana type text using dia_semana::text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'horarios_dia_semana_check'
      and conrelid = 'public.horarios'::regclass
  ) then
    alter table public.horarios
      add constraint horarios_dia_semana_check check (dia_semana in ('LUN','MAR','MIE','JUE','VIE','SAB','DOM'));
  end if;
end $$;

insert into public.especialidades (nombre, descripcion) values
  ('Cardiologia', 'Diagnostico y tratamiento de enfermedades cardiovasculares.'),
  ('Pediatria', 'Atencion medica para ninos, ninas y adolescentes.'),
  ('Dermatologia', 'Diagnostico y tratamiento de enfermedades de la piel.'),
  ('Medicina General', 'Atencion primaria, control preventivo y seguimiento integral.'),
  ('Ginecologia', 'Salud reproductiva y atencion ginecologica.'),
  ('Neurologia', 'Diagnostico y control de trastornos del sistema nervioso.'),
  ('Ortopedia', 'Atencion de lesiones oseas, musculares y articulares.'),
  ('Oftalmologia', 'Evaluacion, diagnostico y tratamiento visual.'),
  ('Psiquiatria', 'Atencion de salud mental y tratamiento farmacologico.'),
  ('Nutricion', 'Evaluacion nutricional y planes alimentarios clinicos.')
on conflict (nombre) do update
set descripcion = excluded.descripcion;

insert into public.medicos (nombre, apellido, email, telefono, licencia, especialidad_id)
select data.nombre, data.apellido, data.email, data.telefono, data.licencia, e.id
from (
  values
    ('Valeria', 'Solano', 'valeria.solano@medtrack.test', '8888-1001', 'MED-CR-1001', 'Cardiologia'),
    ('Andres', 'Mora', 'andres.mora@medtrack.test', '8888-1002', 'MED-CR-1002', 'Pediatria'),
    ('Camila', 'Rojas', 'camila.rojas@medtrack.test', '8888-1003', 'MED-CR-1003', 'Dermatologia'),
    ('Daniel', 'Quesada', 'daniel.quesada@medtrack.test', '8888-1004', 'MED-CR-1004', 'Medicina General'),
    ('Mariana', 'Vargas', 'mariana.vargas@medtrack.test', '8888-1005', 'MED-CR-1005', 'Ginecologia'),
    ('Esteban', 'Castro', 'esteban.castro@medtrack.test', '8888-1006', 'MED-CR-1006', 'Neurologia'),
    ('Laura', 'Jimenez', 'laura.jimenez@medtrack.test', '8888-1007', 'MED-CR-1007', 'Ortopedia'),
    ('Sofia', 'Araya', 'sofia.araya@medtrack.test', '8888-1008', 'MED-CR-1008', 'Oftalmologia'),
    ('Ricardo', 'Campos', 'ricardo.campos@medtrack.test', '8888-1009', 'MED-CR-1009', 'Psiquiatria'),
    ('Natalia', 'Brenes', 'natalia.brenes@medtrack.test', '8888-1010', 'MED-CR-1010', 'Nutricion'),
    ('Felipe', 'Alpizar', 'felipe.alpizar@medtrack.test', '8888-1011', 'MED-CR-1011', 'Medicina General'),
    ('Paola', 'Navarro', 'paola.navarro@medtrack.test', '8888-1012', 'MED-CR-1012', 'Cardiologia')
) as data(nombre, apellido, email, telefono, licencia, especialidad)
join public.especialidades e on e.nombre = data.especialidad
on conflict (licencia) do update
set
  nombre = excluded.nombre,
  apellido = excluded.apellido,
  email = excluded.email,
  telefono = excluded.telefono,
  especialidad_id = excluded.especialidad_id;

with horario_seed as (
  select m.id as medico_id, data.dia_semana, data.hora_inicio::time, data.hora_fin::time
  from (
    values
      ('MED-CR-1001', 'LUN', '08:00', '12:00'),
      ('MED-CR-1001', 'MIE', '13:00', '17:00'),
      ('MED-CR-1002', 'MAR', '08:00', '12:00'),
      ('MED-CR-1002', 'JUE', '13:00', '17:00'),
      ('MED-CR-1003', 'LUN', '09:00', '13:00'),
      ('MED-CR-1003', 'VIE', '08:00', '12:00'),
      ('MED-CR-1004', 'LUN', '07:00', '11:00'),
      ('MED-CR-1004', 'MAR', '14:00', '18:00'),
      ('MED-CR-1005', 'MIE', '08:00', '12:00'),
      ('MED-CR-1005', 'VIE', '13:00', '17:00'),
      ('MED-CR-1006', 'JUE', '08:00', '12:00'),
      ('MED-CR-1006', 'SAB', '08:00', '11:00'),
      ('MED-CR-1007', 'MAR', '09:00', '13:00'),
      ('MED-CR-1007', 'JUE', '14:00', '18:00'),
      ('MED-CR-1008', 'LUN', '13:00', '17:00'),
      ('MED-CR-1008', 'MIE', '08:00', '12:00'),
      ('MED-CR-1009', 'VIE', '09:00', '13:00'),
      ('MED-CR-1010', 'MAR', '08:00', '12:00'),
      ('MED-CR-1011', 'JUE', '07:00', '11:00'),
      ('MED-CR-1012', 'VIE', '13:00', '17:00')
  ) as data(licencia, dia_semana, hora_inicio, hora_fin)
  join public.medicos m on m.licencia = data.licencia
)
insert into public.horarios (medico_id, dia_semana, hora_inicio, hora_fin)
select medico_id, dia_semana, hora_inicio, hora_fin
from horario_seed seed
where not exists (
  select 1
  from public.horarios h
  where h.medico_id = seed.medico_id
    and h.dia_semana::text = seed.dia_semana::text
    and h.hora_inicio = seed.hora_inicio
    and h.hora_fin = seed.hora_fin
);

with paciente_demo as (
  select p.id, u.email
  from public.perfiles p
  join auth.users u on u.id = p.id
  where p.rol = 'PACIENTE'
  order by u.created_at
  limit 1
),
citas_seed as (
  select
    pd.id as paciente_id,
    pd.email as paciente_email,
    m.id as medico_id,
    h.id as horario_id,
    data.fecha,
    h.hora_inicio,
    data.estado,
    data.motivo_cancelacion,
    data.recordatorio_enviado
  from (
    values
      ('MED-CR-1001', current_date + 1, 'RESERVADA', null, false),
      ('MED-CR-1004', current_date + 3, 'RESERVADA', null, false),
      ('MED-CR-1006', current_date + 7, 'RESERVADA', null, false),
      ('MED-CR-1002', current_date - 2, 'CANCELADA', 'Paciente solicito reprogramar por conflicto de horario.', false)
  ) as data(licencia, fecha, estado, motivo_cancelacion, recordatorio_enviado)
  cross join paciente_demo pd
  join public.medicos m on m.licencia = data.licencia
  join public.horarios h on h.medico_id = m.id
  where h.id = (
    select h2.id from public.horarios h2 where h2.medico_id = m.id order by h2.dia_semana, h2.hora_inicio limit 1
  )
),
inserted_citas as (
  insert into public.citas (
    paciente_id,
    paciente_email,
    medico_id,
    horario_id,
    fecha,
    hora_inicio,
    estado,
    motivo_cancelacion,
    recordatorio_enviado
  )
  select
    paciente_id,
    paciente_email,
    medico_id,
    horario_id,
    fecha,
    hora_inicio,
    estado,
    motivo_cancelacion,
    recordatorio_enviado
  from citas_seed seed
  where not exists (
    select 1
    from public.citas c
    where c.paciente_id = seed.paciente_id
      and c.medico_id = seed.medico_id
      and c.fecha = seed.fecha
      and c.hora_inicio = seed.hora_inicio
  )
  returning id, paciente_id, paciente_email, fecha, hora_inicio, estado, motivo_cancelacion
)
insert into public.notificaciones (usuario_id, email, tipo, cita_id, detalle)
select
  cita.paciente_id,
  cita.paciente_email,
  case when cita.estado = 'CANCELADA' then 'CANCELACION_CITA' else 'CONFIRMACION_RESERVA' end,
  cita.id,
  case
    when cita.estado = 'CANCELADA' then 'Cita cancelada. Motivo: ' || cita.motivo_cancelacion
    else 'Cita reservada para ' || cita.fecha || ' a las ' || to_char(cita.hora_inicio, 'HH24:MI') || '.'
  end
from inserted_citas cita
where not exists (
  select 1
  from public.notificaciones n
  where n.cita_id = cita.id
    and n.tipo = case when cita.estado = 'CANCELADA' then 'CANCELACION_CITA' else 'CONFIRMACION_RESERVA' end
);
