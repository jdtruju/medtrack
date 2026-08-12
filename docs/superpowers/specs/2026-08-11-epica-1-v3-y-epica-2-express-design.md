# Épica 1 (v3, con Express) + Épica 2 — Diseño

**Fecha:** 2026-08-11
**Reemplaza:** `2026-08-11-epica-1-gestion-usuarios-supabase-design.md` (frontend hablando
directo con Supabase, sin backend real).
**Alcance:** Rehacer HU-01..HU-04 pasando por un backend Express real, y agregar
HU-05/HU-06 (Épica 2) sobre esa misma base.

## Contexto y motivo del cambio

El Acta Constitutiva lista `Node.js + Express` junto a `Supabase` y `PostgreSQL` como
stack. La versión anterior de este diseño hacía que el frontend llamara directo a
Supabase Auth y a las tablas vía `@supabase/supabase-js`, dejando Express con solo
`/health`. El usuario decidió que quiere que Express sea un intermediario real: el
frontend habla con Express, y **solo Express** tiene las credenciales de Supabase (la
`service_role key`, secreta). La única excepción es la suscripción Realtime de HU-06
(ver más abajo), porque Realtime es una conexión navegador→Supabase por diseño de la
plataforma.

## Arquitectura backend

```
apps/backend/src/
├── lib/
│   └── supabaseAdmin.ts       # cliente server-side con SUPABASE_SERVICE_ROLE_KEY
├── middlewares/
│   └── auth.ts                # requireAuth, requireRole('ADMIN')
├── modules/
│   ├── auth/                  # register, login, forgot-password, reset-password
│   ├── medicos/                # listar, registrar médico
│   ├── especialidades/         # listar (solo lectura)
│   └── horarios/               # crear/editar/eliminar/listar (Épica 2)
```

- `requireAuth`: lee `Authorization: Bearer <token>`, llama
  `supabaseAdmin.auth.getUser(token)` para validar el JWT que Supabase emitió en el
  login, y adjunta `{ id, email }` a `req.user`.
- `requireRole('ADMIN')`: después de `requireAuth`, consulta `perfiles` por `req.user.id`
  y verifica `rol === 'ADMIN'`.
- Variables de entorno nuevas en `apps/backend/.env`: `SUPABASE_URL`,
  `SUPABASE_SERVICE_ROLE_KEY` (secreta, nunca en el frontend), `FRONTEND_URL` (para el
  `redirectTo` del correo de recuperación).
- Las funciones RPC `check_login_lock` / `record_login_attempt` (ya creadas en
  `supabase/migrations/0004_login_attempts.sql`) no cambian — antes las llamaba el
  frontend directo, ahora las llama Express con `supabaseAdmin.rpc(...)`.

## Endpoints y contratos (mensajes idénticos a los ya definidos en el Product Backlog)

Prefijo `/api`. Todas las respuestas de error usan `{ error: '<mensaje>' }`, las de
éxito `{ message: '<mensaje>', ...datos }`.

| Método y ruta | Auth | Detalle |
|---|---|---|
| `POST /auth/register` | pública | Valida con Zod, llama `supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: {...} })`. El trigger `handle_new_user` ya existente crea la fila en `perfiles`. Duplicado → 409. Campo obligatorio faltante → 400. Éxito → 201. |
| `POST /auth/login` | pública | Revisa `check_login_lock` (RPC) antes de intentar. Llama `signInWithPassword`. Falla → `record_login_attempt(false)` y 401/403 según corresponda. Éxito → `record_login_attempt(true)`, 200 con `{ token, usuario }` (`token` = `session.access_token` que emitió Supabase). |
| `POST /auth/forgot-password` | pública | Llama `resetPasswordForEmail(email, { redirectTo: `${FRONTEND_URL}/reset-password` })`. Responde igual exista o no el correo. |
| `POST /auth/reset-password` | pública | Recibe `{ accessToken, password }` (el `accessToken` lo extrae el frontend del fragmento de la URL del correo). Crea un cliente Supabase temporal autenticado con ese token y llama `updateUser({ password })`. Token inválido/expirado → 400. |
| `GET /especialidades` | requireAuth | Lista `{ id, nombre }[]`. |
| `GET /medicos` | requireAuth | Lista médicos. |
| `POST /medicos` | requireAuth + ADMIN | Crea médico + especialidad. Licencia duplicada → 409. |
| `GET /horarios?medicoId=&especialidadId=` | requireAuth | Ambos filtros opcionales; `especialidadId` filtra vía join con `medicos`. |
| `POST /horarios` | requireAuth + ADMIN | `{ medicoId, diaSemana, horaInicio, horaFin }`. `horaFin <= horaInicio` → 400. |
| `PUT /horarios/:id` | requireAuth + ADMIN | Mismo body que POST, actualiza por id. |
| `DELETE /horarios/:id` | requireAuth + ADMIN | Elimina por id. |

