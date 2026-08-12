# Épica 1 — Gestión de Usuarios — Diseño (Supabase)

> **SUPERADO:** este diseño hacía que el frontend hablara directo con Supabase
> (Auth + tablas) sin backend real. El usuario decidió después que quiere un backend
> Express real como intermediario (el Acta lista Express explícitamente). Ver
> `2026-08-11-epica-1-v3-y-epica-2-express-design.md` para el diseño vigente. Se
> conserva este documento solo como historial.

**Fecha:** 2026-08-11
**Alcance:** HU-01 (Registro de Pacientes), HU-02 (Inicio de Sesión), HU-03 (Recuperar
Contraseña), HU-04 (Registrar Médico). Reemplaza el diseño anterior
(`2026-08-11-epica-1-gestion-usuarios-design.md`), que asumía Express + Prisma + JWT/bcrypt
propios.

## Contexto

El Acta Constitutiva real del proyecto (`Acta constitutiva (1).pdf`, versión con
contenido — no la plantilla vacía revisada antes) lista en su sección 9 "Arquitectura y
Estándares": React + TypeScript, Node.js + Express, PostgreSQL, Supabase, Vercel, GitHub.
El usuario confirmó que quiere Supabase Auth + el cliente `@supabase/supabase-js` para
manejar **toda** la Épica 1 (autenticación y datos de esta épica), dejando Express
reducido a `/health`, y **sin Prisma**.

## Decisiones confirmadas con el usuario

| Decisión | Elegido |
|---|---|
| Reparto Supabase/Express | Supabase para todo (auth + datos de esta épica); Express solo `/health` |
| ORM | Ninguno — SQL puro, aplicado a mano por el usuario en el SQL Editor del dashboard de Supabase |
| Recuperación de contraseña | Correo real vía Supabase Auth (ya no hace falta mock) |
| Bloqueo de cuenta (HU-02) | Función RPC de Postgres (no hay bloqueo nativo en Supabase Auth) |

## Limitación importante

Esta sesión no tiene el connection string de Postgres ni el `service_role key` del
proyecto Supabase (y no se van a pedir, para no manejar esas credenciales en este
entorno). Por lo tanto:
- Entrego los cambios de esquema como archivos `.sql` versionados en el repo
  (`supabase/migrations/`).
- **El usuario debe pegarlos y ejecutarlos manualmente** en el SQL Editor de su proyecto
  Supabase (Dashboard → SQL Editor), en orden.
- No puedo verificar por mi cuenta que el SQL corra sin errores contra la base real —
  el usuario tiene que confirmarlo después de ejecutarlo.

## Frontend

- Nueva dependencia: `@supabase/supabase-js`.
- `apps/frontend/.env` (nuevo, gitignored) con `VITE_SUPABASE_URL` y
  `VITE_SUPABASE_PUBLISHABLE_KEY`; se agrega `apps/frontend/.env.example` con esas mismas
  claves (vacías) para documentar qué se necesita.
- `src/lib/supabaseClient.ts` — crea y exporta el cliente único de Supabase.
- `src/context/AuthContext.tsx` — usa `supabase.auth.getSession()` y
  `supabase.auth.onAuthStateChange()` para el estado de sesión; al autenticar, consulta la
  tabla `perfiles` para obtener `rol`, `nombre`, `apellido`.
- `ProtectedRoute` — igual que en el diseño anterior (redirige según sesión/rol), pero
  ahora lee del `AuthContext` basado en Supabase.
- Páginas: `RegisterPage`, `LoginPage`, `ForgotPasswordPage`, `ResetPasswordPage` (nueva,
  ruta `/reset-password`, procesa el token que Supabase pone en la URL tras el enlace de
  recuperación), `DoctorsPage` (admin: lista + alta de médicos).

## Backend

- Se elimina `apps/backend/prisma/` por completo.
- Se quitan de `apps/backend/package.json`: `@prisma/client`, `prisma`, `bcrypt`,
  `jsonwebtoken`, `@types/bcrypt`, `@types/jsonwebtoken`, y el script `prisma:generate`
  (ya no aplican — Supabase maneja hashing y tokens).
