# CLAUDE.md — MedTrack

Sistema de gestión de citas médicas. Proyecto académico de Aseguramiento de la Calidad de
Software (ULACIT). Este archivo es la memoria del proyecto: stack, estructura, convenciones,
cómo correrlo, y el backlog oficial con su estado.

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS + React Router
- **Backend:** Node.js + Express + TypeScript — intermediario real entre el frontend y Supabase (la `service_role key` de Supabase solo vive en el backend, nunca en el navegador)
- **Base de datos y autenticación:** Supabase (PostgreSQL + Supabase Auth), sin ORM — esquema en `supabase/migrations/*.sql`, aplicado a mano en el SQL Editor del dashboard
- **Validación:** Zod (backend)
- **Testing:** Vitest (+ supertest en backend con un fake de `AppServices` en memoria, + React Testing Library en frontend mockeando `fetch`)
- **Monorepo:** npm workspaces

## Estructura de carpetas

```
medtrack/
├── apps/
│   ├── backend/       # Express + TS — habla con Supabase via AppServices
│   └── frontend/       # Vite + React + TS + Tailwind — habla con Express via lib/api.ts
├── packages/
│   └── shared/         # Tipos TS compartidos (@medtrack/shared)
├── supabase/           # Migraciones SQL y README para aplicarlas a mano
├── docs/superpowers/   # Specs y planes de diseño
├── package.json        # Workspace raíz
└── CLAUDE.md           # Este archivo
```

## Convenciones de código

- TypeScript estricto (`strict: true`) en todo el monorepo.
- ESLint + Prettier compartidos desde la raíz; correr `npm run lint` y `npm run format` antes de commitear.
- Componentes React en PascalCase (`LoginPage.tsx`); el resto de archivos en camelCase.
- Cada endpoint del backend valida su entrada con Zod y responde mensajes de error claros sin exponer detalles internos (ver `apps/backend/src/middlewares/errorHandler.ts`).
- Control de acceso por rol en cada ruta protegida, tanto en backend (`requireAuth`/`requireRole` en `apps/backend/src/middlewares/auth.ts`) como en frontend (`ProtectedRoute`).
- Nunca almacenar contraseñas en texto plano ni loguear datos sensibles (contraseñas, tokens, cédulas).
- El rol Médico no tiene login ni portal propio — es un registro gestionado por el Administrador (HU-04).

## Cómo correr el proyecto

1. `npm install` en la raíz.
2. Aplicar los archivos de `supabase/migrations/` en el SQL Editor del dashboard de Supabase, en orden (ver `supabase/README.md`).
3. Copiar `.env.example` a `apps/backend/.env` y completar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API en el dashboard de Supabase — la `service_role key`, no la publishable).
4. Copiar `apps/frontend/.env.example` a `apps/frontend/.env` con `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` (solo se usan para la suscripción Realtime de `AvailabilityPage`).
5. `npm run dev:backend` — levanta la API en `http://localhost:4000`.
6. `npm run dev:frontend` — levanta el frontend en `http://localhost:5173`.
7. `npm test` — corre las pruebas de todos los workspaces.

## Notas de Épica 1 y 2 (Express + Supabase)

- El frontend habla con Express (`/api/...`); Express es el único que tiene la `service_role key` de Supabase. La única excepción es `AvailabilityPage`, que abre una suscripción Realtime de solo lectura directo a Supabase con la key pública (Realtime es una conexión navegador→Supabase por diseño de la plataforma).
- El correo de recuperación de contraseña es real (Supabase Auth lo envía); Express solo orquesta la llamada.
- El bloqueo de cuenta tras 5 intentos fallidos vive en las funciones Postgres `check_login_lock`/`record_login_attempt`, llamadas desde Express.
- Para crear el primer usuario ADMIN, ver `supabase/README.md`.
- HU-06 ("solo horarios libres") hoy muestra todos los horarios creados — excluir los horarios con una cita activa queda para cuando exista la Épica 3.

## Backlog (fuente: ProductBacklog_MedTrack.pdf, Julio 2026)

### Épica 1 – Gestión de Usuarios

- [x] HU-01 Registro de Pacientes — completada en Sprint 1
- [x] HU-02 Inicio de Sesión — completada en Sprint 1
- [x] HU-03 Recuperar Contraseña — completada en Sprint 1
- [x] HU-04 Registrar Médico — completada en Sprint 1

### Épica 2 – Gestión de Médicos y Especialidades

- [x] HU-05 Gestionar Horarios — completada en Sprint 2
- [x] HU-06 Consultar Disponibilidad — completada en Sprint 2

### Épica 3 – Gestión de Citas Médicas

- [ ] HU-07 Crear Cita Médica — pendiente
- [ ] HU-08 Reprogramar Cita — pendiente
- [ ] HU-09 Cancelar Cita — pendiente

### Épica 4 – Notificaciones

- [ ] HU-10 Confirmación por Correo — pendiente
- [ ] HU-11 Recordatorio de Citas — pendiente
- [ ] HU-12 Notificación de Cancelación — pendiente

### Épica 5 – Reportes

- [ ] HU-13 Reporte de Disponibilidad — pendiente
- [ ] HU-14 Reporte de Citas — pendiente
- [ ] HU-15 Dashboard Administrativo — pendiente

### Épica 6 – Calidad del Software (QA)

- [ ] HU-16 Pruebas Funcionales — pendiente
- [ ] HU-17 Pruebas de Integración — pendiente
- [ ] HU-18 Pruebas de Rendimiento — pendiente
- [ ] HU-19 Pruebas de Usabilidad — pendiente
- [ ] HU-20 Pruebas de Seguridad — pendiente

**Distribución de sprints (referencia):** Sprint 1 = HU-01..04 · Sprint 2 = HU-05..09 · Sprint 3 = HU-10..14 · Sprint 4 = HU-15..20.
