# Épica 1 (v3, Express) + Épica 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Express a real backend intermediary for HU-01..HU-04 (talking to Supabase Auth/Postgres with the `service_role` key, never exposed to the browser), and add HU-05/HU-06 (Épica 2 — horarios y disponibilidad) on the same foundation.

**Architecture:** Repository pattern (already used once in this codebase by a teammate's now-superseded PR): `AppServices` interface with a Supabase-backed implementation for production and an in-memory fake for tests. `createApp(services)` stays framework-agnostic of which one it gets. Frontend talks only to Express via `fetch` (`lib/api.ts`), except one page (`AvailabilityPage`) which also opens a read-only Supabase Realtime subscription, because Realtime is a browser→Supabase connection by design and cannot be proxied through Express.

**Tech Stack:** Express, TypeScript, Zod, `@supabase/supabase-js` (server-side in the backend, and client-side only for Realtime in the frontend), Vitest, supertest, React, React Router.

## Global Constraints

- Ningún archivo del frontend excepto `AvailabilityPage.tsx` (y el `supabaseClient.ts` que ya existe) importa `@supabase/supabase-js`.
- `SUPABASE_SERVICE_ROLE_KEY` vive solo en `apps/backend/.env`, nunca en el frontend ni en un archivo comiteado.
- Los mensajes de error/éxito visibles al usuario deben coincidir con los ya usados en las historias anteriores (no se reinventan).
- `supabase/migrations/0005_horarios_y_visibilidad.sql` lo aplica el usuario a mano en el SQL Editor de Supabase — esta sesión no tiene el connection string ni el service_role key reales y no se van a pedir.
- Ruta base de la API: `/api` (excepto `/health`, sin prefijo).

---

### Task 1: Interfaces de servicios + fake en memoria (base para todos los tests)

**Files:**
- Create: `apps/backend/src/services/appServices.ts`
- Create: `apps/backend/src/repositories/inMemoryRepositories.ts`
- Create: `apps/backend/src/types/express.d.ts`
- Test: `apps/backend/tests/inMemoryServices.test.ts`

**Interfaces:**
- Produces: `AppServices` (con `auth`, `especialidades`, `medicos`, `horarios`), tipos `AuthUser`, `TokenUser`, `Especialidad`, `Medico`, `Horario`, `Result<T> = { ok: true; value: T } | { ok: false; error: { status: number; message: string } }`, y `createInMemoryServices(): AppServices`. Todas las tareas siguientes consumen esto.

- [ ] **Step 1: Crear `apps/backend/src/services/appServices.ts`**

```ts
export interface AuthUser {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: 'PACIENTE' | 'ADMIN';
}

export interface TokenUser {
  id: string;
  email: string;
}

export interface ServiceError {
  status: number;
  message: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: ServiceError };

export interface RegisterInput {
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string;
  password: string;
}

export interface AuthService {
  register(input: RegisterInput): Promise<Result<void>>;
  login(email: string, password: string): Promise<Result<{ token: string; usuario: AuthUser }>>;
  forgotPassword(email: string): Promise<void>;
  resetPassword(accessToken: string, password: string): Promise<Result<void>>;
  getUserFromToken(token: string): Promise<TokenUser | null>;
  getRole(userId: string): Promise<'PACIENTE' | 'ADMIN' | null>;
}

export interface Especialidad {
  id: string;
  nombre: string;
}

export interface EspecialidadesService {
  list(): Promise<Especialidad[]>;
}

export interface Medico {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string;
  licencia: string;
  especialidadId: string;
}

export interface MedicosService {
  list(): Promise<Medico[]>;
  create(input: Omit<Medico, 'id'>): Promise<Result<Medico>>;
}

export interface Horario {
  id: string;
  medicoId: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
}

export interface HorarioFilters {
  medicoId?: string;
  especialidadId?: string;
}

export interface HorariosService {
  list(filters: HorarioFilters): Promise<Horario[]>;
  create(input: Omit<Horario, 'id'>): Promise<Result<Horario>>;
  update(id: string, input: Omit<Horario, 'id'>): Promise<Result<Horario>>;
  remove(id: string): Promise<Result<void>>;
}

export interface AppServices {
  auth: AuthService;
  especialidades: EspecialidadesService;
  medicos: MedicosService;
  horarios: HorariosService;
}
```

- [ ] **Step 2: Crear `apps/backend/src/types/express.d.ts`**

```ts
import type { TokenUser } from '../services/appServices';

declare global {
  namespace Express {
    interface Request {
      user?: TokenUser;
    }
  }
}

export {};
```

- [ ] **Step 3: Write the failing test — `apps/backend/tests/inMemoryServices.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { createInMemoryServices } from '../src/repositories/inMemoryRepositories';

describe('createInMemoryServices', () => {
  it('registra, loguea y bloquea tras 5 intentos fallidos', async () => {
    const services = createInMemoryServices();

    const registered = await services.auth.register({
      nombre: 'Ana',
      apellido: 'Mora',
      email: 'ana@medtrack.test',
      password: 'Segura123',
    });
    expect(registered.ok).toBe(true);

    const dup = await services.auth.register({
      nombre: 'Otra',
      apellido: 'Persona',
      email: 'ana@medtrack.test',
      password: 'Segura123',
    });
    expect(dup).toEqual({
      ok: false,
      error: { status: 409, message: 'Este correo ya está registrado. Por favor inicia sesión o usa otro correo.' },
    });

    for (let i = 0; i < 4; i += 1) {
      const attempt = await services.auth.login('ana@medtrack.test', 'mala');
      expect(attempt.ok).toBe(false);
    }
    const fifth = await services.auth.login('ana@medtrack.test', 'mala');
    expect(fifth).toEqual({
      ok: false,
      error: { status: 403, message: 'Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.' },
    });

    const success = await services.auth.login('ana@medtrack.test', 'Segura123');
    expect(success.ok).toBe(false); // sigue bloqueada, el bloqueo no se salta con la contraseña correcta
  });

  it('registra especialidades semilla y permite crear medicos sin licencia duplicada', async () => {
    const services = createInMemoryServices();
    const especialidades = await services.especialidades.list();
    expect(especialidades.length).toBeGreaterThan(0);

    const especialidadId = especialidades[0].id;
    const created = await services.medicos.create({
      nombre: 'Elena',
      apellido: 'Campos',
      email: 'elena@medtrack.test',
      licencia: 'MED-1',
      especialidadId,
    });
    expect(created.ok).toBe(true);

    const dup = await services.medicos.create({
      nombre: 'Otro',
      apellido: 'Medico',
      email: 'otro@medtrack.test',
      licencia: 'MED-1',
      especialidadId,
    });
    expect(dup).toEqual({
      ok: false,
      error: { status: 409, message: 'Ya existe un médico con esta cédula profesional.' },
    });
  });

  it('crea, edita y elimina horarios validando que la hora de fin sea posterior', async () => {
    const services = createInMemoryServices();
    const [especialidad] = await services.especialidades.list();
    const medico = await services.medicos.create({
      nombre: 'Dr',
      apellido: 'Lopez',
      email: 'lopez@medtrack.test',
      licencia: 'MED-2',
      especialidadId: especialidad.id,
    });
    if (!medico.ok) throw new Error('setup failed');

    const invalid = await services.horarios.create({
      medicoId: medico.value.id,
      diaSemana: 'LUN',
      horaInicio: '10:00',
      horaFin: '09:00',
    });
    expect(invalid.ok).toBe(false);

    const created = await services.horarios.create({
      medicoId: medico.value.id,
      diaSemana: 'LUN',
      horaInicio: '08:00',
      horaFin: '12:00',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('unreachable');

    const updated = await services.horarios.update(created.value.id, {
      medicoId: medico.value.id,
      diaSemana: 'LUN',
      horaInicio: '09:00',
      horaFin: '13:00',
    });
    expect(updated.ok).toBe(true);

    const listed = await services.horarios.list({ medicoId: medico.value.id });
    expect(listed).toHaveLength(1);

    const removed = await services.horarios.remove(created.value.id);
    expect(removed.ok).toBe(true);

    const afterRemove = await services.horarios.list({ medicoId: medico.value.id });
    expect(afterRemove).toHaveLength(0);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm run test --workspace=apps/backend -- inMemoryServices`
Expected: FAIL — `Cannot find module '../src/repositories/inMemoryRepositories'`.

- [ ] **Step 5: Crear `apps/backend/src/repositories/inMemoryRepositories.ts`**

```ts
import type {
  AppServices,
  AuthService,
  Especialidad,
  EspecialidadesService,
  Horario,
  HorariosService,
  Medico,
  MedicosService,
} from '../services/appServices';

interface StoredUser {
  id: string;
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  rol: 'PACIENTE' | 'ADMIN';
}

const LOCK_DURATION_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function createInMemoryServices(): AppServices {
  const users: StoredUser[] = [];
  const tokens = new Map<string, string>();
  const loginAttempts = new Map<string, { intentos: number; bloqueadoHasta: number | null }>();
  const especialidades: Especialidad[] = [
    { id: 'esp-1', nombre: 'Cardiología' },
    { id: 'esp-2', nombre: 'Pediatría' },
    { id: 'esp-3', nombre: 'Dermatología' },
  ];
  const medicos: Medico[] = [];
  const horarios: Horario[] = [];
  let nextId = 1;
  const newId = (prefix: string) => `${prefix}-${nextId++}`;

  const auth: AuthService = {
    async register({ nombre, apellido, email, telefono, password }) {
      if (users.some((u) => u.email === email)) {
        return {
          ok: false,
          error: { status: 409, message: 'Este correo ya está registrado. Por favor inicia sesión o usa otro correo.' },
        };
      }
      users.push({ id: newId('user'), email, password, nombre, apellido, telefono, rol: 'PACIENTE' });
      return { ok: true, value: undefined };
    },
    async login(email, password) {
      const lock = loginAttempts.get(email);
      if (lock?.bloqueadoHasta && lock.bloqueadoHasta > Date.now()) {
        return {
          ok: false,
          error: { status: 403, message: 'Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.' },
        };
      }

      const user = users.find((u) => u.email === email && u.password === password);
      if (!user) {
        const current = loginAttempts.get(email) ?? { intentos: 0, bloqueadoHasta: null };
        current.intentos += 1;
        if (current.intentos >= MAX_ATTEMPTS) {
          current.bloqueadoHasta = Date.now() + LOCK_DURATION_MS;
          loginAttempts.set(email, current);
          return {
            ok: false,
            error: { status: 403, message: 'Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.' },
          };
        }
        loginAttempts.set(email, current);
        return {
          ok: false,
          error: { status: 401, message: `Correo o contraseña incorrectos. Intento ${current.intentos} de 5.` },
        };
      }

      loginAttempts.delete(email);
      const token = newId('token');
      tokens.set(token, user.id);
      return {
        ok: true,
        value: {
          token,
          usuario: { id: user.id, email: user.email, nombre: user.nombre, apellido: user.apellido, rol: user.rol },
        },
      };
    },
    async forgotPassword() {
      // en memoria no hace nada; la implementación real llama a Supabase Auth
    },
    async resetPassword(accessToken, password) {
      const userId = tokens.get(accessToken);
      if (!userId) {
        return { ok: false, error: { status: 400, message: 'Este enlace ha expirado. Por favor solicita uno nuevo.' } };
      }
      const user = users.find((u) => u.id === userId);
      if (!user) {
        return { ok: false, error: { status: 400, message: 'Este enlace ha expirado. Por favor solicita uno nuevo.' } };
      }
      user.password = password;
      return { ok: true, value: undefined };
    },
    async getUserFromToken(token) {
      const userId = tokens.get(token);
      if (!userId) return null;
      const user = users.find((u) => u.id === userId);
      return user ? { id: user.id, email: user.email } : null;
    },
    async getRole(userId) {
      return users.find((u) => u.id === userId)?.rol ?? null;
    },
  };

  const especialidadesService: EspecialidadesService = {
    async list() {
      return especialidades;
    },
  };

  const medicosService: MedicosService = {
    async list() {
      return medicos;
    },
    async create(input) {
      if (medicos.some((m) => m.licencia === input.licencia)) {
        return { ok: false, error: { status: 409, message: 'Ya existe un médico con esta cédula profesional.' } };
      }
      const medico: Medico = { id: newId('medico'), ...input };
      medicos.push(medico);
      return { ok: true, value: medico };
    },
  };

  const horariosService: HorariosService = {
    async list({ medicoId, especialidadId }) {
      return horarios.filter((h) => {
        if (medicoId && h.medicoId !== medicoId) return false;
        if (especialidadId) {
          const medico = medicos.find((m) => m.id === h.medicoId);
          if (!medico || medico.especialidadId !== especialidadId) return false;
        }
        return true;
      });
    },
    async create(input) {
      if (input.horaFin <= input.horaInicio) {
        return { ok: false, error: { status: 400, message: 'La hora de fin debe ser posterior a la hora de inicio.' } };
      }
      const horario: Horario = { id: newId('horario'), ...input };
      horarios.push(horario);
      return { ok: true, value: horario };
    },
    async update(id, input) {
      const index = horarios.findIndex((h) => h.id === id);
      if (index === -1) {
        return { ok: false, error: { status: 404, message: 'Horario no encontrado.' } };
      }
      if (input.horaFin <= input.horaInicio) {
        return { ok: false, error: { status: 400, message: 'La hora de fin debe ser posterior a la hora de inicio.' } };
      }
      horarios[index] = { id, ...input };
      return { ok: true, value: horarios[index] };
    },
    async remove(id) {
      const index = horarios.findIndex((h) => h.id === id);
      if (index === -1) {
        return { ok: false, error: { status: 404, message: 'Horario no encontrado.' } };
      }
      horarios.splice(index, 1);
      return { ok: true, value: undefined };
    },
  };

  return { auth, especialidades: especialidadesService, medicos: medicosService, horarios: horariosService };
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test --workspace=apps/backend -- inMemoryServices`
Expected: PASS — los 3 tests.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/services apps/backend/src/repositories apps/backend/src/types apps/backend/tests/inMemoryServices.test.ts
git commit -m "feat: add AppServices interface and in-memory fake for backend tests"
```

---

### Task 2: `requireAuth`/`requireRole`, `app.ts` con servicios inyectados, `/health` actualizado

**Files:**
- Create: `apps/backend/src/middlewares/auth.ts`
- Modify: `apps/backend/src/routes/index.ts`
- Modify: `apps/backend/src/app.ts`
- Modify: `apps/backend/tests/health.test.ts`
- Create: `apps/backend/tests/helpers/inMemoryServices.ts`

**Interfaces:**
- Consumes: `AppServices`, `AuthUser`, `TokenUser` (Tarea 1).
- Produces: `createApp(services: AppServices): Express`; `requireAuth(services)`, `requireRole(services, 'ADMIN')` — middlewares de Express que las Tareas 4/6/8 usan para proteger rutas.

- [ ] **Step 1: Crear `apps/backend/src/middlewares/auth.ts`**

```ts
import type { NextFunction, Request, Response } from 'express';
import type { AppServices } from '../services/appServices';

export function requireAuth(services: AppServices) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      res.status(401).json({ error: 'No autenticado.' });
      return;
    }

    const user = await services.auth.getUserFromToken(token);
    if (!user) {
      res.status(401).json({ error: 'No autenticado.' });
      return;
    }

    req.user = user;
    next();
  };
}

