# Épica 1 — Gestión de Usuarios — Diseño

> **SUPERADO:** este diseño asumía Express + Prisma + JWT/bcrypt propios. Tras confirmar
> con el Acta Constitutiva real (`Acta constitutiva (1).pdf`, no la plantilla vacía) que
> el stack incluye Supabase, y que el usuario quiere Supabase Auth + cliente JS para
> Épica 1 completa, este documento queda reemplazado por
> `2026-08-11-epica-1-gestion-usuarios-supabase-design.md`. Se conserva solo como
> historial de la decisión original.

**Fecha:** 2026-08-11
**Alcance:** HU-01 (Registro de Pacientes), HU-02 (Inicio de Sesión), HU-03 (Recuperar
Contraseña), HU-04 (Registrar Médico). Backend + frontend + pruebas por cada historia.

## Contexto

El andamiaje inicial de MedTrack ya existe (rama `trujillo`): monorepo npm workspaces,
Express + Prisma en `apps/backend`, Vite + React + Tailwind en `apps/frontend`, tipos
compartidos en `packages/shared`. El modelo `Usuario` en `prisma/schema.prisma` ya incluye
`intentosFallidos` y `bloqueadoHasta`, anticipando el bloqueo de cuenta de HU-02. No hay
Postgres disponible en este entorno de desarrollo todavía.

## Decisiones confirmadas con el usuario

| Decisión | Elegido | Razón |
|---|---|---|
| Desbloqueo de cuenta (HU-02) | Automático por tiempo (15 min tras 5 intentos fallidos) | Evita duplicar la infraestructura de tokens de HU-03; cumple el criterio de aceptación sin inventar alcance extra |
| Política de contraseña (HU-01) | Mínimo 8 caracteres | Suficiente para el alcance académico, menos fricción en pruebas de usabilidad |
| Registro con auto-login (HU-01) | No — solo confirma, login es aparte | Coincide literalmente con el criterio de aceptación de HU-01 y mantiene HU-01/HU-02 independientes |
| Bootstrap de admin (HU-04) | Script `prisma/seed.ts` | Permite probar HU-04 sin exponer un endpoint de creación de admin sin protección |
| Estrategia de tests | Fake de `Db` (Prisma) en memoria, sin Postgres real | El usuario no tiene Postgres disponible aún; las pruebas de integración reales contra Postgres son la Épica 6 / HU-17 |

## Arquitectura backend

Nuevos módulos en `apps/backend/src/modules/`, uno por dominio, cada uno con
`routes.ts`, `controller.ts`, `service.ts` y `schemas.ts` (Zod):

- `modules/auth/` — register, login, forgot-password, reset-password.
- `modules/medicos/` — crear médico, listar médicos.
- `modules/especialidades/` — listar especialidades (solo lectura, apoyo para el formulario de médico).

Infraestructura compartida:

- `src/lib/db.ts` — interfaz `Db` con el subconjunto de métodos de Prisma que el código
  usa (`usuario`, `medico`, `especialidad`, `medicoEspecialidad`, `passwordResetToken`).
  `createPrismaDb()` envuelve `PrismaClient` real y satisface la interfaz por tipado
  estructural. `createApp(db: Db)` recibe la conexión inyectada — `server.ts` le pasa
  `createPrismaDb()`, los tests le pasan un fake en memoria.
- `src/lib/password.ts` — `hashPassword`, `comparePassword` (bcrypt, 10 rounds).
- `src/lib/jwt.ts` — `signToken(payload)`, `verifyToken(token)`.
- `src/middlewares/auth.ts` — `requireAuth` (valida JWT, adjunta `req.user`),
  `requireRole(...roles)`.
- `src/services/emailService.ts` — `sendEmail({ to, subject, body })`: implementación
  simulada que hace `console.log` y retorna `{ to, subject, sentAt: Date }`. Documentado
  en `CLAUDE.md` como punto de reemplazo por un proveedor real (Nodemailer/SendGrid) más
  adelante — no hay HU que pida un proveedor real todavía.
- `src/constants/auth.ts` — `MAX_LOGIN_ATTEMPTS = 5`, `LOCK_DURATION_MINUTES = 15`,
  `RESET_TOKEN_EXPIRY_MINUTES = 30`. Constantes en código, no variables de entorno
  (YAGNI — nada en el backlog pide que sean configurables).

## Prisma — cambios al esquema

Se agrega un modelo nuevo (no se modifica ninguno existente):

```prisma
model PasswordResetToken {
  id         String    @id @default(uuid())
  usuarioId  String
  tokenHash  String
  expiresAt  DateTime
  usedAt     DateTime?
  createdAt  DateTime  @default(now())

  usuario Usuario @relation(fields: [usuarioId], references: [id])

  @@map("password_reset_tokens")
}
```

Y la relación inversa `passwordResetTokens PasswordResetToken[]` en `Usuario`.

`prisma/seed.ts` crea:
- 1 usuario `ADMIN` (`admin@medtrack.com`, password documentada en `CLAUDE.md`, hasheada).
- 3 especialidades: Cardiología, Pediatría, Dermatología (necesarias para poder probar
  HU-04 sin implementar toda la Épica 2 de gestión de especialidades).

## Endpoints

