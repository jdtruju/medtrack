# CLAUDE.md - MedTrack

Sistema de gestion de citas medicas con enfoque en calidad y seguridad de software.
Este archivo documenta la estructura, stack, convenciones y estado del backlog.

## Stack

- Frontend: React + TypeScript + Vite + Tailwind CSS + React Router.
- Backend: Node.js + Express + TypeScript.
- Base de datos y autenticacion: Supabase PostgreSQL + Supabase Auth.
- Validacion backend: Zod.
- Testing: Vitest, Supertest y React Testing Library.
- Monorepo: npm workspaces.

## Arquitectura

El frontend consume la API de Express mediante `apps/frontend/src/lib/api.ts`.
El backend expone rutas bajo `/api/...` y concentra el acceso sensible a Supabase.

La `service_role key` solo debe existir en `apps/backend/.env`.
El frontend solo usa la publishable key para Supabase Realtime en disponibilidad.

## Estructura

```text
medtrack/
  apps/
    backend/        Express + TypeScript + servicios Supabase
    frontend/       React + Vite + pantallas de usuario/admin
  packages/
    shared/         Tipos compartidos
  supabase/
    migrations/     Migraciones SQL
    README.md       Guia para configurar Supabase
  docs/
    superpowers/    Specs y planes del proyecto
  CLAUDE.md
  README.md
```

## Variables de entorno

Backend: `apps/backend/.env`

```env
PORT=4000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
FRONTEND_URL=http://localhost:5173
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Frontend: `apps/frontend/.env`

```env
VITE_API_URL=http://localhost:4000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key
```

## Como correr

```bash
npm install
npm run dev:backend
npm run dev:frontend
```

Antes de iniciar sesion con datos reales, aplicar las migraciones de `supabase/migrations/`.
Ver `supabase/README.md`.

## Verificacion

```bash
npm run lint
npm test
npm run build
```

## Convenciones

- TypeScript estricto en el monorepo.
- Los endpoints validan entrada con Zod.
- Las rutas protegidas usan `requireAuth` y, cuando aplica, `requireRole`.
- No registrar ni exponer contrasenas, tokens ni claves privadas.
- El medico no tiene login propio por ahora; es gestionado por el administrador.
- Los repositorios en memoria existen para pruebas automatizadas, no para produccion.

## Estado del backlog

### Epica 1 - Gestion de Usuarios

- [x] HU-01 Registro de Pacientes
- [x] HU-02 Inicio de Sesion
- [x] HU-03 Recuperar Contrasena
- [x] HU-04 Registrar Medico

### Epica 2 - Gestion de Medicos y Especialidades

- [x] HU-05 Gestionar Horarios
- [x] HU-06 Consultar Disponibilidad

Nota HU-06: actualmente muestra horarios disponibles por medico/especialidad. La exclusion de horarios ocupados se completara cuando exista la Epica 3 de citas.

### Epica 3 - Gestion de Citas Medicas

- [ ] HU-07 Crear Cita Medica
- [ ] HU-08 Reprogramar Cita
- [ ] HU-09 Cancelar Cita

### Epica 4 - Notificaciones

- [ ] HU-10 Confirmacion por Correo
- [ ] HU-11 Recordatorio de Citas
- [ ] HU-12 Notificacion de Cancelacion

### Epica 5 - Reportes

- [ ] HU-13 Reporte de Disponibilidad
- [ ] HU-14 Reporte de Citas
- [ ] HU-15 Dashboard Administrativo

### Epica 6 - Calidad del Software

- [ ] HU-16 Pruebas Funcionales
- [ ] HU-17 Pruebas de Integracion
- [ ] HU-18 Pruebas de Rendimiento
- [ ] HU-19 Pruebas de Usabilidad
- [ ] HU-20 Pruebas de Seguridad