- Queda solo `express`, `cors`, `dotenv`, `tsx`, `typescript`, `vitest`, `supertest` y el
  endpoint `/health` existente, sin cambios.

## Esquema (SQL puro, en `supabase/migrations/`)

- **`0001_perfiles.sql`** — tabla `perfiles` (id = mismo id que `auth.users`, nombre,
  apellido, telefono, rol `PACIENTE`/`ADMIN`, creado automáticamente vía trigger
  `handle_new_user()` en `auth.users`), RLS: cada usuario ve/edita su propio perfil.
- **`0002_especialidades.sql`** — tabla `especialidades` (id, nombre único, descripcion) +
  3 filas semilla (Cardiología, Pediatría, Dermatología). RLS: lectura solo ADMIN.
- **`0003_medicos.sql`** — tabla `medicos` (id, nombre, apellido, email, telefono,
  licencia único, especialidad_id). RLS: INSERT y SELECT solo ADMIN (vía subconsulta a
  `perfiles`).
- **`0004_login_attempts.sql`** — tabla `login_attempts` (email, intentos, bloqueado_hasta)
  no accesible directamente (RLS deniega todo); dos funciones `SECURITY DEFINER` con
  `EXECUTE` otorgado a `anon`/`authenticated`:
  - `check_login_lock(p_email text)` → `{ bloqueado, bloqueado_hasta, intentos }`.
  - `record_login_attempt(p_email text, p_exitoso boolean)` → incrementa/resetea/bloquea
    (5 intentos → bloqueo de 15 min).

## Flujo de login con bloqueo (HU-02, sin Express)

1. Frontend llama `check_login_lock(email)`. Si `bloqueado = true` y no expiró, muestra
   `"Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos."` y no sigue.
2. Si no está bloqueado, llama `supabase.auth.signInWithPassword({ email, password })`.
3. Si falla, llama `record_login_attempt(email, false)` y muestra
   `"Correo o contraseña incorrectos. Intento N de 5."` con el `intentos` devuelto.
4. Si tiene éxito, llama `record_login_attempt(email, true)` (resetea contador) y navega
   según el rol.

## Bootstrap de administrador

Sin Express ya no hay script de seed. El primer admin se crea así: el usuario se
registra una vez como paciente normal desde la UI, y luego corre manualmente en el SQL
Editor de Supabase:

```sql
update perfiles set rol = 'ADMIN' where email = 'correo-del-admin@ejemplo.com';
```

Esto queda documentado en `CLAUDE.md` como paso manual de setup, no como parte del flujo
de la aplicación.

## Mensajes y reglas de negocio

Se mantienen los mensajes exactos del Product Backlog donde aplica (confirmación de
registro, correo duplicado, campo obligatorio, credenciales incorrectas con contador,
bloqueo, enlace expirado, contraseña actualizada, médico duplicado) — la fuente de cada
mensaje cambia (ahora viene de la respuesta de Supabase o de nuestras funciones RPC en
vez de un endpoint Express), pero el texto visible para el usuario no cambia.

## Testing

Sin endpoints propios que probar con supertest. Los tests de frontend usan
`vi.mock('@supabase/supabase-js')` para simular las respuestas de
`signUp`/`signInWithPassword`/`resetPasswordForEmail`/`updateUser`/`from().insert()`/
`rpc()`, cubriendo con React Testing Library al menos un test por criterio de aceptación
de cada historia (12 en total), igual que en el diseño anterior pero sin backend real de
por medio.

Las funciones SQL (`check_login_lock`, `record_login_attempt`) y las políticas RLS **no
se pueden probar automáticamente desde esta sesión** — no hay conexión a la base real. El
usuario debe verificarlas manualmente después de ejecutar las migraciones (por ejemplo,
probando el flujo de login 5 veces fallidas desde la UI).

## Fuera de alcance de esta fase

- CRUD completo de especialidades (Épica 2).
- Cualquier lógica en Express más allá de `/health`.
- Verificación automatizada de las políticas RLS y funciones RPC contra la base real.
- Horarios, citas, notificaciones, reportes (épicas 2–5 restantes).