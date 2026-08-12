# Supabase

MedTrack usa Supabase para PostgreSQL y autenticacion. Las migraciones estan en `supabase/migrations/` y se aplican manualmente desde el dashboard.

## Aplicar migraciones

En Supabase:

1. Abre tu proyecto.
2. Entra a `SQL Editor`.
3. Crea una consulta nueva.
4. Copia y ejecuta cada archivo en este orden:

```text
supabase/migrations/0001_perfiles.sql
supabase/migrations/0002_especialidades.sql
supabase/migrations/0003_medicos.sql
supabase/migrations/0004_login_attempts.sql
supabase/migrations/0005_horarios_y_visibilidad.sql
```

## Variables necesarias

Backend, en `apps/backend/.env`:

```env
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
FRONTEND_URL=http://localhost:5173
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Frontend, en `apps/frontend/.env`:

```env
VITE_API_URL=http://localhost:4000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key
```

`SUPABASE_SERVICE_ROLE_KEY` solo va en el backend. Nunca debe ir en el frontend.

## Crear el primer administrador

1. Levanta backend y frontend.
2. Registrate desde `/register` con tu correo.
3. En Supabase SQL Editor ejecuta:

```sql
update perfiles
set rol = 'ADMIN'
where email = 'tu-correo@ejemplo.com';
```

4. Cierra sesion y vuelve a iniciar sesion.

Con ese usuario podras entrar a las pantallas de administracion.