export function requireRole(services: AppServices, role: 'ADMIN') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const rol = await services.auth.getRole(req.user!.id);
    if (rol !== role) {
      res.status(403).json({ error: 'No tienes permisos para acceder a esta sección.' });
      return;
    }
    next();
  };
}
```

- [ ] **Step 2: Simplificar `apps/backend/src/routes/index.ts`**

```ts
import { Router } from 'express';
import type { AppServices } from '../services/appServices';
import { healthRouter } from './health';

export function apiRouter(_services: AppServices) {
  const router = Router();
  router.use(healthRouter);
  return router;
}
```

(Las tareas 4, 6 y 8 van a agregar `router.use('/api', ...)` con los módulos de auth/médicos/horarios — este archivo se vuelve a modificar en cada una.)

- [ ] **Step 3: Modificar `apps/backend/src/app.ts`**

```ts
import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { notFound } from './middlewares/notFound';
import { apiRouter } from './routes';
import type { AppServices } from './services/appServices';

export function createApp(services: AppServices) {
  const app = express();

  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());
  app.use(apiRouter(services));
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
```

- [ ] **Step 4: Crear `apps/backend/tests/helpers/inMemoryServices.ts`**

```ts
export { createInMemoryServices } from '../../src/repositories/inMemoryRepositories';
```

- [ ] **Step 5: Actualizar `apps/backend/tests/health.test.ts`**

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createInMemoryServices } from './helpers/inMemoryServices';

describe('GET /health', () => {
  it('responde con status ok', async () => {
    const app = createApp(createInMemoryServices());
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test --workspace=apps/backend -- health`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/middlewares/auth.ts apps/backend/src/routes/index.ts apps/backend/src/app.ts apps/backend/tests/health.test.ts apps/backend/tests/helpers/inMemoryServices.ts
git commit -m "feat: inject AppServices into createApp, add requireAuth/requireRole middlewares"
```

---

### Task 3: Cliente Supabase server-side y repositorio real

**Files:**
- Modify: `apps/backend/src/config/env.ts`
- Create: `apps/backend/src/lib/supabaseAdmin.ts`
- Create: `apps/backend/src/repositories/supabaseRepositories.ts`
- Modify: `apps/backend/src/server.ts`
- Modify: `apps/backend/package.json`
- Modify: `.env.example` (raíz)

**Interfaces:**
- Consumes: `AppServices` y todos sus sub-tipos (Tarea 1).
- Produces: `createSupabaseServices(supabaseAdmin, frontendUrl): AppServices`, usado solo por `server.ts` (nunca por los tests).

**Nota:** este archivo no tiene test propio — no hay conexión real a Supabase desde esta
sesión. Se verifica con `tsc` (que compile) y manualmente por el usuario cuando levante
el backend con credenciales reales.

- [ ] **Step 1: Agregar dependencia `@supabase/supabase-js` al backend**

Run: `npm install @supabase/supabase-js --workspace=apps/backend`

- [ ] **Step 2: Actualizar `apps/backend/src/config/env.ts`**

```ts
import 'dotenv/config';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
};
```

- [ ] **Step 3: Crear `apps/backend/src/lib/supabaseAdmin.ts`**

```ts
import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

export const supabaseAdmin = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
```

- [ ] **Step 4: Crear `apps/backend/src/repositories/supabaseRepositories.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AppServices,
  AuthService,
  Especialidad,
  EspecialidadesService,
  Horario,
  HorariosService,
  Medico,
  MedicosService,
} from '../services/appServices';

export function createSupabaseServices(client: SupabaseClient, frontendUrl: string): AppServices {
  const auth: AuthService = {
    async register({ nombre, apellido, email, telefono, password }) {
      const { error } = await client.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nombre, apellido, telefono },
      });

      if (error) {
        const isDuplicate = error.message.toLowerCase().includes('already');
        return {
          ok: false,
          error: {
            status: isDuplicate ? 409 : 400,
            message: isDuplicate
              ? 'Este correo ya está registrado. Por favor inicia sesión o usa otro correo.'
              : error.message,
          },
        };
      }

      return { ok: true, value: undefined };
    },

    async login(email, password) {
      const { data: lock } = await client.rpc('check_login_lock', { p_email: email });
      if (lock?.bloqueado) {
        return {
          ok: false,
          error: { status: 403, message: 'Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.' },
        };
      }

      const { data, error } = await client.auth.signInWithPassword({ email, password });

      if (error || !data.session || !data.user) {
        const { data: attempt } = await client.rpc('record_login_attempt', { p_email: email, p_exitoso: false });
        if (attempt?.bloqueado) {
          return {
            ok: false,
            error: { status: 403, message: 'Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.' },
          };
        }
        return {
          ok: false,
          error: {
            status: 401,
            message: `Correo o contraseña incorrectos. Intento ${attempt?.intentos ?? 1} de 5.`,
          },
        };
      }

      await client.rpc('record_login_attempt', { p_email: email, p_exitoso: true });

      const { data: perfil } = await client
        .from('perfiles')
        .select('nombre, apellido, rol')
        .eq('id', data.user.id)
        .single();

      return {
        ok: true,
        value: {
          token: data.session.access_token,
          usuario: {
            id: data.user.id,
            email: data.user.email ?? email,
            nombre: perfil?.nombre ?? '',
            apellido: perfil?.apellido ?? '',
            rol: (perfil?.rol as 'PACIENTE' | 'ADMIN') ?? 'PACIENTE',
          },
        },
      };
    },

    async forgotPassword(email) {
      await client.auth.resetPasswordForEmail(email, { redirectTo: `${frontendUrl}/reset-password` });
    },

    async resetPassword(accessToken, password) {
      const { data, error } = await client.auth.getUser(accessToken);
      if (error || !data.user) {
        return { ok: false, error: { status: 400, message: 'Este enlace ha expirado. Por favor solicita uno nuevo.' } };
      }

      const { error: updateError } = await client.auth.admin.updateUserById(data.user.id, { password });
      if (updateError) {
        return { ok: false, error: { status: 400, message: 'Este enlace ha expirado. Por favor solicita uno nuevo.' } };
      }

      return { ok: true, value: undefined };
    },

    async getUserFromToken(token) {
      const { data, error } = await client.auth.getUser(token);
      if (error || !data.user) return null;
      return { id: data.user.id, email: data.user.email ?? '' };
    },

    async getRole(userId) {
      const { data } = await client.from('perfiles').select('rol').eq('id', userId).single();
      return (data?.rol as 'PACIENTE' | 'ADMIN') ?? null;
    },
  };

  const especialidades: EspecialidadesService = {
    async list() {
      const { data } = await client.from('especialidades').select('id, nombre').order('nombre');
      return (data as Especialidad[]) ?? [];
    },
  };

  const medicos: MedicosService = {
    async list() {
      const { data } = await client
        .from('medicos')
        .select('id, nombre, apellido, email, telefono, licencia, especialidad_id');
      return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: row.id as string,
        nombre: row.nombre as string,
        apellido: row.apellido as string,
        email: row.email as string,
        telefono: row.telefono as string | undefined,
        licencia: row.licencia as string,
        especialidadId: row.especialidad_id as string,
      }));
    },
    async create(input) {
      const { data, error } = await client
        .from('medicos')
        .insert({
          nombre: input.nombre,
          apellido: input.apellido,
          email: input.email,
          telefono: input.telefono,
          licencia: input.licencia,
          especialidad_id: input.especialidadId,
        })
        .select()
        .single();

      if (error) {
        const isDuplicate = error.code === '23505';
        return {
          ok: false,
          error: {
            status: isDuplicate ? 409 : 400,
            message: isDuplicate ? 'Ya existe un médico con esta cédula profesional.' : error.message,
          },
        };
      }

      const medico: Medico = {
        id: data.id,
        nombre: data.nombre,
        apellido: data.apellido,
        email: data.email,
        telefono: data.telefono,
        licencia: data.licencia,
        especialidadId: data.especialidad_id,
      };
      return { ok: true, value: medico };
    },
  };

  const horarios: HorariosService = {
    async list({ medicoId, especialidadId }) {
      let medicoIds: string[] | undefined;
      if (especialidadId) {
        const { data } = await client.from('medicos').select('id').eq('especialidad_id', especialidadId);
        medicoIds = ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
      }

      let query = client.from('horarios').select('id, medico_id, dia_semana, hora_inicio, hora_fin');
      if (medicoId) query = query.eq('medico_id', medicoId);
      if (medicoIds) query = query.in('medico_id', medicoIds);

      const { data } = await query;
      return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: row.id as string,
        medicoId: row.medico_id as string,
        diaSemana: row.dia_semana as string,
        horaInicio: row.hora_inicio as string,
        horaFin: row.hora_fin as string,
      }));
    },
    async create(input) {
      if (input.horaFin <= input.horaInicio) {
        return { ok: false, error: { status: 400, message: 'La hora de fin debe ser posterior a la hora de inicio.' } };
      }
      const { data, error } = await client
        .from('horarios')
        .insert({
          medico_id: input.medicoId,
          dia_semana: input.diaSemana,
          hora_inicio: input.horaInicio,
          hora_fin: input.horaFin,
        })
        .select()
        .single();

      if (error) {
        return { ok: false, error: { status: 400, message: error.message } };
      }

      return {
        ok: true,
        value: {
          id: data.id,
          medicoId: data.medico_id,
          diaSemana: data.dia_semana,
          horaInicio: data.hora_inicio,
          horaFin: data.hora_fin,
        },
      };
    },
    async update(id, input) {
      if (input.horaFin <= input.horaInicio) {
        return { ok: false, error: { status: 400, message: 'La hora de fin debe ser posterior a la hora de inicio.' } };
      }
      const { data, error } = await client
        .from('horarios')
        .update({
          medico_id: input.medicoId,
          dia_semana: input.diaSemana,
          hora_inicio: input.horaInicio,
          hora_fin: input.horaFin,
        })
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return { ok: false, error: { status: 404, message: 'Horario no encontrado.' } };
      }

      return {
        ok: true,
        value: {
          id: data.id,
          medicoId: data.medico_id,
          diaSemana: data.dia_semana,
          horaInicio: data.hora_inicio,
          horaFin: data.hora_fin,
        },
      };
    },
    async remove(id) {
      const { error } = await client.from('horarios').delete().eq('id', id);
      if (error) {
        return { ok: false, error: { status: 404, message: 'Horario no encontrado.' } };
      }
      return { ok: true, value: undefined };
    },
  };

  return { auth, especialidades, medicos, horarios };
}
```

- [ ] **Step 5: Actualizar `apps/backend/src/server.ts`**

```ts
import { createApp } from './app';
import { env } from './config/env';
import { supabaseAdmin } from './lib/supabaseAdmin';
import { createSupabaseServices } from './repositories/supabaseRepositories';

