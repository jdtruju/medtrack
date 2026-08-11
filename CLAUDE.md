# CLAUDE.md — MedTrack

Sistema de gestión de citas médicas. Proyecto académico de Aseguramiento de la Calidad de
Software (ULACIT). Este archivo es la memoria del proyecto: stack, estructura, convenciones,
cómo correrlo, y el backlog oficial con su estado.

## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS + React Router
- **Backend:** Node.js + Express + TypeScript
- **Base de datos:** PostgreSQL vía Prisma ORM
- **Autenticación:** JWT + bcrypt (esquema de datos listo, lógica pendiente de implementar)
- **Validación:** Zod (frontend y backend)
- **Testing:** Vitest (+ supertest en backend, + React Testing Library en frontend)
- **Monorepo:** npm workspaces

## Estructura de carpetas

```
medtrack/
├── apps/
│   ├── backend/       # Express + TS + Prisma
│   └── frontend/       # Vite + React + TS + Tailwind
├── packages/
│   └── shared/         # Tipos TS compartidos (@medtrack/shared)
├── docs/superpowers/   # Specs y planes de diseño
├── package.json        # Workspace raíz
└── CLAUDE.md           # Este archivo
```

## Convenciones de código

- TypeScript estricto (`strict: true`) en todo el monorepo.
- ESLint + Prettier compartidos desde la raíz; correr `npm run lint` y `npm run format` antes de commitear.
- Componentes React en PascalCase (`LoginPage.tsx`); el resto de archivos en camelCase.
- Cada endpoint del backend valida su entrada con Zod y responde mensajes de error claros sin exponer detalles internos (ver `apps/backend/src/middlewares/errorHandler.ts`).
- Control de acceso por rol en cada ruta protegida, tanto en backend (middleware de auth, pendiente) como en frontend (`ProtectedRoute`).
- Nunca almacenar contraseñas en texto plano ni loguear datos sensibles (contraseñas, tokens, cédulas).
- El rol Médico no tiene login ni portal propio — es un registro gestionado por el Administrador (HU-04).

## Cómo correr el proyecto

1. `npm install` en la raíz — instala los tres workspaces (`apps/backend`, `apps/frontend`, `packages/shared`).
2. Copiar `.env.example` a `apps/backend/.env` y ajustar `DATABASE_URL` a una instancia de PostgreSQL local o de Supabase.
3. `npm run prisma:generate --workspace=apps/backend` — genera el cliente Prisma.
4. `npm run dev:backend` — levanta la API en `http://localhost:4000` (probar `GET /health`).
5. `npm run dev:frontend` — levanta el frontend en `http://localhost:5173`.
6. `npm test` — corre las pruebas de todos los workspaces.

## Backlog (fuente: ProductBacklog_MedTrack.pdf, Julio 2026)

### Épica 1 – Gestión de Usuarios

- [ ] HU-01 Registro de Pacientes — pendiente
- [ ] HU-02 Inicio de Sesión — pendiente
- [ ] HU-03 Recuperar Contraseña — pendiente
- [ ] HU-04 Registrar Médico — pendiente

### Épica 2 – Gestión de Médicos y Especialidades

- [ ] HU-05 Gestionar Horarios — pendiente
- [ ] HU-06 Consultar Disponibilidad — pendiente

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
