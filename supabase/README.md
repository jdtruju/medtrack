# Migraciones de Supabase

Este proyecto no usa un ORM. El esquema vive en estos archivos `.sql`, pero **no se
aplican automáticamente** — hay que pegarlos a mano, en orden, en el SQL Editor del
dashboard de Supabase (Proyecto → SQL Editor → New query):

1. `migrations/0001_perfiles.sql`
2. `migrations/0002_especialidades.sql`
3. `migrations/0003_medicos.sql`
4. `migrations/0004_login_attempts.sql`
5. `migrations/0005_horarios_y_visibilidad.sql`
6. `migrations/0006_citas.sql`
7. `migrations/0007_notificaciones.sql`
8. `migrations/0008_especialidades_crud.sql`
9. `migrations/0009_especialidades_descripcion.sql`
10. `migrations/0010_alinear_citas_produccion.sql` — **solo si tu tabla `citas` ya existía
    con el esquema antiguo** (columnas `paciente_email`/`horario_id`/`fecha`/`hora_inicio`
    en vez de `fecha_hora`/`especialidad_id`). Alinea la tabla real con el código sin
    perder las citas existentes. Si tu tabla `citas` se creó directamente con
    `0006_citas.sql`, no hace falta correr esta.

Después de correrlos, para tener un usuario ADMIN de prueba:

1. Registrate una vez como paciente normal desde `/register` en el frontend.
2. En el SQL Editor de Supabase, corré:
   ```sql
   update perfiles set rol = 'ADMIN' where email = 'tu-correo@ejemplo.com';
   ```
3. Cerrá sesión y volvé a iniciar sesión para que el rol ADMIN tome efecto.