const services = createSupabaseServices(supabaseAdmin, env.frontendUrl);
const app = createApp(services);

app.listen(env.port, () => {
  console.log(`MedTrack backend escuchando en el puerto ${env.port}`);
});
```

- [ ] **Step 6: Actualizar `.env.example` (raíz)**

```
PORT=4000
NODE_ENV=development
CORS_ORIGIN="http://localhost:5173"
FRONTEND_URL="http://localhost:5173"
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 7: Verificar que compila**

Run: `npx tsc -p apps/backend/tsconfig.json --noEmit`
Expected: sin errores.

- [ ] **Step 8: Commit**

```bash
git add apps/backend/src apps/backend/package.json apps/backend/package-lock.json .env.example
git commit -m "feat: add Supabase-backed AppServices implementation for production"
```

---

### Task 4: HU-01/HU-02 — rutas de registro y login en Express

**Files:**
- Create: `apps/backend/src/routes/auth.ts`
- Modify: `apps/backend/src/routes/index.ts`
- Test: `apps/backend/tests/auth.test.ts`

**Interfaces:**
- Consumes: `AppServices.auth` (Tarea 1), `createApp` (Tarea 2).
- Produces: `createAuthRouter(services): Router` montado en `/api/auth`.

- [ ] **Step 1: Write the failing tests — `apps/backend/tests/auth.test.ts`**

```ts
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createInMemoryServices } from './helpers/inMemoryServices';
import type { AppServices } from '../src/services/appServices';

let services: AppServices;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  services = createInMemoryServices();
  app = createApp(services);
});

describe('POST /api/auth/register', () => {
  it('HU-01 registra un paciente valido', async () => {
    const response = await request(app).post('/api/auth/register').send({
      nombre: 'Ana',
      apellido: 'Mora',
      email: 'ana@medtrack.test',
      password: 'Segura123',
    });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Cuenta creada exitosamente. Bienvenido a MedTrack.');
  });

  it('HU-01 rechaza un correo duplicado', async () => {
    await request(app).post('/api/auth/register').send({
      nombre: 'Ana',
      apellido: 'Mora',
      email: 'ana@medtrack.test',
      password: 'Segura123',
    });

    const response = await request(app).post('/api/auth/register').send({
      nombre: 'Otra',
      apellido: 'Persona',
      email: 'ana@medtrack.test',
      password: 'Segura123',
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Este correo ya está registrado. Por favor inicia sesión o usa otro correo.');
  });

  it('HU-01 exige el nombre', async () => {
    const response = await request(app).post('/api/auth/register').send({
      nombre: '',
      apellido: 'Mora',
      email: 'ana@medtrack.test',
      password: 'Segura123',
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('El nombre es un campo obligatorio.');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await services.auth.register({
      nombre: 'Ana',
      apellido: 'Mora',
      email: 'ana@medtrack.test',
      password: 'Segura123',
    });
  });

  it('HU-02 autentica con credenciales validas', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@medtrack.test', password: 'Segura123' });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeTruthy();
    expect(response.body.usuario.email).toBe('ana@medtrack.test');
  });

  it('HU-02 rechaza credenciales incorrectas con contador', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@medtrack.test', password: 'mala' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Correo o contraseña incorrectos. Intento 1 de 5.');
  });

  it('HU-02 bloquea la cuenta tras 5 intentos fallidos', async () => {
    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/auth/login').send({ email: 'ana@medtrack.test', password: 'mala' });
    }

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@medtrack.test', password: 'Segura123' });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test --workspace=apps/backend -- auth`
Expected: FAIL — 404 en todas las peticiones (`/api/auth/*` no existe todavía).

- [ ] **Step 3: Crear `apps/backend/src/routes/auth.ts`**

```ts
import { Router } from 'express';
import { z } from 'zod';
import type { AppServices } from '../services/appServices';

const registerSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es un campo obligatorio.'),
  apellido: z.string().trim().min(1, 'El apellido es un campo obligatorio.'),
  email: z.string().trim().email('El correo electrónico no es válido.'),
  telefono: z.string().trim().optional(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
});

const loginSchema = z.object({
  email: z.string().trim().min(1, 'El correo es obligatorio.'),
  password: z.string().min(1, 'La contraseña es obligatoria.'),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email('El correo electrónico no es válido.'),
});

const resetPasswordSchema = z.object({
  accessToken: z.string().min(1, 'El enlace no es válido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
});

export function createAuthRouter(services: AppServices) {
  const router = Router();

  router.post('/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const result = await services.auth.register(parsed.data);
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.message });
      return;
    }

    res.status(201).json({ message: 'Cuenta creada exitosamente. Bienvenido a MedTrack.' });
  });

  router.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const result = await services.auth.login(parsed.data.email, parsed.data.password);
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.message });
      return;
    }

    res.status(200).json({ token: result.value.token, usuario: result.value.usuario });
  });

  router.post('/forgot-password', async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    await services.auth.forgotPassword(parsed.data.email);
    res.status(200).json({ message: 'Si el correo existe, recibirás un enlace de recuperación.' });
  });

  router.post('/reset-password', async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const result = await services.auth.resetPassword(parsed.data.accessToken, parsed.data.password);
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.message });
      return;
    }

    res.status(200).json({ message: 'Contraseña actualizada correctamente.' });
  });

  return router;
}
```

- [ ] **Step 4: Montar el router — modificar `apps/backend/src/routes/index.ts`**

```ts
import { Router } from 'express';
import type { AppServices } from '../services/appServices';
import { createAuthRouter } from './auth';
import { healthRouter } from './health';

export function apiRouter(services: AppServices) {
  const router = Router();
  router.use(healthRouter);
  router.use('/api/auth', createAuthRouter(services));
  return router;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test --workspace=apps/backend -- auth`
Expected: PASS — los 6 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/backend/src/routes/auth.ts apps/backend/src/routes/index.ts apps/backend/tests/auth.test.ts
git commit -m "feat(HU-01,HU-02): registro y login via Express, hablando con Supabase Auth por detras"
```

---

### Task 5: HU-03 — recuperar contraseña en Express

**Files:**
- Modify: `apps/backend/tests/auth.test.ts`

**Interfaces:** ninguna nueva — `forgot-password` y `reset-password` ya quedaron
implementados en la Tarea 4 (mismo router). Esta tarea solo agrega la cobertura de
tests que faltaba para HU-03.

- [ ] **Step 1: Agregar los tests que faltan a `apps/backend/tests/auth.test.ts`**

Agregar al final del archivo (mismo `describe` level, después del bloque de `POST /api/auth/login`):

```ts
describe('POST /api/auth/forgot-password', () => {
  it('HU-03 responde igual exista o no el correo', async () => {
    const response = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'no-existe@medtrack.test' });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Si el correo existe, recibirás un enlace de recuperación.');
  });
});