Cualquier ruta protegida sin rol suficiente → 403 con
`{ error: 'No tienes permisos para acceder a esta sección.' }` (mismo texto que ya
aparece en el Product Backlog para HU-20).

## Esquema — migración nueva para Épica 2

`supabase/migrations/0005_horarios_y_visibilidad.sql`:
- Tabla `horarios` (`medico_id`, `dia_semana` `LUN..DOM`, `hora_inicio`/`hora_fin` tipo
  `time`, `check (hora_fin > hora_inicio)`). Eliminar es un `DELETE` real — no hay
  criterio de "reactivar", así que no se agrega columna `activo`.
- Amplía las políticas de `SELECT` de `especialidades` y `medicos` a cualquier
  `authenticated` (antes eran solo-ADMIN, lo cual bloqueaba a Express mismo cuando
  actúa en nombre de un paciente consultando disponibilidad). Como ahora Express usa
  la `service_role key` para las consultas de negocio, esto es más una cuestión de
  higiene que un bloqueante real, pero se corrige igual.
- `alter publication supabase_realtime add table public.horarios;` para habilitar la
  suscripción de HU-06.

## Frontend

- Se reintroduce `apps/frontend/src/lib/api.ts` (`apiRequest`, `saveSession`,
  `getSession`, `clearSession`, `SessionUser`) — mismo patrón que el código original de
  Jenner, hablando con Express en vez de con Supabase.
- `AuthContext` se mantiene como interfaz (`useAuth()`, `ProtectedRoute` y `AppShell` no
  cambian su forma de consumirlo), pero por dentro deja de usar `supabase.auth.*` y usa
  `apiRequest` + `localStorage` vía `lib/api.ts`. La carga de sesión al montar deja de
  ser una llamada async a Supabase — se lee de `localStorage` directamente, como en el
  diseño original de Jenner.
- `RegisterPage`, `ForgotPasswordPage`, `ResetPasswordPage`, `DoctorsPage` vuelven a
  llamar `apiRequest(...)` en vez de `supabase.*`.
- `ResetPasswordPage` ahora lee `window.location.hash` para extraer el
  `access_token` que Supabase puso ahí, y se lo manda a Express en el body del POST
  (nunca se instancia `supabase-js` con la key pública solo para esto).
- **Excepción explícita:** `AvailabilityPage` (HU-06, nueva) sí importa
  `@supabase/supabase-js` con la key pública, únicamente para suscribirse a
  `postgres_changes` sobre `horarios` y disparar un refetch a Express cuando cambia algo.
  Ninguna otra pantalla usa el cliente de Supabase.
- `SchedulesPage` (admin, nueva, HU-05): selector de médico, lista de horarios, alta,
  edición (carga la fila al formulario y hace `PUT`), baja con confirmación.
- Limpieza incluida: los arrays `adminNav`/`patientNav`, duplicados en cada página, se
  extraen a `src/lib/nav.ts` compartido (se estaban por duplicar una quinta vez al
  agregar las páginas nuevas).

## Fuera de alcance

- "Solo horarios libres" (HU-06) hoy muestra todos los horarios creados — el concepto de
  horario ocupado por una cita no existe hasta la Épica 3 (HU-07). Se deja anotado para
  no repetirlo cuando lleguen las citas.
- Migrar el registro/login a un flujo de confirmación de correo real (se usa
  `email_confirm: true` para que el registro quede activo de inmediato, sin paso de
  verificación — no hay HU que pida confirmación de correo).

## Testing

- **Backend:** se repite el patrón de "cliente inyectable + fake en memoria" del primer
  diseño (antes era un `Db` de Prisma; ahora es una interfaz `SupabaseLike` con los
  métodos de Auth/RPC/`from(...)` que el código usa). `createApp(supabaseLike)` para
  producción usa `supabaseAdmin`; los tests usan un fake. Sigue sin haber conexión a la
  base real desde esta sesión — el fake sustituye eso, igual que antes.
- **Frontend:** vuelve a mockear `fetch` global (como en el `App.test.tsx` original de
  Jenner) para las pantallas que hablan con Express. `AvailabilityPage` además mockea
  `@supabase/supabase-js` para simular el evento de Realtime.