Prefijo `/api` para todo lo nuevo (el `/health` existente queda sin prefijo, es una
convención común para health checks de infraestructura).

| Método y ruta | HU | Auth | Descripción |
|---|---|---|---|
| `POST /api/auth/register` | HU-01 | pública | Registra un paciente |
| `POST /api/auth/login` | HU-02 | pública | Autentica, devuelve JWT |
| `POST /api/auth/forgot-password` | HU-03 | pública | Solicita recuperación (mock email) |
| `POST /api/auth/reset-password` | HU-03 | pública | Aplica nueva contraseña con el token |
| `GET /api/especialidades` | apoyo HU-04 | ADMIN | Lista especialidades para el formulario |
| `POST /api/medicos` | HU-04 | ADMIN | Registra médico + asigna especialidad |
| `GET /api/medicos` | apoyo HU-04 | ADMIN | Lista médicos (criterio: "lo muestra en el listado") |

### Reglas de negocio y mensajes (tomados del Product Backlog donde aplica)

- **Registro:** valida `nombre`, `apellido`, `email`, `password` (≥8), `telefono`
  opcional. Correo duplicado → 409 `"Este correo ya está registrado. Por favor inicia
  sesión o usa otro correo."`. Campo obligatorio vacío → 400 `"El nombre es un campo
  obligatorio."` (mismo patrón para los demás campos). Éxito → 201 `"Cuenta creada
  exitosamente. Bienvenido a MedTrack."`.
- **Login:** credenciales inválidas → 401 `"Correo o contraseña incorrectos. Intento N de
  5."` (incrementa `intentosFallidos`). Al llegar a 5 → bloquea 15 min y responde 403
  `"Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos."`. Login exitoso →
  200 con `{ token, usuario }` y resetea `intentosFallidos`/`bloqueadoHasta`.
- **Forgot-password:** responde siempre igual exista o no el correo (anti-enumeración):
  200 `"Si el correo existe, recibirás un enlace de recuperación."`. Si existe, genera un
  token de un solo uso (hash guardado en `PasswordResetToken`, expira en 30 min) y llama
  a `emailService.sendEmail`.
- **Reset-password:** token inválido/expirado/usado → 400 `"Este enlace ha expirado. Por
  favor solicita uno nuevo."`. Éxito → 200 `"Contraseña actualizada correctamente."`,
  marca el token usado.
- **Registrar médico:** valida `nombre`, `apellido`, `email`, `licencia`,
  `especialidadId` (`telefono` opcional). Licencia duplicada → 409 `"Ya existe un médico
  con esta cédula profesional."`. Éxito → 201 `"Médico registrado correctamente."`.
  Requiere rol ADMIN — si no, 403.

## Frontend

- `src/lib/apiClient.ts` — wrapper de `fetch` con base URL (`http://localhost:4000/api`
  por defecto) y manejo de JSON/errores.
- `src/context/AuthContext.tsx` — guarda `{ token, usuario }` en `localStorage`, expone
  `login()`/`logout()`.
- `ProtectedRoute` deja de ser un passthrough: redirige a `/login` si no hay sesión, y a
  la ruta raíz si el rol no coincide con `allowedRoles`.
- `LoginPage`, `RegisterPage`, `ForgotPasswordPage` — formularios reales conectados a sus
  endpoints.
- `ResetPasswordPage` (ruta nueva `/reset-password`, lee `?token=` de la URL).
- `DoctorsPage` (admin) — lista médicos existentes + formulario de alta con selector de
  especialidad.
- La ruta raíz `/` redirige según el estado de sesión: sin sesión → `/login`; `PACIENTE`
  → `/patient/dashboard`; `ADMIN` → `/admin/dashboard`.

## Testing

Backend: fake de `Db` en memoria (arrays), reconstruido en cada test (`beforeEach`),
inyectado a `createApp(fakeDb)`. Peticiones vía `supertest`. Mínimo un test por criterio
de aceptación (12 en total):

- HU-01: registro válido → 201 + mensaje; correo duplicado → 409 + mensaje exacto; campo
  obligatorio faltante → 400 + mensaje exacto.
- HU-02: credenciales válidas → 200 + token; contraseña incorrecta → 401 + mensaje con
  contador; 5 fallos consecutivos → cuenta bloqueada, un 6to intento (aunque la
  contraseña sea correcta) → 403.
- HU-03: solicitud con correo existente → se "envía" el mock (se verifica que
  `emailService` fue invocado / que se creó el token); token expirado → 400 + mensaje
  exacto; token válido → contraseña actualizada y permite login con la nueva.
- HU-04: admin registra médico con especialidad → 201 y aparece en `GET /medicos`;
  licencia duplicada → 409 + mensaje exacto; usuario sin rol ADMIN → 403.

Frontend: pruebas con React Testing Library (mockeando `apiClient`) para cada página
nueva o modificada, cubriendo el flujo principal y al menos un caso de error visible en
pantalla.

## Fuera de alcance de esta fase

- Proveedor de correo real (queda documentado como reemplazo futuro).
- CRUD completo de especialidades (Épica 2) — solo lectura, lo mínimo para HU-04.
- Pruebas de integración contra Postgres real (Épica 6 / HU-17).
- Horarios, citas, notificaciones, reportes (épicas 2–5 restantes).