describe('POST /api/auth/reset-password', () => {
  it('HU-03 rechaza un token invalido', async () => {
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({ accessToken: 'token-invalido', password: 'Nueva1234' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Este enlace ha expirado. Por favor solicita uno nuevo.');
  });

  it('HU-03 permite crear una nueva contrasena con un token valido', async () => {
    await services.auth.register({
      nombre: 'Ana',
      apellido: 'Mora',
      email: 'ana@medtrack.test',
      password: 'Segura123',
    });
    const login = await services.auth.login('ana@medtrack.test', 'Segura123');
    if (!login.ok) throw new Error('setup failed');

    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({ accessToken: login.value.token, password: 'Nueva1234' });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Contraseña actualizada correctamente.');

    const relogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@medtrack.test', password: 'Nueva1234' });
    expect(relogin.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm run test --workspace=apps/backend -- auth`
Expected: PASS — 9 tests en total en este archivo.

- [ ] **Step 3: Commit**

```bash
git add apps/backend/tests/auth.test.ts
git commit -m "test(HU-03): cobertura de recuperar contrasena via Express"
```

---

### Task 6: HU-04 — especialidades y médicos en Express

**Files:**
- Create: `apps/backend/src/routes/especialidades.ts`
- Create: `apps/backend/src/routes/medicos.ts`
- Modify: `apps/backend/src/routes/index.ts`
- Test: `apps/backend/tests/medicos.test.ts`

**Interfaces:**
- Consumes: `AppServices.especialidades`, `AppServices.medicos`, `requireAuth`,
  `requireRole` (Tareas 1 y 2).
- Produces: `createEspecialidadesRouter(services)`, `createMedicosRouter(services)`,
  montados en `/api/especialidades` y `/api/medicos`.

- [ ] **Step 1: Write the failing tests — `apps/backend/tests/medicos.test.ts`**

```ts
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createInMemoryServices } from './helpers/inMemoryServices';
import type { AppServices } from '../src/services/appServices';

let services: AppServices;
let app: ReturnType<typeof createApp>;
let adminToken: string;
let pacienteToken: string;

beforeEach(async () => {
  services = createInMemoryServices();
  app = createApp(services);

  await services.auth.register({ nombre: 'Admin', apellido: 'QA', email: 'admin@medtrack.test', password: 'Admin1234' });
  const adminUser = await services.auth.getUserFromToken(
    (await services.auth.login('admin@medtrack.test', 'Admin1234') as { ok: true; value: { token: string } }).value.token
  );
  // Promover a ADMIN directamente en el fake (en produccion esto se hace a mano en Supabase)
  const asAny = services as unknown as { auth: { getRole: (id: string) => Promise<string | null> } };
  void asAny;
  const loginAdmin = await services.auth.login('admin@medtrack.test', 'Admin1234');
  if (loginAdmin.ok) adminToken = loginAdmin.value.token;

  await services.auth.register({ nombre: 'Paciente', apellido: 'Uno', email: 'paciente@medtrack.test', password: 'Paciente1' });
  const loginPaciente = await services.auth.login('paciente@medtrack.test', 'Paciente1');
  if (loginPaciente.ok) pacienteToken = loginPaciente.value.token;
  void adminUser;
});

describe('GET /api/especialidades', () => {
  it('HU-04 requiere autenticacion', async () => {
    const response = await request(app).get('/api/especialidades');
    expect(response.status).toBe(401);
  });

  it('HU-04 lista especialidades para cualquier usuario autenticado', async () => {
    const response = await request(app)
      .get('/api/especialidades')
      .set('Authorization', `Bearer ${pacienteToken}`);

    expect(response.status).toBe(200);
    expect(response.body.especialidades.length).toBeGreaterThan(0);
  });
});

describe('POST /api/medicos', () => {
  it('HU-04 registra un medico con especialidad cuando el usuario es ADMIN', async () => {
    const especialidades = await services.especialidades.list();
    // El fake registra a todo usuario nuevo como PACIENTE; para probar el camino ADMIN
    // hay que forzarlo mediante el propio servicio (no hay endpoint de "hacerse admin").
    const rawUsers = (services.auth as unknown as { getRole: (id: string) => Promise<string | null> });
    void rawUsers;

    const response = await request(app)
      .post('/api/medicos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombre: 'Elena',
        apellido: 'Campos',
        email: 'elena@medtrack.test',
        licencia: 'MED-123',
        especialidadId: especialidades[0].id,
      });

    // Sin promocion a ADMIN, esto debe dar 403 -- ver Step 3 para el ajuste del fake.
    expect([201, 403]).toContain(response.status);
  });

  it('HU-04 rechaza el registro si el usuario no es ADMIN', async () => {
    const especialidades = await services.especialidades.list();
    const response = await request(app)
      .post('/api/medicos')
      .set('Authorization', `Bearer ${pacienteToken}`)
      .send({
        nombre: 'Elena',
        apellido: 'Campos',
        email: 'elena@medtrack.test',
        licencia: 'MED-123',
        especialidadId: especialidades[0].id,
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('No tienes permisos para acceder a esta sección.');
  });
});
```

**Antes de seguir:** el `createInMemoryServices()` de la Tarea 1 no tiene forma de
promover un usuario a ADMIN (a propósito — en producción eso se hace a mano en Supabase,
según `supabase/README.md`). Para poder probar el camino "ADMIN registra médico" en el
fake, hay que agregar una puerta de escape solo para tests.

- [ ] **Step 2: Agregar `promoteToAdmin` al fake — modificar `apps/backend/src/repositories/inMemoryRepositories.ts`**

Agregar, justo antes del `return { auth, ... }` final:

```ts
  const testHelpers = {
    promoteToAdmin(email: string) {
      const user = users.find((u) => u.email === email);
      if (user) user.rol = 'ADMIN';
    },
  };
```

Y cambiar la firma exportada de la función para exponerlo:

```ts
export function createInMemoryServices() {
  // ... (todo el contenido existente sin cambios)
  return {
    auth,
    especialidades: especialidadesService,
    medicos: medicosService,
    horarios: horariosService,
    testHelpers,
  };
}
```

- [ ] **Step 3: Ajustar el test para usar `testHelpers.promoteToAdmin`**

Reemplazar el `beforeEach` de `apps/backend/tests/medicos.test.ts` completo por:

```ts
beforeEach(async () => {
  const inMemory = createInMemoryServices();
  services = inMemory;
  app = createApp(services);

  await services.auth.register({ nombre: 'Admin', apellido: 'QA', email: 'admin@medtrack.test', password: 'Admin1234' });
  inMemory.testHelpers.promoteToAdmin('admin@medtrack.test');
  const loginAdmin = await services.auth.login('admin@medtrack.test', 'Admin1234');
  if (loginAdmin.ok) adminToken = loginAdmin.value.token;

  await services.auth.register({ nombre: 'Paciente', apellido: 'Uno', email: 'paciente@medtrack.test', password: 'Paciente1' });
  const loginPaciente = await services.auth.login('paciente@medtrack.test', 'Paciente1');
  if (loginPaciente.ok) pacienteToken = loginPaciente.value.token;
});
```

Y en el primer test de `POST /api/medicos`, cambiar la aserción final por:

```ts
    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Médico registrado correctamente.');
```

(borrar las líneas de `rawUsers`/`asAny` que quedaron como exploración — no aportan nada al test final).

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm run test --workspace=apps/backend -- medicos`
Expected: FAIL — 404 (no existen `/api/especialidades` ni `/api/medicos` todavía).

- [ ] **Step 5: Crear `apps/backend/src/routes/especialidades.ts`**

```ts
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import type { AppServices } from '../services/appServices';

export function createEspecialidadesRouter(services: AppServices) {
  const router = Router();

  router.get('/', requireAuth(services), async (_req, res) => {
    const especialidades = await services.especialidades.list();
    res.status(200).json({ especialidades });
  });

  return router;
}
```

- [ ] **Step 6: Crear `apps/backend/src/routes/medicos.ts`**

```ts
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middlewares/auth';
import type { AppServices } from '../services/appServices';

const createMedicoSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es un campo obligatorio.'),
  apellido: z.string().trim().min(1, 'El apellido es un campo obligatorio.'),
  email: z.string().trim().email('El correo electrónico no es válido.'),
  telefono: z.string().trim().optional(),
  licencia: z.string().trim().min(1, 'La licencia es un campo obligatorio.'),
  especialidadId: z.string().trim().min(1, 'La especialidad es obligatoria.'),
});

export function createMedicosRouter(services: AppServices) {
  const router = Router();

  router.get('/', requireAuth(services), async (_req, res) => {
    const medicos = await services.medicos.list();
    res.status(200).json({ medicos });
  });

  router.post('/', requireAuth(services), requireRole(services, 'ADMIN'), async (req, res) => {
    const parsed = createMedicoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const result = await services.medicos.create(parsed.data);
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.message });
      return;
    }

    res.status(201).json({ message: 'Médico registrado correctamente.', medico: result.value });
  });

  return router;
}
```

- [ ] **Step 7: Montar ambos routers — modificar `apps/backend/src/routes/index.ts`**

```ts
import { Router } from 'express';
import type { AppServices } from '../services/appServices';
import { createAuthRouter } from './auth';
import { createEspecialidadesRouter } from './especialidades';
import { createMedicosRouter } from './medicos';
import { healthRouter } from './health';

export function apiRouter(services: AppServices) {
  const router = Router();
  router.use(healthRouter);
  router.use('/api/auth', createAuthRouter(services));
  router.use('/api/especialidades', createEspecialidadesRouter(services));
  router.use('/api/medicos', createMedicosRouter(services));
  return router;
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm run test --workspace=apps/backend -- medicos`
Expected: PASS — 4 tests.

- [ ] **Step 9: Commit**

```bash
git add apps/backend/src/repositories/inMemoryRepositories.ts apps/backend/src/routes apps/backend/tests/medicos.test.ts
git commit -m "feat(HU-04): especialidades y registro de medicos via Express"
```

---

### Task 7: Migración SQL de Épica 2 (`horarios` + visibilidad + Realtime)

**Files:**
- Create: `supabase/migrations/0005_horarios_y_visibilidad.sql`
- Modify: `supabase/README.md`

**Interfaces:** ninguna — es SQL que el usuario aplica a mano.

- [ ] **Step 1: Crear `supabase/migrations/0005_horarios_y_visibilidad.sql`**

```sql
create table if not exists public.horarios (
  id uuid primary key default gen_random_uuid(),
  medico_id uuid not null references public.medicos (id) on delete cascade,
  dia_semana text not null check (dia_semana in ('LUN','MAR','MIE','JUE','VIE','SAB','DOM')),
  hora_inicio time not null,
  hora_fin time not null,
  created_at timestamptz not null default now(),
  constraint horario_rango_valido check (hora_fin > hora_inicio)
);

alter table public.horarios enable row level security;

create policy "autenticados leen horarios"
  on public.horarios for select
  to authenticated
  using (true);

create policy "admins crean horarios"
  on public.horarios for insert
  to authenticated
  with check (
    exists (select 1 from public.perfiles where id = auth.uid() and rol = 'ADMIN')
  );

create policy "admins editan horarios"
  on public.horarios for update
  to authenticated
  using (
    exists (select 1 from public.perfiles where id = auth.uid() and rol = 'ADMIN')
  );

create policy "admins eliminan horarios"
  on public.horarios for delete
  to authenticated
  using (
    exists (select 1 from public.perfiles where id = auth.uid() and rol = 'ADMIN')
  );

drop policy if exists "admins leen especialidades" on public.especialidades;
create policy "autenticados leen especialidades"
  on public.especialidades for select
  to authenticated
  using (true);

drop policy if exists "admins leen medicos" on public.medicos;
create policy "autenticados leen medicos"
  on public.medicos for select
  to authenticated
  using (true);

alter publication supabase_realtime add table public.horarios;
```

- [ ] **Step 2: Agregar el archivo a la lista de `supabase/README.md`**

Modificar la lista numerada para que quede:

```markdown
1. `migrations/0001_perfiles.sql`
2. `migrations/0002_especialidades.sql`
3. `migrations/0003_medicos.sql`
4. `migrations/0004_login_attempts.sql`
5. `migrations/0005_horarios_y_visibilidad.sql`
```

- [ ] **Step 3: Commit**

```bash
git add supabase
git commit -m "feat: add horarios table, broaden read policies, enable Realtime (Epica 2)"
```

---

### Task 8: HU-05 — CRUD de horarios en Express

**Files:**
- Create: `apps/backend/src/routes/horarios.ts`
- Modify: `apps/backend/src/routes/index.ts`
- Test: `apps/backend/tests/horarios.test.ts`

**Interfaces:**
- Consumes: `AppServices.horarios`, `requireAuth`, `requireRole` (Tareas 1, 2).
- Produces: `createHorariosRouter(services)`, montado en `/api/horarios`.

- [ ] **Step 1: Write the failing tests — `apps/backend/tests/horarios.test.ts`**

```ts
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createInMemoryServices } from './helpers/inMemoryServices';

let services: ReturnType<typeof createInMemoryServices>;
let app: ReturnType<typeof createApp>;
let adminToken: string;
let pacienteToken: string;
let medicoId: string;

beforeEach(async () => {
  services = createInMemoryServices();
  app = createApp(services);

  await services.auth.register({ nombre: 'Admin', apellido: 'QA', email: 'admin@medtrack.test', password: 'Admin1234' });
  services.testHelpers.promoteToAdmin('admin@medtrack.test');
  const loginAdmin = await services.auth.login('admin@medtrack.test', 'Admin1234');
  if (loginAdmin.ok) adminToken = loginAdmin.value.token;

  await services.auth.register({ nombre: 'Paciente', apellido: 'Uno', email: 'paciente@medtrack.test', password: 'Paciente1' });
  const loginPaciente = await services.auth.login('paciente@medtrack.test', 'Paciente1');
  if (loginPaciente.ok) pacienteToken = loginPaciente.value.token;

  const especialidades = await services.especialidades.list();
  const medico = await services.medicos.create({
    nombre: 'Dr',
    apellido: 'Lopez',
    email: 'lopez@medtrack.test',
    licencia: 'MED-1',
    especialidadId: especialidades[0].id,
  });
  if (medico.ok) medicoId = medico.value.id;
});

describe('POST /api/horarios', () => {
  it('HU-05 crea un horario cuando el usuario es ADMIN', async () => {
    const response = await request(app)
      .post('/api/horarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ medicoId, diaSemana: 'LUN', horaInicio: '08:00', horaFin: '12:00' });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Horario creado correctamente.');
  });

  it('HU-05 rechaza si la hora de fin no es posterior a la de inicio', async () => {
    const response = await request(app)
      .post('/api/horarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ medicoId, diaSemana: 'LUN', horaInicio: '12:00', horaFin: '08:00' });

    expect(response.status).toBe(400);
  });

  it('HU-05 rechaza si el usuario no es ADMIN', async () => {
    const response = await request(app)
      .post('/api/horarios')
      .set('Authorization', `Bearer ${pacienteToken}`)
      .send({ medicoId, diaSemana: 'LUN', horaInicio: '08:00', horaFin: '12:00' });

    expect(response.status).toBe(403);
  });
});

describe('PUT y DELETE /api/horarios/:id', () => {
  it('HU-05 edita un horario existente', async () => {
    const created = await request(app)
      .post('/api/horarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ medicoId, diaSemana: 'LUN', horaInicio: '08:00', horaFin: '12:00' });

    const response = await request(app)
      .put(`/api/horarios/${created.body.horario.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ medicoId, diaSemana: 'LUN', horaInicio: '09:00', horaFin: '13:00' });

    expect(response.status).toBe(200);
    expect(response.body.horario.horaInicio).toBe('09:00');
  });

  it('HU-05 elimina un horario existente', async () => {
    const created = await request(app)
      .post('/api/horarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ medicoId, diaSemana: 'LUN', horaInicio: '08:00', horaFin: '12:00' });

    const response = await request(app)
      .delete(`/api/horarios/${created.body.horario.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);

    const list = await request(app)
      .get(`/api/horarios?medicoId=${medicoId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.body.horarios).toHaveLength(0);
  });
});

describe('GET /api/horarios', () => {
  it('HU-06 filtra por especialidad', async () => {
    await request(app)
      .post('/api/horarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ medicoId, diaSemana: 'MAR', horaInicio: '08:00', horaFin: '12:00' });

    const especialidades = await services.especialidades.list();
    const response = await request(app)
      .get(`/api/horarios?especialidadId=${especialidades[0].id}`)
      .set('Authorization', `Bearer ${pacienteToken}`);

    expect(response.status).toBe(200);
    expect(response.body.horarios).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test --workspace=apps/backend -- horarios`
Expected: FAIL — 404 (no existe `/api/horarios` todavía).

- [ ] **Step 3: Crear `apps/backend/src/routes/horarios.ts`**

```ts
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middlewares/auth';
import type { AppServices } from '../services/appServices';

const horarioSchema = z.object({
  medicoId: z.string().trim().min(1, 'El médico es obligatorio.'),
  diaSemana: z.enum(['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM']),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/, 'La hora de inicio no es válida.'),
  horaFin: z.string().regex(/^\d{2}:\d{2}$/, 'La hora de fin no es válida.'),
});

export function createHorariosRouter(services: AppServices) {
  const router = Router();

  router.get('/', requireAuth(services), async (req, res) => {
    const medicoId = typeof req.query.medicoId === 'string' ? req.query.medicoId : undefined;
    const especialidadId = typeof req.query.especialidadId === 'string' ? req.query.especialidadId : undefined;
    const horarios = await services.horarios.list({ medicoId, especialidadId });
    res.status(200).json({ horarios });
  });

  router.post('/', requireAuth(services), requireRole(services, 'ADMIN'), async (req, res) => {
    const parsed = horarioSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const result = await services.horarios.create(parsed.data);
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.message });
      return;
    }

    res.status(201).json({ message: 'Horario creado correctamente.', horario: result.value });
  });

  router.put('/:id', requireAuth(services), requireRole(services, 'ADMIN'), async (req, res) => {
    const parsed = horarioSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const result = await services.horarios.update(req.params.id, parsed.data);
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.message });
      return;
    }

    res.status(200).json({ message: 'Horario actualizado correctamente.', horario: result.value });
  });

  router.delete('/:id', requireAuth(services), requireRole(services, 'ADMIN'), async (req, res) => {
    const result = await services.horarios.remove(req.params.id);
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.message });
      return;
    }

    res.status(200).json({ message: 'Horario eliminado correctamente.' });
  });

  return router;
}
```

- [ ] **Step 4: Montar el router — modificar `apps/backend/src/routes/index.ts`**

```ts
import { Router } from 'express';
import type { AppServices } from '../services/appServices';
import { createAuthRouter } from './auth';
import { createEspecialidadesRouter } from './especialidades';
import { createHorariosRouter } from './horarios';
import { createMedicosRouter } from './medicos';
import { healthRouter } from './health';

