# Migraciones de Supabase

Este proyecto no usa un ORM. El esquema vive en estos archivos `.sql`, pero **no se
aplican automáticamente** — hay que pegarlos a mano, en orden, en el SQL Editor del
dashboard de Supabase (Proyecto → SQL Editor → New query):

1. `migrations/0001_perfiles.sql`
2. `migrations/0002_especialidades.sql`
3. `migrations/0003_medicos.sql`
4. `migrations/0004_login_attempts.sql`

Después de correrlos, para tener un usuario ADMIN de prueba:

1. Registrate una vez como paciente normal desde `/register` en el frontend.
2. En el SQL Editor de Supabase, corré:
   ```sql
   update perfiles set rol = 'ADMIN' where email = 'tu-correo@ejemplo.com';
   ```
3. Cerrá sesión y volvé a iniciar sesión para que el rol ADMIN tome efecto.