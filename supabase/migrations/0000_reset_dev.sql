-- Solo para desarrollo: borra las tablas, funciones y tipos de MedTrack
-- para poder volver a aplicar las migraciones desde cero.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.check_login_lock(text);
drop function if exists public.record_login_attempt(text, boolean);

drop table if exists public.horarios cascade;
drop table if exists public.login_attempts cascade;
drop table if exists public.medicos cascade;
drop table if exists public.especialidades cascade;
drop table if exists public.perfiles cascade;

drop type if exists public.dia_semana cascade;
drop type if exists public.rol_usuario cascade;