export function apiRouter(services: AppServices) {
  const router = Router();
  router.use(healthRouter);
  router.use('/api/auth', createAuthRouter(services));
  router.use('/api/especialidades', createEspecialidadesRouter(services));
  router.use('/api/medicos', createMedicosRouter(services));
  router.use('/api/horarios', createHorariosRouter(services));
  return router;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test --workspace=apps/backend -- horarios`
Expected: PASS — 6 tests.

- [ ] **Step 6: Run the full backend suite**

Run: `npm run test --workspace=apps/backend`
Expected: todos los archivos (`health`, `inMemoryServices`, `auth`, `medicos`, `horarios`) en verde.

- [ ] **Step 7: Commit**

```bash
git add apps/backend/src/routes apps/backend/tests/horarios.test.ts
git commit -m "feat(HU-05,HU-06): CRUD de horarios y filtro por especialidad via Express"
```

---

### Task 9: Frontend — `lib/api.ts`, `AuthContext` sobre Express, `lib/nav.ts`

**Files:**
- Create: `apps/frontend/src/lib/api.ts`
- Modify: `apps/frontend/src/context/AuthContext.tsx`
- Create: `apps/frontend/src/lib/nav.ts`
- Modify: `apps/frontend/tests/AuthContext.test.tsx`

**Interfaces:**
- Produces: `apiRequest<T>(path, options)`, `saveSession`, `getSession`, `clearSession`,
  `SessionUser` desde `lib/api.ts`. `useAuth()` sigue exponiendo
  `{ user, loading, login, logout }` (se agrega `login` al contrato, que antes no
  existía). `adminNavItems`, `patientNavItems` desde `lib/nav.ts`.

- [ ] **Step 1: Crear `apps/frontend/src/lib/api.ts`**

```ts
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string | null;
}

export async function apiRequest<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error ?? 'No se pudo completar la solicitud.');
  }

  return data as T;
}

export interface SessionUser {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: 'PACIENTE' | 'ADMIN';
}

export function saveSession(token: string, user: SessionUser): void {
  localStorage.setItem('medtrack.token', token);
  localStorage.setItem('medtrack.user', JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem('medtrack.token');
  localStorage.removeItem('medtrack.user');
}

export function getSession(): { token: string | null; user: SessionUser | null } {
  const token = localStorage.getItem('medtrack.token');
  const rawUser = localStorage.getItem('medtrack.user');
  return {
    token,
    user: rawUser ? (JSON.parse(rawUser) as SessionUser) : null,
  };
}
```

- [ ] **Step 2: Crear `apps/frontend/src/lib/nav.ts`**

```ts
export interface NavItem {
  label: string;
  to: string;
}

export const adminNavItems: NavItem[] = [
  { label: 'Panel', to: '/admin/dashboard' },
  { label: 'Medicos', to: '/admin/doctors' },
  { label: 'Horarios', to: '/admin/schedules' },
  { label: 'Especialidades', to: '/admin/specialties' },
  { label: 'Reportes', to: '/admin/reports' },
];

export const patientNavItems: NavItem[] = [
  { label: 'Panel', to: '/patient/dashboard' },
  { label: 'Disponibilidad', to: '/patient/availability' },
  { label: 'Mis citas', to: '/patient/appointments' },
];
```

- [ ] **Step 3: Write the failing test — actualizar `apps/frontend/tests/AuthContext.test.tsx`**

Reemplazar el archivo completo:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear();
});

import { AuthProvider, useAuth } from '../src/context/AuthContext';

function Probe() {
  const { user, loading } = useAuth();
  if (loading) return <p>cargando</p>;
  return <p>{user ? `${user.nombre} (${user.rol})` : 'sin sesion'}</p>;
}

describe('AuthContext', () => {
  it('expone user en null cuando no hay sesion guardada', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText('sin sesion')).toBeInTheDocument());
  });

  it('lee la sesion guardada en localStorage al montar', async () => {
    localStorage.setItem('medtrack.token', 'token-1');
    localStorage.setItem(
      'medtrack.user',
      JSON.stringify({ id: 'user-1', email: 'ana@medtrack.test', nombre: 'Ana', apellido: 'Mora', rol: 'PACIENTE' })
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText('Ana (PACIENTE)')).toBeInTheDocument());
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm run test --workspace=apps/frontend -- AuthContext`
Expected: FAIL — `AuthContext` todavía depende de `supabaseClient`, no de `localStorage` directo.

- [ ] **Step 5: Reescribir `apps/frontend/src/context/AuthContext.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { apiRequest, clearSession, getSession, saveSession, type SessionUser } from '../lib/api';

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { user: storedUser } = getSession();
    setUser(storedUser);
    setLoading(false);
  }, []);

  async function login(email: string, password: string) {
    const response = await apiRequest<{ token: string; usuario: SessionUser }>('/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    saveSession(response.token, response.usuario);
    setUser(response.usuario);
  }

  function logout() {
    clearSession();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run test --workspace=apps/frontend -- AuthContext`
Expected: PASS — los 2 tests.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/lib/api.ts apps/frontend/src/lib/nav.ts apps/frontend/src/context/AuthContext.tsx apps/frontend/tests/AuthContext.test.tsx
git commit -m "feat: AuthContext y lib/api.ts hablando con Express en vez de Supabase directo"
```

---

### Task 10: Frontend — páginas de autenticación (HU-01/02/03) sobre Express

**Files:**
- Modify: `apps/frontend/src/pages/auth/RegisterPage.tsx`
- Modify: `apps/frontend/src/pages/auth/LoginPage.tsx`
- Modify: `apps/frontend/src/pages/auth/ForgotPasswordPage.tsx`
- Modify: `apps/frontend/src/pages/auth/ResetPasswordPage.tsx`
- Modify: `apps/frontend/tests/RegisterPage.test.tsx`
- Modify: `apps/frontend/tests/LoginPage.test.tsx`
- Modify: `apps/frontend/tests/ForgotPasswordPage.test.tsx`
- Modify: `apps/frontend/tests/ResetPasswordPage.test.tsx`

**Interfaces:**
- Consumes: `apiRequest`, `SessionUser` (Tarea 9, `lib/api.ts`); `useAuth().login`
  (Tarea 9, `AuthContext`).

- [ ] **Step 1: Write the failing tests — reemplazar `apps/frontend/tests/RegisterPage.test.tsx`**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

import { RegisterPage } from '../src/pages/auth/RegisterPage';

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  fetchMock.mockResolvedValueOnce({ ok, status, json: async () => body });
}

function fillForm(overrides: Record<string, string> = {}) {
  const values = { nombre: 'Ana', apellido: 'Mora', email: 'ana@medtrack.test', password: 'Segura123', ...overrides };
  if (values.nombre) fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: values.nombre } });
  fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: values.apellido } });
  fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: values.email } });
  fireEvent.change(screen.getByLabelText('Contrasena'), { target: { value: values.password } });
}

describe('RegisterPage', () => {
  it('HU-01 muestra confirmacion cuando el registro es exitoso', async () => {
    mockJsonResponse({ message: 'Cuenta creada exitosamente. Bienvenido a MedTrack.' }, true, 201);
    render(<RegisterPage />, { wrapper: BrowserRouter });

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Registrarme' }));

    expect(await screen.findByText('Cuenta creada exitosamente. Bienvenido a MedTrack.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/register'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('HU-01 muestra error de correo duplicado', async () => {
    mockJsonResponse(
      { error: 'Este correo ya está registrado. Por favor inicia sesión o usa otro correo.' },
      false,
      409
    );
    render(<RegisterPage />, { wrapper: BrowserRouter });

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Registrarme' }));

    expect(
      await screen.findByText('Este correo ya está registrado. Por favor inicia sesión o usa otro correo.')
    ).toBeInTheDocument();
  });

  it('HU-01 muestra el error de nombre obligatorio que devuelve el backend', async () => {
    mockJsonResponse({ error: 'El nombre es un campo obligatorio.' }, false, 400);
    render(<RegisterPage />, { wrapper: BrowserRouter });

    fillForm({ nombre: '' });
    fireEvent.click(screen.getByRole('button', { name: 'Registrarme' }));

    expect(await screen.findByText('El nombre es un campo obligatorio.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Reemplazar `apps/frontend/tests/LoginPage.test.tsx`**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear();
});

import { AuthProvider } from '../src/context/AuthContext';
import { LoginPage } from '../src/pages/auth/LoginPage';

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  fetchMock.mockResolvedValueOnce({ ok, status, json: async () => body });
}

function renderLogin() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

function fillAndSubmit(email = 'ana@medtrack.test', password = 'Segura123') {
  fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Contrasena'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
}

describe('LoginPage', () => {
  it('HU-02 autentica con credenciales validas', async () => {
    mockJsonResponse({
      token: 'token-1',
      usuario: { id: 'user-1', email: 'ana@medtrack.test', nombre: 'Ana', apellido: 'Mora', rol: 'PACIENTE' },
    });
    renderLogin();
    fillAndSubmit();

    expect(await screen.findByText(/inicio de sesion exitoso/i)).toBeInTheDocument();
  });

  it('HU-02 rechaza credenciales incorrectas mostrando el mensaje del backend', async () => {
    mockJsonResponse({ error: 'Correo o contraseña incorrectos. Intento 2 de 5.' }, false, 401);
    renderLogin();
    fillAndSubmit();

    expect(await screen.findByText('Correo o contraseña incorrectos. Intento 2 de 5.')).toBeInTheDocument();
  });

  it('HU-02 muestra el mensaje de bloqueo que devuelve el backend', async () => {
    mockJsonResponse({ error: 'Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.' }, false, 403);
    renderLogin();
    fillAndSubmit();

    expect(
      await screen.findByText('Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.')
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Reemplazar `apps/frontend/tests/ForgotPasswordPage.test.tsx`**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
});

import { ForgotPasswordPage } from '../src/pages/auth/ForgotPasswordPage';

describe('ForgotPasswordPage', () => {
  it('HU-03 envia la solicitud y muestra el mensaje generico', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ message: 'Si el correo existe, recibirás un enlace de recuperación.' }),
    });
    render(<ForgotPasswordPage />, { wrapper: BrowserRouter });

    fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: 'ana@medtrack.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));

    expect(
      await screen.findByText('Si el correo existe, recibirás un enlace de recuperación.')
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/forgot-password'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});
```

- [ ] **Step 4: Reemplazar `apps/frontend/tests/ResetPasswordPage.test.tsx`**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  window.location.hash = '#access_token=abc123&type=recovery';
});

import { ResetPasswordPage } from '../src/pages/auth/ResetPasswordPage';

describe('ResetPasswordPage', () => {
  it('HU-03 muestra error cuando el backend rechaza el token', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Este enlace ha expirado. Por favor solicita uno nuevo.' }),
    });
    render(<ResetPasswordPage />, { wrapper: BrowserRouter });

    fireEvent.change(screen.getByLabelText('Nueva contrasena'), { target: { value: 'Nueva1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contrasena' }));

    expect(await screen.findByText('Este enlace ha expirado. Por favor solicita uno nuevo.')).toBeInTheDocument();
  });

  it('HU-03 permite crear una nueva contrasena y manda el access_token del fragmento de la URL', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ message: 'Contraseña actualizada correctamente.' }),
    });
    render(<ResetPasswordPage />, { wrapper: BrowserRouter });

    fireEvent.change(screen.getByLabelText('Nueva contrasena'), { target: { value: 'Nueva1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contrasena' }));

    expect(await screen.findByText('Contraseña actualizada correctamente.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/reset-password'),
      expect.objectContaining({ body: JSON.stringify({ accessToken: 'abc123', password: 'Nueva1234' }) })
    );
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `npm run test --workspace=apps/frontend -- RegisterPage LoginPage ForgotPasswordPage ResetPasswordPage`
Expected: FAIL — las 4 páginas todavía usan `supabase.*`.

- [ ] **Step 6: Reescribir `apps/frontend/src/pages/auth/RegisterPage.tsx`**

```tsx
import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../../components/AuthLayout';
import { FormField } from '../../components/FormField';
import { StatusMessage } from '../../components/StatusMessage';
import { apiRequest } from '../../lib/api';

export function RegisterPage() {
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setStatus(null);
    const form = new FormData(formElement);

    try {
      const response = await apiRequest<{ message: string }>('/api/auth/register', {
        method: 'POST',
        body: {
          nombre: form.get('nombre'),
          apellido: form.get('apellido'),
          email: form.get('email'),
          telefono: form.get('telefono'),
          password: form.get('password'),
        },
      });
      formElement.reset();
      setStatus({ tone: 'success', message: response.message });
    } catch (error) {
      setStatus({ tone: 'error', message: (error as Error).message });
    }
  }

  return (
    <AuthLayout title="Registro de paciente" subtitle="Cree su cuenta para solicitar citas medicas.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormField id="nombre" name="nombre" label="Nombre" />
        <FormField id="apellido" name="apellido" label="Apellido" required />
        <FormField id="email" name="email" type="email" label="Correo electronico" required />
        <FormField id="telefono" name="telefono" label="Telefono" />
        <FormField id="password" name="password" type="password" label="Contrasena" required minLength={8} />
        {status ? <StatusMessage tone={status.tone} message={status.message} /> : null}
        <button className="w-full rounded-md bg-teal-700 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-800">
          Registrarme
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        Ya tiene cuenta?{' '}
        <Link className="font-semibold text-teal-700 hover:text-teal-900" to="/login">
          Iniciar sesion
        </Link>
      </p>
    </AuthLayout>
  );
}
```

- [ ] **Step 7: Reescribir `apps/frontend/src/pages/auth/LoginPage.tsx`**

```tsx
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/AuthLayout';
import { FormField } from '../../components/FormField';
import { StatusMessage } from '../../components/StatusMessage';
import { useAuth } from '../../context/AuthContext';
import { getSession } from '../../lib/api';

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const form = new FormData(event.currentTarget);

    try {
      await login(String(form.get('email') ?? ''), String(form.get('password') ?? ''));
      setStatus({ tone: 'success', message: 'Inicio de sesion exitoso.' });
      const { user } = getSession();
      navigate(user?.rol === 'ADMIN' ? '/admin/dashboard' : '/patient/dashboard');
    } catch (error) {
      setStatus({ tone: 'error', message: (error as Error).message });
    }
  }

  return (
    <AuthLayout title="Inicio de sesion" subtitle="Ingrese con sus credenciales de MedTrack.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormField id="email" name="email" type="email" label="Correo electronico" required />
        <FormField id="password" name="password" type="password" label="Contrasena" required />
        {status ? <StatusMessage tone={status.tone} message={status.message} /> : null}
        <button className="w-full rounded-md bg-teal-700 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-800">
          Ingresar
        </button>
      </form>
      <div className="mt-5 flex flex-col gap-3 text-sm sm:flex-row sm:justify-between">
        <Link className="font-semibold text-teal-700 hover:text-teal-900" to="/register">
          Crear cuenta
        </Link>
        <Link className="font-semibold text-teal-700 hover:text-teal-900" to="/forgot-password">
          Recuperar contrasena
        </Link>
      </div>
    </AuthLayout>
  );
}
```

- [ ] **Step 8: Reescribir `apps/frontend/src/pages/auth/ForgotPasswordPage.tsx`**

```tsx
import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../../components/AuthLayout';
import { FormField } from '../../components/FormField';
import { StatusMessage } from '../../components/StatusMessage';
import { apiRequest } from '../../lib/api';

export function ForgotPasswordPage() {
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const form = new FormData(event.currentTarget);

    try {
      const response = await apiRequest<{ message: string }>('/api/auth/forgot-password', {
        method: 'POST',
        body: { email: form.get('email') },
      });
      setStatus({ tone: 'success', message: response.message });
    } catch (error) {
      setStatus({ tone: 'error', message: (error as Error).message });
    }
  }

  return (
    <AuthLayout title="Recuperar contrasena" subtitle="Le enviaremos un enlace temporal al correo registrado.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormField id="email" name="email" type="email" label="Correo electronico" required />
        {status ? <StatusMessage tone={status.tone} message={status.message} /> : null}
        <button className="w-full rounded-md bg-teal-700 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-800">
          Enviar enlace
        </button>
      </form>
      <Link className="mt-5 inline-block text-sm font-semibold text-teal-700 hover:text-teal-900" to="/login">
        Volver al login
      </Link>
    </AuthLayout>
  );
}
```

- [ ] **Step 9: Reescribir `apps/frontend/src/pages/auth/ResetPasswordPage.tsx`**

```tsx
import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../../components/AuthLayout';
import { FormField } from '../../components/FormField';
import { StatusMessage } from '../../components/StatusMessage';
import { apiRequest } from '../../lib/api';

function getAccessTokenFromHash(): string {
  const params = new URLSearchParams(window.location.hash.replace('#', ''));
  return params.get('access_token') ?? '';
}

export function ResetPasswordPage() {
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const form = new FormData(event.currentTarget);

    try {
      const response = await apiRequest<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: { accessToken: getAccessTokenFromHash(), password: form.get('password') },
      });
      setStatus({ tone: 'success', message: response.message });
    } catch (error) {
      setStatus({ tone: 'error', message: (error as Error).message });
    }
  }

  return (
    <AuthLayout title="Nueva contrasena" subtitle="Defina una contrasena nueva para su cuenta.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormField id="password" name="password" type="password" label="Nueva contrasena" required minLength={8} />
        {status ? <StatusMessage tone={status.tone} message={status.message} /> : null}
        <button className="w-full rounded-md bg-teal-700 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-800">
          Actualizar contrasena
        </button>
      </form>
      <Link className="mt-5 inline-block text-sm font-semibold text-teal-700 hover:text-teal-900" to="/login">
        Volver al login
      </Link>
    </AuthLayout>
  );
}
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `npm run test --workspace=apps/frontend -- RegisterPage LoginPage ForgotPasswordPage ResetPasswordPage`
Expected: PASS — 9 tests en total.

- [ ] **Step 11: Commit**

```bash
git add apps/frontend/src/pages/auth apps/frontend/tests/RegisterPage.test.tsx apps/frontend/tests/LoginPage.test.tsx apps/frontend/tests/ForgotPasswordPage.test.tsx apps/frontend/tests/ResetPasswordPage.test.tsx
git commit -m "feat(HU-01,02,03): paginas de auth hablando con Express en vez de Supabase directo"
```

---

### Task 11: Frontend — `ProtectedRoute`/`AppShell` con nav compartido, `DoctorsPage` sobre Express

**Files:**
- Modify: `apps/frontend/src/routes/ProtectedRoute.tsx`
- Modify: `apps/frontend/src/components/AppShell.tsx`
- Modify: `apps/frontend/src/pages/admin/DoctorsPage.tsx`
- Modify: `apps/frontend/src/pages/admin/AdminDashboardPage.tsx`
- Modify: `apps/frontend/src/pages/admin/ReportsPage.tsx`
- Modify: `apps/frontend/src/pages/admin/SpecialtiesPage.tsx`
- Modify: `apps/frontend/src/pages/patient/PatientDashboardPage.tsx`
- Modify: `apps/frontend/src/pages/patient/AppointmentsPage.tsx`
- Modify: `apps/frontend/tests/DoctorsPage.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` (Tarea 9), `apiRequest`, `getSession` (`lib/api.ts`),
  `adminNavItems`/`patientNavItems` (`lib/nav.ts`, Tarea 9).

- [ ] **Step 1: Actualizar `apps/frontend/src/routes/ProtectedRoute.tsx`**

```tsx
import type { PropsWithChildren } from 'react';
import { Navigate } from 'react-router-dom';
import type { RolUsuario } from '@medtrack/shared';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  allowedRoles?: RolUsuario[];
}

export function ProtectedRoute({ children, allowedRoles }: PropsWithChildren<ProtectedRouteProps>) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles?.length && !allowedRoles.includes(user.rol)) {
    return <Navigate to={user.rol === 'ADMIN' ? '/admin/dashboard' : '/patient/dashboard'} replace />;
  }

  return <>{children}</>;
}
```

(Sin cambios de fondo respecto a la versión anterior — se incluye completo para que
quede consistente con el resto del archivo.)

- [ ] **Step 2: Actualizar `handleLogout` en `apps/frontend/src/components/AppShell.tsx`**

Cambiar el import y el cuerpo de la función (el resto del archivo, incluidos
`StatGrid`/`EmptyState`/`WorkPanel`, no cambia):

```tsx
import { useAuth } from '../context/AuthContext';
```

```tsx
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    navigate('/login');
  }
```

- [ ] **Step 3: Actualizar los imports de nav en las 5 páginas que duplicaban el array**

En `AdminDashboardPage.tsx`, `ReportsPage.tsx`, `SpecialtiesPage.tsx`: borrar la
constante local `adminNav` y agregar:

```tsx
import { adminNavItems } from '../../lib/nav';
```

Reemplazar `navItems={adminNav}` por `navItems={adminNavItems}` en cada uno.

En `PatientDashboardPage.tsx`, `AppointmentsPage.tsx`: borrar la constante local
`patientNav` y agregar:

```tsx
import { patientNavItems } from '../../lib/nav';
```

Reemplazar `navItems={patientNav}` por `navItems={patientNavItems}`.

- [ ] **Step 4: Write the failing tests — reemplazar `apps/frontend/tests/DoctorsPage.test.tsx`**

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  localStorage.setItem('medtrack.token', 'admin-token');
  localStorage.setItem(
    'medtrack.user',
    JSON.stringify({ id: 'admin-1', email: 'admin@medtrack.test', nombre: 'Admin', apellido: 'QA', rol: 'ADMIN' })
  );
});

import { AuthProvider } from '../src/context/AuthContext';
import { DoctorsPage } from '../src/pages/admin/DoctorsPage';

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  fetchMock.mockResolvedValueOnce({ ok, status, json: async () => body });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <DoctorsPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('DoctorsPage', () => {
  it('HU-04 registra un medico con la especialidad seleccionada', async () => {
    mockJsonResponse({ especialidades: [{ id: 'esp-1', nombre: 'Cardiología' }] });
    mockJsonResponse({ message: 'Médico registrado correctamente.' }, true, 201);
    renderPage();

    await waitFor(() => expect(screen.getByText('Cardiología')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Elena' } });
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Campos' } });
    fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: 'elena@medtrack.test' } });
    fireEvent.change(screen.getByLabelText('Numero de licencia'), { target: { value: 'MED-123' } });
    fireEvent.change(screen.getByLabelText('Especialidad'), { target: { value: 'esp-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar medico' }));

    expect(await screen.findByText('Médico registrado correctamente.')).toBeInTheDocument();
  });

  it('HU-04 muestra el error de licencia duplicada que devuelve el backend', async () => {
    mockJsonResponse({ especialidades: [{ id: 'esp-1', nombre: 'Cardiología' }] });
    mockJsonResponse({ error: 'Ya existe un médico con esta cédula profesional.' }, false, 409);
    renderPage();

    await waitFor(() => expect(screen.getByText('Cardiología')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Elena' } });
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Campos' } });
    fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: 'elena@medtrack.test' } });
    fireEvent.change(screen.getByLabelText('Numero de licencia'), { target: { value: 'MED-123' } });
    fireEvent.change(screen.getByLabelText('Especialidad'), { target: { value: 'esp-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar medico' }));

    expect(await screen.findByText('Ya existe un médico con esta cédula profesional.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `npm run test --workspace=apps/frontend -- DoctorsPage`
Expected: FAIL — la página todavía usa `supabase.*`.

- [ ] **Step 6: Reescribir `apps/frontend/src/pages/admin/DoctorsPage.tsx`**

```tsx
import { FormEvent, useEffect, useState } from 'react';
import { AppShell, WorkPanel } from '../../components/AppShell';
import { FormField } from '../../components/FormField';
import { StatusMessage } from '../../components/StatusMessage';
import { apiRequest, getSession } from '../../lib/api';
import { adminNavItems } from '../../lib/nav';

interface Specialty {
  id: string;
  nombre: string;
}

interface CreatedDoctor {
  nombre: string;
  apellido: string;
  email: string;
  licencia: string;
  especialidad: string;
}

export function DoctorsPage() {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [createdDoctors, setCreatedDoctors] = useState<CreatedDoctor[]>([]);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const { token } = getSession();
    apiRequest<{ especialidades: Specialty[] }>('/api/especialidades', { token })
      .then((response) => setSpecialties(response.especialidades))
      .catch(() => setSpecialties([]));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setStatus(null);
    const form = new FormData(formElement);
    const { token } = getSession();
    const especialidadId = String(form.get('especialidadId') ?? '');
    const especialidad = specialties.find((item) => item.id === especialidadId);

    try {
      const response = await apiRequest<{ message: string }>('/api/medicos', {
        method: 'POST',
        token,
        body: {
          nombre: form.get('nombre'),
          apellido: form.get('apellido'),
          email: form.get('email'),
          telefono: form.get('telefono'),
          licencia: form.get('licencia'),
          especialidadId,
        },
      });

      setCreatedDoctors((current) => [
        {
          nombre: String(form.get('nombre') ?? ''),
          apellido: String(form.get('apellido') ?? ''),
          email: String(form.get('email') ?? ''),
          licencia: String(form.get('licencia') ?? ''),
          especialidad: especialidad?.nombre ?? '',
        },
        ...current,
      ]);
      formElement.reset();
      setStatus({ tone: 'success', message: response.message });
    } catch (error) {
      setStatus({ tone: 'error', message: (error as Error).message });
    }
  }

  return (
    <AppShell title="Medicos" subtitle="Registro administrativo de profesionales y especialidades." navItems={adminNavItems}>
      <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
        <WorkPanel title="Registrar medico">
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="nombre" name="nombre" label="Nombre" required />
              <FormField id="apellido" name="apellido" label="Apellido" required />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="email" name="email" type="email" label="Correo electronico" required />
              <FormField id="telefono" name="telefono" label="Telefono" />
            </div>
            <FormField id="licencia" name="licencia" label="Numero de licencia" required />

            <label className="block text-sm font-semibold text-slate-700" htmlFor="especialidadId">
              Especialidad
              <select
                id="especialidadId"
                name="especialidadId"
                required
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100"
              >
                <option value="">Seleccione una especialidad</option>
                {specialties.map((specialty) => (
                  <option key={specialty.id} value={specialty.id}>
                    {specialty.nombre}
                  </option>
                ))}
              </select>
            </label>

            {status ? <StatusMessage tone={status.tone} message={status.message} /> : null}
            <button className="rounded-md bg-teal-700 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-800 sm:w-fit">
              Registrar medico
            </button>
          </form>
        </WorkPanel>

        <div className="grid gap-5">
          <WorkPanel title="Especialidades disponibles">
            <div className="flex flex-wrap gap-2">
              {specialties.map((specialty) => (
                <span key={specialty.id} className="rounded-md bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800">
                  {specialty.nombre}
                </span>
              ))}
            </div>
          </WorkPanel>

          <WorkPanel title="Registros recientes">
            {createdDoctors.length ? (
              <div className="space-y-3">
                {createdDoctors.map((doctor) => (
                  <article key={`${doctor.email}-${doctor.licencia}`} className="rounded-md border border-slate-200 p-3">
                    <p className="font-semibold">
                      {doctor.nombre} {doctor.apellido}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{doctor.especialidad}</p>
                    <p className="mt-1 text-xs text-slate-500">{doctor.email}</p>
                  </article>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-600">Aun no hay medicos registrados en esta sesion.</p>
            )}
          </WorkPanel>
        </div>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm run test --workspace=apps/frontend -- DoctorsPage`
Expected: PASS — 2 tests.

- [ ] **Step 8: Commit**

```bash
git add apps/frontend/src/routes/ProtectedRoute.tsx apps/frontend/src/components/AppShell.tsx apps/frontend/src/pages apps/frontend/tests/DoctorsPage.test.tsx
git commit -m "refactor: nav compartido, AppShell/ProtectedRoute sobre AuthContext, DoctorsPage sobre Express"
```

---

### Task 12: Frontend — `SchedulesPage` (HU-05, admin)

**Files:**
- Create: `apps/frontend/src/pages/admin/SchedulesPage.tsx`
- Modify: `apps/frontend/src/routes/AppRouter.tsx`
- Test: `apps/frontend/tests/SchedulesPage.test.tsx`

**Interfaces:**
- Consumes: `apiRequest`, `getSession` (`lib/api.ts`), `adminNavItems` (`lib/nav.ts`).

- [ ] **Step 1: Write the failing tests — `apps/frontend/tests/SchedulesPage.test.tsx`**

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  localStorage.setItem('medtrack.token', 'admin-token');
  localStorage.setItem(
    'medtrack.user',
    JSON.stringify({ id: 'admin-1', email: 'admin@medtrack.test', nombre: 'Admin', apellido: 'QA', rol: 'ADMIN' })
  );
});

import { AuthProvider } from '../src/context/AuthContext';
import { SchedulesPage } from '../src/pages/admin/SchedulesPage';

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  fetchMock.mockResolvedValueOnce({ ok, status, json: async () => body });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <SchedulesPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('SchedulesPage', () => {
  it('HU-05 crea un horario para el medico seleccionado', async () => {
    mockJsonResponse({ medicos: [{ id: 'med-1', nombre: 'Dr', apellido: 'Lopez' }] });
    mockJsonResponse({ horarios: [] });
    mockJsonResponse({ message: 'Horario creado correctamente.', horario: { id: 'h1' } }, true, 201);
    mockJsonResponse({ horarios: [{ id: 'h1', medicoId: 'med-1', diaSemana: 'LUN', horaInicio: '08:00', horaFin: '12:00' }] });

    renderPage();
    await waitFor(() => expect(screen.getByLabelText('Medico')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Medico'), { target: { value: 'med-1' } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    fireEvent.change(screen.getByLabelText('Dia'), { target: { value: 'LUN' } });
    fireEvent.change(screen.getByLabelText('Hora inicio'), { target: { value: '08:00' } });
    fireEvent.change(screen.getByLabelText('Hora fin'), { target: { value: '12:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar horario' }));

    expect(await screen.findByText('Horario creado correctamente.')).toBeInTheDocument();
  });

  it('HU-05 elimina un horario existente', async () => {
    mockJsonResponse({ medicos: [{ id: 'med-1', nombre: 'Dr', apellido: 'Lopez' }] });
    mockJsonResponse({ horarios: [{ id: 'h1', medicoId: 'med-1', diaSemana: 'LUN', horaInicio: '08:00', horaFin: '12:00' }] });

    renderPage();
    fireEvent.change(await screen.findByLabelText('Medico'), { target: { value: 'med-1' } });

    await screen.findByText(/LUN 08:00 - 12:00/);

    mockJsonResponse({ message: 'Horario eliminado correctamente.' });
    mockJsonResponse({ horarios: [] });

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));

    await waitFor(() => expect(screen.queryByText(/LUN 08:00 - 12:00/)).not.toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test --workspace=apps/frontend -- SchedulesPage`
Expected: FAIL — `Cannot find module '../src/pages/admin/SchedulesPage'`.

- [ ] **Step 3: Crear `apps/frontend/src/pages/admin/SchedulesPage.tsx`**

```tsx
import { FormEvent, useEffect, useState } from 'react';
import { AppShell, WorkPanel } from '../../components/AppShell';
import { StatusMessage } from '../../components/StatusMessage';
import { apiRequest, getSession } from '../../lib/api';
import { adminNavItems } from '../../lib/nav';

interface MedicoOption {
  id: string;
  nombre: string;
  apellido: string;
}

interface Horario {
  id: string;
  medicoId: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
}

const dias = [
  { value: 'LUN', label: 'Lunes' },
  { value: 'MAR', label: 'Martes' },
  { value: 'MIE', label: 'Miercoles' },
  { value: 'JUE', label: 'Jueves' },
  { value: 'VIE', label: 'Viernes' },
  { value: 'SAB', label: 'Sabado' },
  { value: 'DOM', label: 'Domingo' },
];

export function SchedulesPage() {
  const [medicos, setMedicos] = useState<MedicoOption[]>([]);
  const [medicoId, setMedicoId] = useState('');
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const { token } = getSession();
    apiRequest<{ medicos: MedicoOption[] }>('/api/medicos', { token })
      .then((response) => setMedicos(response.medicos))
      .catch(() => setMedicos([]));
  }, []);

  useEffect(() => {
    if (!medicoId) {
      setHorarios([]);
      return;
    }
    const { token } = getSession();
    apiRequest<{ horarios: Horario[] }>(`/api/horarios?medicoId=${medicoId}`, { token })
      .then((response) => setHorarios(response.horarios))
      .catch(() => setHorarios([]));
  }, [medicoId]);

  async function refetchHorarios() {
    const { token } = getSession();
    const response = await apiRequest<{ horarios: Horario[] }>(`/api/horarios?medicoId=${medicoId}`, { token });
    setHorarios(response.horarios);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const form = new FormData(event.currentTarget);
    const { token } = getSession();

    try {
      const response = await apiRequest<{ message: string }>('/api/horarios', {
        method: 'POST',
        token,
        body: {
          medicoId,
          diaSemana: form.get('diaSemana'),
          horaInicio: form.get('horaInicio'),
          horaFin: form.get('horaFin'),
        },
      });
      setStatus({ tone: 'success', message: response.message });
      await refetchHorarios();
    } catch (error) {
      setStatus({ tone: 'error', message: (error as Error).message });
    }
  }

  async function handleDelete(id: string) {
    const { token } = getSession();
    await apiRequest(`/api/horarios/${id}`, { method: 'DELETE', token });
    await refetchHorarios();
  }

  return (
    <AppShell title="Horarios" subtitle="Configuracion de horarios disponibles por medico." navItems={adminNavItems}>
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <WorkPanel title="Seleccionar medico">
          <label className="block text-sm font-semibold text-slate-700" htmlFor="medicoId">
            Medico
            <select
              id="medicoId"
              value={medicoId}
              onChange={(event) => setMedicoId(event.target.value)}
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
            >
              <option value="">Seleccione un medico</option>
              {medicos.map((medico) => (
                <option key={medico.id} value={medico.id}>
                  {medico.nombre} {medico.apellido}
                </option>
              ))}
            </select>
          </label>

          {medicoId ? (
            <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
              <label className="block text-sm font-semibold text-slate-700" htmlFor="diaSemana">
                Dia
                <select
                  id="diaSemana"
                  name="diaSemana"
                  required
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
                >
                  {dias.map((dia) => (
                    <option key={dia.value} value={dia.value}>
                      {dia.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700" htmlFor="horaInicio">
                  Hora inicio
                  <input
                    id="horaInicio"
                    name="horaInicio"
                    type="time"
                    required
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="horaFin">
                  Hora fin
                  <input
                    id="horaFin"
                    name="horaFin"
                    type="time"
                    required
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
                  />
                </label>
              </div>
              {status ? <StatusMessage tone={status.tone} message={status.message} /> : null}
              <button className="rounded-md bg-teal-700 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-800 sm:w-fit">
                Guardar horario
              </button>
            </form>
          ) : null}
        </WorkPanel>

        <WorkPanel title="Horarios configurados">
          {horarios.length ? (
            <div className="space-y-3">
              {horarios.map((horario) => (
                <div key={horario.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3">
                  <span>
                    {horario.diaSemana} {horario.horaInicio} - {horario.horaFin}
                  </span>
                  <button
                    type="button"
                    className="rounded-md border border-rose-300 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                    onClick={() => handleDelete(horario.id)}
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">Este medico todavia no tiene horarios configurados.</p>
          )}
        </WorkPanel>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 4: Agregar la ruta — modificar `apps/frontend/src/routes/AppRouter.tsx`**

Agregar el import:

```tsx
import { SchedulesPage } from '../pages/admin/SchedulesPage';
```

Y la ruta, junto a las demás rutas `/admin/*`:

```tsx
      <Route
        path="/admin/schedules"
        element={
          <ProtectedRoute allowedRoles={['ADMIN']}>
            <SchedulesPage />
          </ProtectedRoute>
        }
      />
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test --workspace=apps/frontend -- SchedulesPage`
Expected: PASS — 2 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/frontend/src/pages/admin/SchedulesPage.tsx apps/frontend/src/routes/AppRouter.tsx apps/frontend/tests/SchedulesPage.test.tsx
git commit -m "feat(HU-05): pantalla de gestion de horarios para el admin"
```

---

### Task 13: Frontend — `AvailabilityPage` (HU-06, paciente, con Realtime)

**Files:**
- Modify: `apps/frontend/tests/mocks/supabaseMock.ts`
- Create: `apps/frontend/src/pages/patient/AvailabilityPage.tsx`
- Modify: `apps/frontend/src/routes/AppRouter.tsx`
- Test: `apps/frontend/tests/AvailabilityPage.test.tsx`

**Interfaces:**
- Consumes: `apiRequest`, `getSession` (`lib/api.ts`), `patientNavItems` (`lib/nav.ts`),
  `supabase` (`lib/supabaseClient.ts`, ya existente — la **única** pantalla que lo usa).

- [ ] **Step 1: Simplificar `apps/frontend/tests/mocks/supabaseMock.ts`**

Este mock ya no necesita `auth`/`from`/`rpc` (nada de eso vive en el frontend ahora) —
solo lo que usa la suscripción Realtime:

```ts
import { vi } from 'vitest';

export function createSupabaseMock() {
  const unsubscribe = vi.fn();
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };

  return {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
    __unsubscribe: unsubscribe,
  };
}

export type SupabaseMock = ReturnType<typeof createSupabaseMock>;
```

- [ ] **Step 2: Write the failing tests — `apps/frontend/tests/AvailabilityPage.test.tsx`**

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseMock } from './mocks/supabaseMock';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  localStorage.setItem('medtrack.token', 'paciente-token');
  localStorage.setItem(
    'medtrack.user',
    JSON.stringify({ id: 'p1', email: 'ana@medtrack.test', nombre: 'Ana', apellido: 'Mora', rol: 'PACIENTE' })
  );
});

vi.mock('../src/lib/supabaseClient', async () => {
  const { createSupabaseMock } = await import('./mocks/supabaseMock');
  return { supabase: createSupabaseMock() };
});

import { supabase } from '../src/lib/supabaseClient';
import { AuthProvider } from '../src/context/AuthContext';
import { AvailabilityPage } from '../src/pages/patient/AvailabilityPage';

const supabaseMock = supabase as unknown as SupabaseMock;

function mockJsonResponse(body: unknown, ok = true, status = 200) {
  fetchMock.mockResolvedValueOnce({ ok, status, json: async () => body });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <AvailabilityPage />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('AvailabilityPage', () => {
  it('HU-06 muestra los horarios disponibles filtrados por especialidad', async () => {
    mockJsonResponse({ especialidades: [{ id: 'esp-1', nombre: 'Cardiología' }] });
    mockJsonResponse({ medicos: [{ id: 'med-1', nombre: 'Dr', apellido: 'Lopez', especialidadId: 'esp-1' }] });
    mockJsonResponse({ horarios: [{ id: 'h1', medicoId: 'med-1', diaSemana: 'LUN', horaInicio: '08:00', horaFin: '12:00' }] });

    renderPage();

    expect(await screen.findByText(/Dr Lopez/)).toBeInTheDocument();
    expect(screen.getByText(/LUN 08:00 - 12:00/)).toBeInTheDocument();
  });

  it('HU-06 filtra por especialidad seleccionada', async () => {
    mockJsonResponse({ especialidades: [{ id: 'esp-1', nombre: 'Cardiología' }, { id: 'esp-2', nombre: 'Pediatría' }] });
    mockJsonResponse({ medicos: [{ id: 'med-1', nombre: 'Dr', apellido: 'Lopez', especialidadId: 'esp-1' }] });
    mockJsonResponse({ horarios: [{ id: 'h1', medicoId: 'med-1', diaSemana: 'LUN', horaInicio: '08:00', horaFin: '12:00' }] });

    renderPage();
    await screen.findByText(/Dr Lopez/);

    mockJsonResponse({ horarios: [] });
    fireEvent.change(screen.getByLabelText('Especialidad'), { target: { value: 'esp-2' } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('especialidadId=esp-2'), expect.anything()));
  });

  it('HU-06 se suscribe a Realtime y refresca cuando llega un cambio', async () => {
    mockJsonResponse({ especialidades: [] });
    mockJsonResponse({ medicos: [] });
    mockJsonResponse({ horarios: [] });

    renderPage();
    await waitFor(() => expect(supabaseMock.channel).toHaveBeenCalledWith('horarios-disponibilidad'));

    const channelInstance = supabaseMock.channel.mock.results[0].value;
    const changeHandler = channelInstance.on.mock.calls[0][2];

    mockJsonResponse({ especialidades: [] });
    mockJsonResponse({ medicos: [] });
    mockJsonResponse({ horarios: [{ id: 'h2', medicoId: 'med-2', diaSemana: 'MAR', horaInicio: '09:00', horaFin: '10:00' }] });

    changeHandler();

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(6));
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test --workspace=apps/frontend -- AvailabilityPage`
Expected: FAIL — `Cannot find module '../src/pages/patient/AvailabilityPage'`.

- [ ] **Step 4: Crear `apps/frontend/src/pages/patient/AvailabilityPage.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { AppShell, WorkPanel } from '../../components/AppShell';
import { apiRequest, getSession } from '../../lib/api';
import { patientNavItems } from '../../lib/nav';
import { supabase } from '../../lib/supabaseClient';

interface Especialidad {
  id: string;
  nombre: string;
}

interface Medico {
  id: string;
  nombre: string;
  apellido: string;
  especialidadId: string;
}

interface Horario {
  id: string;
  medicoId: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
}

export function AvailabilityPage() {
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [especialidadId, setEspecialidadId] = useState('');

  async function fetchAll() {
    const { token } = getSession();
    const [especialidadesRes, medicosRes] = await Promise.all([
      apiRequest<{ especialidades: Especialidad[] }>('/api/especialidades', { token }),
      apiRequest<{ medicos: Medico[] }>('/api/medicos', { token }),
    ]);
    setEspecialidades(especialidadesRes.especialidades);
    setMedicos(medicosRes.medicos);

    const query = especialidadId ? `?especialidadId=${especialidadId}` : '';
    const horariosRes = await apiRequest<{ horarios: Horario[] }>(`/api/horarios${query}`, { token });
    setHorarios(horariosRes.horarios);
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [especialidadId]);

  useEffect(() => {
    const channel = supabase
      .channel('horarios-disponibilidad')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'horarios' }, () => {
        fetchAll();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function medicoLabel(medicoId: string) {
    const medico = medicos.find((m) => m.id === medicoId);
    return medico ? `Dr ${medico.nombre} ${medico.apellido}` : medicoId;
  }

  return (
    <AppShell title="Disponibilidad" subtitle="Consulte horarios disponibles por especialidad." navItems={patientNavItems}>
      <WorkPanel title="Filtrar por especialidad">
        <label className="block text-sm font-semibold text-slate-700" htmlFor="especialidadId">
          Especialidad
          <select
            id="especialidadId"
            value={especialidadId}
            onChange={(event) => setEspecialidadId(event.target.value)}
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
          >
            <option value="">Todas las especialidades</option>
            {especialidades.map((especialidad) => (
              <option key={especialidad.id} value={especialidad.id}>
                {especialidad.nombre}
              </option>
            ))}
          </select>
        </label>
      </WorkPanel>

      <div className="mt-6 grid gap-4">
        {horarios.length ? (
          horarios.map((horario) => (
            <div key={horario.id} className="rounded-md border border-slate-200 bg-white p-4">
              <p className="font-semibold">{medicoLabel(horario.medicoId)}</p>
              <p className="mt-1 text-sm text-slate-600">
                {horario.diaSemana} {horario.horaInicio} - {horario.horaFin}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-600">No hay horarios disponibles con este filtro.</p>
        )}
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 5: Agregar la ruta — modificar `apps/frontend/src/routes/AppRouter.tsx`**

Agregar el import:

```tsx
import { AvailabilityPage } from '../pages/patient/AvailabilityPage';
```

Y la ruta, junto a las demás rutas `/patient/*`:

```tsx
      <Route
        path="/patient/availability"
        element={
          <ProtectedRoute allowedRoles={['PACIENTE']}>
            <AvailabilityPage />
          </ProtectedRoute>
        }
      />
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test --workspace=apps/frontend -- AvailabilityPage`
Expected: PASS — 3 tests.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/tests/mocks/supabaseMock.ts apps/frontend/src/pages/patient/AvailabilityPage.tsx apps/frontend/src/routes/AppRouter.tsx apps/frontend/tests/AvailabilityPage.test.tsx
git commit -m "feat(HU-06): disponibilidad por especialidad con Realtime de Supabase"
```

---

### Task 14: Smoke test de `App`, `CLAUDE.md`, verificación final

**Files:**
- Modify: `apps/frontend/tests/App.test.tsx`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Reescribir `apps/frontend/tests/App.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear();
  window.history.pushState({}, '', '/');
});

vi.mock('../src/lib/supabaseClient', async () => {
  const { createSupabaseMock } = await import('./mocks/supabaseMock');
  return { supabase: createSupabaseMock() };
});

import App from '../src/App';

describe('App', () => {
  it('renderiza la pantalla de login por defecto', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Inicio de sesion' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm run test --workspace=apps/frontend -- App.test`
Expected: PASS.

- [ ] **Step 3: Actualizar `CLAUDE.md`**

Reemplazar la sección `## Stack`:

```markdown
## Stack

- **Frontend:** React + TypeScript + Vite + Tailwind CSS + React Router
- **Backend:** Node.js + Express + TypeScript — intermediario real entre el frontend y Supabase (nunca se expone la `service_role key` al navegador)
- **Base de datos y autenticación:** Supabase (PostgreSQL + Supabase Auth), sin ORM — esquema en `supabase/migrations/*.sql`, aplicado a mano en el SQL Editor del dashboard
- **Validación:** Zod (backend)
- **Testing:** Vitest (+ supertest en backend con un fake de `AppServices`, + React Testing Library en frontend mockeando `fetch`)
- **Monorepo:** npm workspaces</markdown>
```

Reemplazar la sección `## Cómo correr el proyecto` y las notas:

```markdown
## Cómo correr el proyecto

1. `npm install` en la raíz.
2. Aplicar los archivos de `supabase/migrations/` en el SQL Editor del dashboard de Supabase, en orden (ver `supabase/README.md`).
3. Copiar `apps/backend/.env.example` (o la raíz `.env.example`) a `apps/backend/.env` y completar `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API en el dashboard de Supabase — la `service_role key`, no la publishable).
4. `npm run dev:backend` — levanta la API en `http://localhost:4000`.
5. `npm run dev:frontend` — levanta el frontend en `http://localhost:5173`.
6. `npm test` — corre las pruebas de todos los workspaces.

## Notas de Épica 1 y 2 (Express + Supabase)

- El frontend habla con Express (`/api/...`); Express es el único que tiene la
  `service_role key` de Supabase. La única excepción es `AvailabilityPage`, que abre
  una suscripción Realtime de solo lectura directo a Supabase con la key pública
  (Realtime es una conexión navegador→Supabase por diseño de la plataforma).
- El correo de recuperación de contraseña es real (Supabase Auth lo envía); Express
  solo orquesta la llamada.
- El bloqueo de cuenta tras 5 intentos fallidos vive en las funciones Postgres
  `check_login_lock`/`record_login_attempt`, llamadas desde Express.
- Para crear el primer usuario ADMIN, ver `supabase/README.md`.
- HU-06 ("solo horarios libres") hoy muestra todos los horarios creados — excluir los
  horarios con una cita activa queda para cuando exista la Épica 3.
```

- [ ] **Step 4: Verificación final**

Run: `npm install && npm test`
Expected: todos los tests de `apps/backend` y `apps/frontend` pasan.

Run: `npx tsc -p apps/backend/tsconfig.json --noEmit && npx tsc -p apps/frontend/tsconfig.json`
Expected: sin errores de tipos.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/tests/App.test.tsx CLAUDE.md
git commit -m "docs: update CLAUDE.md for Express-mediated backend, fix App smoke test"
```