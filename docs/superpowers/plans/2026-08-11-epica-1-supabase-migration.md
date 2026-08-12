# Épica 1 — Migración a Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the already-merged Express+Prisma+JWT implementation of Épica 1 (HU-01..HU-04) with Supabase Auth + `@supabase/supabase-js` called directly from the frontend, per `docs/superpowers/specs/2026-08-11-epica-1-gestion-usuarios-supabase-design.md`. Express is reduced to `/health` only.

**Architecture:** Frontend talks directly to Supabase (Auth + Postgres via PostgREST) using `@supabase/supabase-js`. Business rules that need server-side enforcement (login lockout) live in Postgres `SECURITY DEFINER` functions callable via `supabase.rpc(...)`. Role-based access to the `medicos`/`especialidades` tables is enforced by Postgres Row Level Security policies, not by application code. Express keeps only the existing `/health` endpoint.

**Tech Stack:** React, TypeScript, Vite, `@supabase/supabase-js`, Vitest, React Testing Library, plain SQL (Postgres, no ORM).

## Global Constraints

- No se usa Prisma en ninguna parte del proyecto a partir de este plan.
- Los archivos `.sql` de este plan deben ejecutarse a mano por el usuario en el SQL Editor del dashboard de Supabase — esta sesión no tiene el connection string ni el service_role key, y no se van a pedir.
- Los mensajes de error/éxito visibles al usuario deben coincidir exactamente con los del Product Backlog (HU-01..HU-04) donde estén especificados.
- `apps/frontend/.env` con las credenciales reales de Supabase no se comitea (ya cubierto por `.gitignore`); `apps/frontend/.env.example` sí se comitea, con valores vacíos.
- Express queda únicamente con `GET /health` para esta épica — nada de rutas de auth/médicos en el backend.

---

### Task 1: Reducir el backend a solo `/health`

**Files:**
- Delete: `apps/backend/prisma/` (carpeta completa: `schema.prisma`, `seedAdmin.ts`)
- Delete: `apps/backend/src/repositories/` (carpeta completa)
- Delete: `apps/backend/src/routes/auth.ts`
- Delete: `apps/backend/src/routes/doctors.ts`
- Delete: `apps/backend/src/services/` (carpeta completa: `appServices.ts`, `mailService.ts`, `tokens.ts`)
- Delete: `apps/backend/src/middlewares/auth.ts`
- Delete: `apps/backend/src/lib/` (carpeta completa: `prisma.ts`, `httpError.ts`)
- Delete: `apps/backend/tests/userManagement.test.ts`
- Delete: `apps/backend/tests/helpers/` (carpeta completa)
- Modify: `apps/backend/src/app.ts`
- Modify: `apps/backend/src/routes/index.ts`
- Modify: `apps/backend/src/config/env.ts`
- Modify: `apps/backend/tests/health.test.ts`
- Modify: `apps/backend/package.json`
- Modify: `.env.example` (raíz)

**Interfaces:**
- Produces: `createApp(): Express` (sin argumentos), usado por `server.ts` y por el test.

- [ ] **Step 1: Borrar los módulos de auth/médicos/Prisma**

Run:
```
rm -rf apps/backend/prisma apps/backend/src/repositories apps/backend/src/routes/auth.ts apps/backend/src/routes/doctors.ts apps/backend/src/services apps/backend/src/middlewares/auth.ts apps/backend/src/lib apps/backend/tests/userManagement.test.ts apps/backend/tests/helpers
```

- [ ] **Step 2: Simplificar `apps/backend/src/routes/index.ts`**

```ts
import { Router } from 'express';
import { healthRouter } from './health';

export const apiRouter = Router();

apiRouter.use(healthRouter);
```

- [ ] **Step 3: Simplificar `apps/backend/src/app.ts`**

```ts
import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { notFound } from './middlewares/notFound';
import { apiRouter } from './routes';

export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());
  app.use(apiRouter);
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
```

- [ ] **Step 4: Simplificar `apps/backend/src/config/env.ts`**

```ts
import 'dotenv/config';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
};
```

- [ ] **Step 5: Simplificar el test — `apps/backend/tests/health.test.ts`**

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

describe('GET /health', () => {
  it('responde con status ok', async () => {
    const app = createApp();
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 6: Quitar dependencias que ya no se usan de `apps/backend/package.json`**

```json
{
  "name": "@medtrack/backend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "test": "vitest run"
  },
  "dependencies": {
    "@medtrack/shared": "*",
    "express": "^4.19.2",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "tsx": "^4.16.5",
    "vitest": "^2.0.5",
    "supertest": "^7.0.0",
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/supertest": "^6.0.2",
    "@types/node": "^20.14.15"
  }
}
```

- [ ] **Step 7: Reinstalar dependencias del workspace backend**

Run: `npm install`
Expected: `@prisma/client`, `prisma`, `bcrypt`, `jsonwebtoken` y sus `@types` desaparecen de `node_modules/@medtrack/backend` (ya no están en su `package.json`); no hay errores.

- [ ] **Step 8: Correr el test para confirmar que sigue en verde**

Run: `npm run test --workspace=apps/backend`
Expected: PASS — `GET /health responde con status ok`.

- [ ] **Step 9: Simplificar `.env.example` (raíz)**

```
PORT=4000
NODE_ENV=development
CORS_ORIGIN="http://localhost:5173"
```

- [ ] **Step 10: Commit**

```bash
git add apps/backend .env.example
git commit -m "refactor: reduce backend to /health only, remove Prisma/JWT auth"
```

---

### Task 2: Migraciones SQL para Supabase

**Files:**
- Create: `supabase/migrations/0001_perfiles.sql`
- Create: `supabase/migrations/0002_especialidades.sql`
- Create: `supabase/migrations/0003_medicos.sql`
- Create: `supabase/migrations/0004_login_attempts.sql`
- Create: `supabase/README.md`

**Interfaces:**
- Produces: tablas `perfiles`, `especialidades`, `medicos`, `login_attempts`; funciones `check_login_lock(p_email text)` y `record_login_attempt(p_email text, p_exitoso boolean)`, ambas devolviendo `jsonb` con la forma `{ bloqueado: boolean, bloqueado_hasta: string | null, intentos: number }`. Estos son los nombres/formas que el frontend (Tareas 3–7) va a llamar.

**Nota:** esta tarea no tiene "test que falle primero" porque no hay conexión a una base de datos real desde esta sesión. El "test" es que el usuario pegue cada archivo en el SQL Editor de Supabase, en orden, y confirme que corre sin errores.

- [ ] **Step 1: Crear `supabase/migrations/0001_perfiles.sql`**

```sql
create extension if not exists pgcrypto;

create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null,
  apellido text not null,
  telefono text,
  rol text not null default 'PACIENTE' check (rol in ('PACIENTE', 'ADMIN')),
  created_at timestamptz not null default now()
);

alter table public.perfiles enable row level security;

create policy "los usuarios ven su propio perfil"
  on public.perfiles for select
  to authenticated
  using (id = auth.uid());

create policy "los usuarios actualizan su propio perfil"
  on public.perfiles for update
  to authenticated
  using (id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (id, nombre, apellido, telefono, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    coalesce(new.raw_user_meta_data ->> 'apellido', ''),
    new.raw_user_meta_data ->> 'telefono',
    'PACIENTE'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 2: Crear `supabase/migrations/0002_especialidades.sql`**

```sql
create table if not exists public.especialidades (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  descripcion text
);

alter table public.especialidades enable row level security;

create policy "admins leen especialidades"
  on public.especialidades for select
  to authenticated
  using (
    exists (select 1 from public.perfiles where id = auth.uid() and rol = 'ADMIN')
  );

insert into public.especialidades (nombre, descripcion) values
  ('Cardiología', 'Diagnóstico y tratamiento de enfermedades del corazón'),
  ('Pediatría', 'Atención médica de niños y adolescentes'),
  ('Dermatología', 'Diagnóstico y tratamiento de enfermedades de la piel')
on conflict (nombre) do nothing;
```

- [ ] **Step 3: Crear `supabase/migrations/0003_medicos.sql`**

```sql
create table if not exists public.medicos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  apellido text not null,
  email text not null unique,
  telefono text,
  licencia text not null unique,
  especialidad_id uuid not null references public.especialidades (id),
  created_at timestamptz not null default now()
);

alter table public.medicos enable row level security;

create policy "admins leen medicos"
  on public.medicos for select
  to authenticated
  using (
    exists (select 1 from public.perfiles where id = auth.uid() and rol = 'ADMIN')
  );

create policy "admins registran medicos"
  on public.medicos for insert
  to authenticated
  with check (
    exists (select 1 from public.perfiles where id = auth.uid() and rol = 'ADMIN')
  );
```

- [ ] **Step 4: Crear `supabase/migrations/0004_login_attempts.sql`**

```sql
create table if not exists public.login_attempts (
  email text primary key,
  intentos int not null default 0,
  bloqueado_hasta timestamptz
);

alter table public.login_attempts enable row level security;
-- Sin políticas de select/insert/update: esta tabla no se lee ni se escribe
-- directamente desde el cliente, solo a través de las funciones de abajo.

create or replace function public.check_login_lock(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.login_attempts;
begin
  select * into v_row from public.login_attempts where email = p_email;

  if v_row.email is null then
    return jsonb_build_object('bloqueado', false, 'bloqueado_hasta', null, 'intentos', 0);
  end if;

  if v_row.bloqueado_hasta is not null and v_row.bloqueado_hasta > now() then
    return jsonb_build_object('bloqueado', true, 'bloqueado_hasta', v_row.bloqueado_hasta, 'intentos', v_row.intentos);
  end if;

  return jsonb_build_object('bloqueado', false, 'bloqueado_hasta', null, 'intentos', v_row.intentos);
end;
$$;

revoke all on function public.check_login_lock(text) from public;
grant execute on function public.check_login_lock(text) to anon, authenticated;

create or replace function public.record_login_attempt(p_email text, p_exitoso boolean)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intentos int;
  v_bloqueado_hasta timestamptz;
begin
  if p_exitoso then
    update public.login_attempts set intentos = 0, bloqueado_hasta = null where email = p_email;
    return jsonb_build_object('bloqueado', false, 'intentos', 0);
  end if;

  insert into public.login_attempts (email, intentos)
  values (p_email, 1)
  on conflict (email) do update set intentos = public.login_attempts.intentos + 1
  returning intentos into v_intentos;

  if v_intentos >= 5 then
    v_bloqueado_hasta := now() + interval '15 minutes';
    update public.login_attempts set bloqueado_hasta = v_bloqueado_hasta where email = p_email;
    return jsonb_build_object('bloqueado', true, 'bloqueado_hasta', v_bloqueado_hasta, 'intentos', v_intentos);
  end if;

  return jsonb_build_object('bloqueado', false, 'intentos', v_intentos);
end;
$$;

revoke all on function public.record_login_attempt(text, boolean) from public;
grant execute on function public.record_login_attempt(text, boolean) to anon, authenticated;
```

- [ ] **Step 5: Crear `supabase/README.md`**

```markdown
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
```

- [ ] **Step 6: Commit**

```bash
git add supabase
git commit -m "feat: add Supabase SQL migrations for perfiles, especialidades, medicos, login_attempts"
```

---

### Task 3: Cliente de Supabase, `AuthContext` y `ProtectedRoute` en el frontend

**Files:**
- Create: `apps/frontend/.env.example`
- Create: `apps/frontend/.env` (no se comitea — gitignored)
- Create: `apps/frontend/src/lib/supabaseClient.ts`
- Create: `apps/frontend/src/context/AuthContext.tsx`
- Create: `apps/frontend/tests/mocks/supabaseMock.ts`
- Test: `apps/frontend/tests/AuthContext.test.tsx`
- Modify: `apps/frontend/src/routes/ProtectedRoute.tsx`
- Modify: `apps/frontend/src/components/AppShell.tsx`
- Modify: `apps/frontend/src/App.tsx`
- Delete: `apps/frontend/src/lib/api.ts`

**Interfaces:**
- Produces: `supabase` (cliente exportado desde `src/lib/supabaseClient.ts`); `AuthProvider`, `useAuth()` devolviendo `{ user: SessionUser | null, loading: boolean, logout: () => Promise<void> }` desde `src/context/AuthContext.tsx`, donde `SessionUser = { id: string; email: string; nombre: string; apellido: string; rol: RolUsuario }`. Consumido por `ProtectedRoute`, `AppShell` y todas las páginas de las Tareas 4–7.
- Consumes: `RolUsuario` de `@medtrack/shared` (ya existente).

- [ ] **Step 1: Crear `apps/frontend/.env.example`**

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

- [ ] **Step 2: Crear `apps/frontend/.env` con las credenciales reales**

```
VITE_SUPABASE_URL=https://cykrqkcafyniylnlguxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_wgpMMkUaA7Gb_ItwdvqjSg_KKvYOHLL
```

- [ ] **Step 3: Verificar que `apps/frontend/.env` no se pueda comitear por error**

Run: `git check-ignore -v apps/frontend/.env`
Expected: imprime una regla de `.gitignore` que lo cubre (el patrón raíz `.env` sin barra inicial aplica a cualquier profundidad).

- [ ] **Step 4: Instalar `@supabase/supabase-js` en el workspace del frontend**

El paquete ya está en las dependencias raíz (`npm install @supabase/supabase-js` se corrió antes); esta tarea lo mueve a donde corresponde.

Run: `npm uninstall @supabase/supabase-js` (en la raíz) `&& npm install @supabase/supabase-js --workspace=apps/frontend`

- [ ] **Step 5: Crear `apps/frontend/src/lib/supabaseClient.ts`**

```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);
```

- [ ] **Step 6: Crear el mock compartido de pruebas — `apps/frontend/tests/mocks/supabaseMock.ts`**

```ts
import { vi } from 'vitest';

export function createSupabaseMock() {
  return {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(),
    rpc: vi.fn(),
  };
}
```

- [ ] **Step 7: Write the failing test — `apps/frontend/tests/AuthContext.test.tsx`**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseMock } from './mocks/supabaseMock';

const supabaseMock = createSupabaseMock();

vi.mock('../src/lib/supabaseClient', () => ({ supabase: supabaseMock }));

import { AuthProvider, useAuth } from '../src/context/AuthContext';

function Probe() {
  const { user, loading } = useAuth();
  if (loading) return <p>cargando</p>;
  return <p>{user ? `${user.nombre} (${user.rol})` : 'sin sesion'}</p>;
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null } });
    supabaseMock.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
  });

  it('expone user en null cuando no hay sesion', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText('sin sesion')).toBeInTheDocument());
  });

  it('carga el perfil desde la tabla perfiles cuando hay sesion', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1', email: 'ana@medtrack.test' } } },
    });
    const single = vi.fn().mockResolvedValue({
      data: { nombre: 'Ana', apellido: 'Mora', rol: 'PACIENTE' },
      error: null,
    });
    supabaseMock.from.mockReturnValue({
      select: () => ({ eq: () => ({ single }) }),
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText('Ana (PACIENTE)')).toBeInTheDocument());
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `npm run test --workspace=apps/frontend -- AuthContext`
Expected: FAIL — `Cannot find module '../src/context/AuthContext'`.

- [ ] **Step 9: Crear `apps/frontend/src/context/AuthContext.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import type { RolUsuario } from '@medtrack/shared';
import { supabase } from '../lib/supabaseClient';

export interface SessionUser {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: RolUsuario;
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function loadProfile(userId: string, email: string): Promise<SessionUser | null> {
  const { data, error } = await supabase
    .from('perfiles')
    .select('nombre, apellido, rol')
    .eq('id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return { id: userId, email, nombre: data.nombre, apellido: data.apellido, rol: data.rol };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshProfile() {
    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session) {
      setUser(null);
      return;
    }

    const profile = await loadProfile(session.user.id, session.user.email ?? '');
    setUser(profile);
  }

  useEffect(() => {
    refreshProfile().finally(() => setLoading(false));

    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      refreshProfile();
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, refreshProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `npm run test --workspace=apps/frontend -- AuthContext`
Expected: PASS — ambos tests de `AuthContext`.

- [ ] **Step 11: Reescribir `apps/frontend/src/routes/ProtectedRoute.tsx`**

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

  if (loading) {
    return null;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(user.rol)) {
    return <Navigate to={user.rol === 'ADMIN' ? '/admin/dashboard' : '/patient/dashboard'} replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 12: Actualizar `apps/frontend/src/components/AppShell.tsx`**

Reemplazar el import y el cuerpo de `AppShell` (dejar `StatGrid`, `EmptyState`, `WorkPanel` sin cambios):

```tsx
import type { PropsWithChildren } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface NavItem {
  label: string;
  to: string;
}

interface AppShellProps {
  title: string;
  subtitle: string;
  navItems: NavItem[];
}

export function AppShell({ title, subtitle, navItems, children }: PropsWithChildren<AppShellProps>) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link to={user?.rol === 'ADMIN' ? '/admin/dashboard' : '/patient/dashboard'} className="text-sm font-semibold text-teal-700">
              MedTrack
            </Link>
            <h1 className="mt-2 text-3xl font-semibold">{title}</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{subtitle}</p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user ? `${user.nombre} ${user.apellido}` : 'Sesion activa'}</p>
              <p className="text-xs text-slate-500">{user?.rol ?? 'USUARIO'}</p>
            </div>
            <button
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              onClick={handleLogout}
              type="button"
            >
              Salir
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 pb-4">
          {navItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition ${
                  active ? 'bg-teal-700 text-white' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <section className="mx-auto max-w-6xl px-4 py-6">{children}</section>
    </main>
  );
}
```

- [ ] **Step 13: Actualizar `apps/frontend/src/App.tsx`**

```tsx
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppRouter } from './routes/AppRouter';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
```

- [ ] **Step 14: Borrar `apps/frontend/src/lib/api.ts`**

Run: `rm apps/frontend/src/lib/api.ts`

- [ ] **Step 15: Commit**

```bash
git add apps/frontend package.json package-lock.json
git commit -m "feat: add Supabase client and AuthContext, replace localStorage session handling"
```

---

### Task 4: HU-01 — Registro de Pacientes con Supabase Auth

**Files:**
- Modify: `apps/frontend/src/pages/auth/RegisterPage.tsx`
- Test: `apps/frontend/tests/RegisterPage.test.tsx`

**Interfaces:**
- Consumes: `supabase.auth.signUp` (Tarea 3).
- Produces: nada nuevo — página autocontenida.

- [ ] **Step 1: Write the failing tests — `apps/frontend/tests/RegisterPage.test.tsx`**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseMock } from './mocks/supabaseMock';

const supabaseMock = createSupabaseMock();

vi.mock('../src/lib/supabaseClient', () => ({ supabase: supabaseMock }));

import { RegisterPage } from '../src/pages/auth/RegisterPage';

function fillForm(overrides: Record<string, string> = {}) {
  const values = {
    nombre: 'Ana',
    apellido: 'Mora',
    email: 'ana@medtrack.test',
    password: 'Segura123',
    ...overrides,
  };

  if (values.nombre) fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: values.nombre } });
  fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: values.apellido } });
  fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: values.email } });
  fireEvent.change(screen.getByLabelText('Contrasena'), { target: { value: values.password } });
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('HU-01 muestra confirmacion cuando el registro es exitoso', async () => {
    supabaseMock.auth.signUp.mockResolvedValue({ data: {}, error: null });
    render(<RegisterPage />, { wrapper: BrowserRouter });

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Registrarme' }));

    expect(await screen.findByText('Cuenta creada exitosamente. Bienvenido a MedTrack.')).toBeInTheDocument();
    expect(supabaseMock.auth.signUp).toHaveBeenCalledWith({
      email: 'ana@medtrack.test',
      password: 'Segura123',
      options: { data: { nombre: 'Ana', apellido: 'Mora', telefono: '' } },
    });
  });

  it('HU-01 muestra error de correo duplicado', async () => {
    supabaseMock.auth.signUp.mockResolvedValue({
      data: {},
      error: { message: 'User already registered' },
    });
    render(<RegisterPage />, { wrapper: BrowserRouter });

    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Registrarme' }));

    expect(
      await screen.findByText('Este correo ya está registrado. Por favor inicia sesión o usa otro correo.')
    ).toBeInTheDocument();
  });

  it('HU-01 exige el nombre antes de llamar a Supabase', async () => {
    render(<RegisterPage />, { wrapper: BrowserRouter });

    fillForm({ nombre: '' });
    fireEvent.click(screen.getByRole('button', { name: 'Registrarme' }));

    expect(await screen.findByText('El nombre es un campo obligatorio.')).toBeInTheDocument();
    expect(supabaseMock.auth.signUp).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test --workspace=apps/frontend -- RegisterPage`
Expected: FAIL — la página todavía usa `apiRequest` de `../../lib/api`, que ya no existe.

- [ ] **Step 3: Reescribir `apps/frontend/src/pages/auth/RegisterPage.tsx`**

```tsx
import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../../components/AuthLayout';
import { FormField } from '../../components/FormField';
import { StatusMessage } from '../../components/StatusMessage';
import { supabase } from '../../lib/supabaseClient';

export function RegisterPage() {
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setStatus(null);
    const form = new FormData(formElement);
    const nombre = String(form.get('nombre') ?? '').trim();

    if (!nombre) {
      setStatus({ tone: 'error', message: 'El nombre es un campo obligatorio.' });
      return;
    }

    const { error } = await supabase.auth.signUp({
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
      options: {
        data: {
          nombre,
          apellido: String(form.get('apellido') ?? ''),
          telefono: String(form.get('telefono') ?? ''),
        },
      },
    });

    if (error) {
      const message = error.message.toLowerCase().includes('already registered')
        ? 'Este correo ya está registrado. Por favor inicia sesión o usa otro correo.'
        : error.message;
      setStatus({ tone: 'error', message });
      return;
    }

    formElement.reset();
    setStatus({ tone: 'success', message: 'Cuenta creada exitosamente. Bienvenido a MedTrack.' });
  }

  return (
    <AuthLayout title="Registro de paciente" subtitle="Cree su cuenta para solicitar citas medicas.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <FormField id="nombre" name="nombre" label="Nombre" required />
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test --workspace=apps/frontend -- RegisterPage`
Expected: PASS — los 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/pages/auth/RegisterPage.tsx apps/frontend/tests/RegisterPage.test.tsx
git commit -m "feat(HU-01): registro de pacientes via Supabase Auth"
```

---

### Task 5: HU-02 — Inicio de Sesión con bloqueo por intentos (RPC)

**Files:**
- Modify: `apps/frontend/src/pages/auth/LoginPage.tsx`
- Test: `apps/frontend/tests/LoginPage.test.tsx`

**Interfaces:**
- Consumes: `supabase.auth.signInWithPassword`, `supabase.rpc('check_login_lock', ...)`, `supabase.rpc('record_login_attempt', ...)`, `supabase.from('perfiles')` (Tareas 2 y 3).

- [ ] **Step 1: Write the failing tests — `apps/frontend/tests/LoginPage.test.tsx`**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseMock } from './mocks/supabaseMock';

const supabaseMock = createSupabaseMock();

vi.mock('../src/lib/supabaseClient', () => ({ supabase: supabaseMock }));

import { LoginPage } from '../src/pages/auth/LoginPage';

function fillAndSubmit(email = 'ana@medtrack.test', password = 'Segura123') {
  fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Contrasena'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.rpc.mockImplementation((fn: string) => {
      if (fn === 'check_login_lock') {
        return Promise.resolve({ data: { bloqueado: false, bloqueado_hasta: null, intentos: 0 }, error: null });
      }
      return Promise.resolve({ data: { bloqueado: false, intentos: 1 }, error: null });
    });
  });

  it('HU-02 autentica con credenciales validas y navega segun el rol', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    const single = vi.fn().mockResolvedValue({ data: { rol: 'PACIENTE' }, error: null });
    supabaseMock.from.mockReturnValue({ select: () => ({ eq: () => ({ single }) }) });

    render(<LoginPage />, { wrapper: MemoryRouter });
    fillAndSubmit();

    expect(await screen.findByText(/inicio de sesion exitoso/i)).toBeInTheDocument();
  });

  it('HU-02 rechaza credenciales incorrectas mostrando el contador de intentos', async () => {
    supabaseMock.auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials' },
    });
    supabaseMock.rpc.mockImplementation((fn: string) => {
      if (fn === 'check_login_lock') {
        return Promise.resolve({ data: { bloqueado: false, bloqueado_hasta: null, intentos: 0 }, error: null });
      }
      return Promise.resolve({ data: { bloqueado: false, intentos: 2 }, error: null });
    });

    render(<LoginPage />, { wrapper: MemoryRouter });
    fillAndSubmit();

    expect(await screen.findByText('Correo o contraseña incorrectos. Intento 2 de 5.')).toBeInTheDocument();
  });

  it('HU-02 bloquea la cuenta cuando check_login_lock indica bloqueo activo', async () => {
    supabaseMock.rpc.mockImplementation((fn: string) => {
      if (fn === 'check_login_lock') {
        return Promise.resolve({
          data: { bloqueado: true, bloqueado_hasta: new Date().toISOString(), intentos: 5 },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    render(<LoginPage />, { wrapper: MemoryRouter });
    fillAndSubmit();

    expect(
      await screen.findByText('Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.')
    ).toBeInTheDocument();
    expect(supabaseMock.auth.signInWithPassword).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test --workspace=apps/frontend -- LoginPage`
Expected: FAIL — la página todavía usa `apiRequest`/`saveSession` de `../../lib/api`.

- [ ] **Step 3: Reescribir `apps/frontend/src/pages/auth/LoginPage.tsx`**

```tsx
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/AuthLayout';
import { FormField } from '../../components/FormField';
import { StatusMessage } from '../../components/StatusMessage';
import { supabase } from '../../lib/supabaseClient';

interface LoginLockStatus {
  bloqueado: boolean;
  bloqueado_hasta: string | null;
  intentos: number;
}

interface LoginAttemptResult {
  bloqueado: boolean;
  intentos: number;
}

export function LoginPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '');
    const password = String(form.get('password') ?? '');

    const { data: lock } = await supabase.rpc('check_login_lock', { p_email: email });
    const lockStatus = lock as LoginLockStatus | null;

    if (lockStatus?.bloqueado) {
      setStatus({ tone: 'error', message: 'Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.' });
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const { data: attempt } = await supabase.rpc('record_login_attempt', {
        p_email: email,
        p_exitoso: false,
      });
      const attemptResult = attempt as LoginAttemptResult | null;

      if (attemptResult?.bloqueado) {
        setStatus({ tone: 'error', message: 'Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.' });
      } else {
        setStatus({
          tone: 'error',
          message: `Correo o contraseña incorrectos. Intento ${attemptResult?.intentos ?? 1} de 5.`,
        });
      }
      return;
    }

    await supabase.rpc('record_login_attempt', { p_email: email, p_exitoso: true });

    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', data.user!.id)
      .single();

    setStatus({ tone: 'success', message: 'Inicio de sesion exitoso.' });
    navigate(perfil?.rol === 'ADMIN' ? '/admin/dashboard' : '/patient/dashboard');
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test --workspace=apps/frontend -- LoginPage`
Expected: PASS — los 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/pages/auth/LoginPage.tsx apps/frontend/tests/LoginPage.test.tsx
git commit -m "feat(HU-02): login con Supabase Auth y bloqueo por intentos via RPC"
```

---

### Task 6: HU-03 — Recuperar Contraseña con Supabase Auth

**Files:**
- Modify: `apps/frontend/src/pages/auth/ForgotPasswordPage.tsx`
- Modify: `apps/frontend/src/pages/auth/ResetPasswordPage.tsx`
- Test: `apps/frontend/tests/ForgotPasswordPage.test.tsx`
- Test: `apps/frontend/tests/ResetPasswordPage.test.tsx`

**Interfaces:**
- Consumes: `supabase.auth.resetPasswordForEmail`, `supabase.auth.updateUser` (Tarea 3).

- [ ] **Step 1: Write the failing test — `apps/frontend/tests/ForgotPasswordPage.test.tsx`**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseMock } from './mocks/supabaseMock';

const supabaseMock = createSupabaseMock();

vi.mock('../src/lib/supabaseClient', () => ({ supabase: supabaseMock }));

import { ForgotPasswordPage } from '../src/pages/auth/ForgotPasswordPage';

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('HU-03 envia el correo de recuperacion y muestra el mensaje generico', async () => {
    supabaseMock.auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    render(<ForgotPasswordPage />, { wrapper: BrowserRouter });

    fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: 'ana@medtrack.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));

    expect(
      await screen.findByText('Si el correo existe, recibirás un enlace de recuperación.')
    ).toBeInTheDocument();
    expect(supabaseMock.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'ana@medtrack.test',
      expect.objectContaining({ redirectTo: expect.stringContaining('/reset-password') })
    );
  });
});
```

- [ ] **Step 2: Write the failing tests — `apps/frontend/tests/ResetPasswordPage.test.tsx`**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseMock } from './mocks/supabaseMock';

const supabaseMock = createSupabaseMock();

vi.mock('../src/lib/supabaseClient', () => ({ supabase: supabaseMock }));

import { ResetPasswordPage } from '../src/pages/auth/ResetPasswordPage';

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('HU-03 muestra error cuando el enlace ya expiro', async () => {
    supabaseMock.auth.updateUser.mockResolvedValue({
      data: {},
      error: { message: 'Token has expired or is invalid' },
    });
    render(<ResetPasswordPage />, { wrapper: BrowserRouter });

    fireEvent.change(screen.getByLabelText('Nueva contrasena'), { target: { value: 'Nueva1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contrasena' }));

    expect(await screen.findByText('Este enlace ha expirado. Por favor solicita uno nuevo.')).toBeInTheDocument();
  });

  it('HU-03 permite crear una nueva contrasena con un enlace vigente', async () => {
    supabaseMock.auth.updateUser.mockResolvedValue({ data: {}, error: null });
    render(<ResetPasswordPage />, { wrapper: BrowserRouter });

    fireEvent.change(screen.getByLabelText('Nueva contrasena'), { target: { value: 'Nueva1234' } });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contrasena' }));

    expect(await screen.findByText('Contraseña actualizada correctamente.')).toBeInTheDocument();
    expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith({ password: 'Nueva1234' });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test --workspace=apps/frontend -- ForgotPasswordPage ResetPasswordPage`
Expected: FAIL — ambas páginas todavía usan `apiRequest`.

- [ ] **Step 4: Reescribir `apps/frontend/src/pages/auth/ForgotPasswordPage.tsx`**

```tsx
import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../../components/AuthLayout';
import { FormField } from '../../components/FormField';
import { StatusMessage } from '../../components/StatusMessage';
import { supabase } from '../../lib/supabaseClient';

export function ForgotPasswordPage() {
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '');

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setStatus({ tone: 'success', message: 'Si el correo existe, recibirás un enlace de recuperación.' });
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

- [ ] **Step 5: Reescribir `apps/frontend/src/pages/auth/ResetPasswordPage.tsx`**

```tsx
import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../../components/AuthLayout';
import { FormField } from '../../components/FormField';
import { StatusMessage } from '../../components/StatusMessage';
import { supabase } from '../../lib/supabaseClient';

export function ResetPasswordPage() {
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus({ tone: 'error', message: 'Este enlace ha expirado. Por favor solicita uno nuevo.' });
      return;
    }

    setStatus({ tone: 'success', message: 'Contraseña actualizada correctamente.' });
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

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test --workspace=apps/frontend -- ForgotPasswordPage ResetPasswordPage`
Expected: PASS — los 3 tests en total.

- [ ] **Step 7: Commit**

```bash
git add apps/frontend/src/pages/auth/ForgotPasswordPage.tsx apps/frontend/src/pages/auth/ResetPasswordPage.tsx apps/frontend/tests/ForgotPasswordPage.test.tsx apps/frontend/tests/ResetPasswordPage.test.tsx
git commit -m "feat(HU-03): recuperar contrasena via Supabase Auth (correo real, sin mock)"
```

---

### Task 7: HU-04 — Registrar Médico contra la tabla `medicos`

**Files:**
- Modify: `apps/frontend/src/pages/admin/DoctorsPage.tsx`
- Test: `apps/frontend/tests/DoctorsPage.test.tsx`

**Interfaces:**
- Consumes: `supabase.from('especialidades').select(...)`, `supabase.from('medicos').insert(...)` (Tarea 2 define las tablas y políticas; Tarea 3 define el cliente).

- [ ] **Step 1: Write the failing tests — `apps/frontend/tests/DoctorsPage.test.tsx`**

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseMock } from './mocks/supabaseMock';

const supabaseMock = createSupabaseMock();

vi.mock('../src/lib/supabaseClient', () => ({ supabase: supabaseMock }));

import { AuthProvider } from '../src/context/AuthContext';
import { DoctorsPage } from '../src/pages/admin/DoctorsPage';

const specialties = [
  { id: 'esp-1', nombre: 'Cardiología' },
  { id: 'esp-2', nombre: 'Pediatría' },
];

function renderAsAdmin(fromImpl: (table: string) => unknown) {
  supabaseMock.auth.getSession.mockResolvedValue({
    data: { session: { user: { id: 'admin-1', email: 'admin@medtrack.test' } } },
  });
  supabaseMock.auth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });

  const single = vi.fn().mockResolvedValue({
    data: { nombre: 'Admin', apellido: 'QA', rol: 'ADMIN' },
    error: null,
  });

  supabaseMock.from.mockImplementation((table: string) => {
    if (table === 'perfiles') {
      return { select: () => ({ eq: () => ({ single }) }) };
    }
    return fromImpl(table);
  });

  return render(
    <AuthProvider>
      <DoctorsPage />
    </AuthProvider>
  );
}

describe('DoctorsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('HU-04 registra un medico con la especialidad seleccionada', async () => {
    const insert = vi.fn().mockResolvedValue({ data: {}, error: null });
    renderAsAdmin((table) =>
      table === 'especialidades'
        ? { select: () => Promise.resolve({ data: specialties, error: null }) }
        : { insert }
    );

    await waitFor(() => expect(screen.getByText('Cardiología')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Elena' } });
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Campos' } });
    fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: 'elena@medtrack.test' } });
    fireEvent.change(screen.getByLabelText('Numero de licencia'), { target: { value: 'MED-123' } });
    fireEvent.change(screen.getByLabelText('Especialidad'), { target: { value: 'esp-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar medico' }));

    expect(await screen.findByText('Médico registrado correctamente.')).toBeInTheDocument();
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ licencia: 'MED-123', especialidad_id: 'esp-2' })
    );
  });

  it('HU-04 bloquea el registro si la licencia ya existe', async () => {
    renderAsAdmin((table) =>
      table === 'especialidades'
        ? { select: () => Promise.resolve({ data: specialties, error: null }) }
        : { insert: vi.fn().mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate' } }) }
    );

    await waitFor(() => expect(screen.getByText('Cardiología')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Elena' } });
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Campos' } });
    fireEvent.change(screen.getByLabelText('Correo electronico'), { target: { value: 'elena@medtrack.test' } });
    fireEvent.change(screen.getByLabelText('Numero de licencia'), { target: { value: 'MED-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar medico' }));

    expect(await screen.findByText('Ya existe un médico con esta cédula profesional.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test --workspace=apps/frontend -- DoctorsPage`
Expected: FAIL — la página todavía usa `apiRequest`/`getSession` de `../../lib/api`, y el `<select>` de especialidad no tiene `id`/`htmlFor` para `getByLabelText('Especialidad')`.

- [ ] **Step 3: Reescribir `apps/frontend/src/pages/admin/DoctorsPage.tsx`**

```tsx
import { FormEvent, useEffect, useState } from 'react';
import { AppShell, WorkPanel } from '../../components/AppShell';
import { FormField } from '../../components/FormField';
import { StatusMessage } from '../../components/StatusMessage';
import { supabase } from '../../lib/supabaseClient';

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

const adminNav = [
  { label: 'Panel', to: '/admin/dashboard' },
  { label: 'Medicos', to: '/admin/doctors' },
  { label: 'Especialidades', to: '/admin/specialties' },
  { label: 'Reportes', to: '/admin/reports' },
];

export function DoctorsPage() {
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [createdDoctors, setCreatedDoctors] = useState<CreatedDoctor[]>([]);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    supabase
      .from('especialidades')
      .select('id, nombre')
      .then(({ data }: { data: Specialty[] | null }) => setSpecialties(data ?? []));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setStatus(null);
    const form = new FormData(formElement);
    const especialidadId = String(form.get('especialidadId') ?? '');
    const especialidad = specialties.find((item) => item.id === especialidadId);

    const { error } = await supabase.from('medicos').insert({
      nombre: form.get('nombre'),
      apellido: form.get('apellido'),
      email: form.get('email'),
      telefono: form.get('telefono'),
      licencia: form.get('licencia'),
      especialidad_id: especialidadId,
    });

    if (error) {
      const message =
        error.code === '23505'
          ? 'Ya existe un médico con esta cédula profesional.'
          : error.message;
      setStatus({ tone: 'error', message });
      return;
    }

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
    setStatus({ tone: 'success', message: 'Médico registrado correctamente.' });
  }

  return (
    <AppShell title="Medicos" subtitle="Registro administrativo de profesionales y especialidades." navItems={adminNav}>
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test --workspace=apps/frontend -- DoctorsPage`
Expected: PASS — los 2 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/src/pages/admin/DoctorsPage.tsx apps/frontend/tests/DoctorsPage.test.tsx
git commit -m "feat(HU-04): registrar medico contra la tabla medicos de Supabase"
```

---

### Task 8: Smoke test de `App`, `CLAUDE.md` y verificación final

**Files:**
- Modify: `apps/frontend/tests/App.test.tsx`
- Modify: `CLAUDE.md`

**Interfaces:** ninguna nueva.

- [ ] **Step 1: Reescribir el smoke test — `apps/frontend/tests/App.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseMock } from './mocks/supabaseMock';

const supabaseMock = createSupabaseMock();

vi.mock('../src/lib/supabaseClient', () => ({ supabase: supabaseMock }));

import App from '../src/App';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null } });
    supabaseMock.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    window.history.pushState({}, '', '/');
  });

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
- **Backend:** Node.js + Express + TypeScript (solo `/health` en esta fase — Épica 1 corre directo contra Supabase)
- **Base de datos y autenticación:** Supabase (PostgreSQL + Supabase Auth), sin ORM — esquema en `supabase/migrations/*.sql`, aplicado a mano en el SQL Editor del dashboard
- **Validación:** Zod (frontend)
- **Testing:** Vitest (+ supertest en backend, + React Testing Library en frontend, mockeando `@supabase/supabase-js`)
- **Monorepo:** npm workspaces
```

Reemplazar la sección `## Cómo correr el proyecto` completa (incluida la nota de Prisma):

```markdown
## Cómo correr el proyecto

1. `npm install` en la raíz.
2. Copiar `apps/frontend/.env.example` a `apps/frontend/.env` con las credenciales de tu proyecto Supabase (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).
3. Aplicar los archivos de `supabase/migrations/` en el SQL Editor del dashboard de Supabase, en orden (ver `supabase/README.md`).
4. `npm run dev:backend` — levanta la API en `http://localhost:4000` (solo `GET /health`).
5. `npm run dev:frontend` — levanta el frontend en `http://localhost:5173`.
6. `npm test` — corre las pruebas de todos los workspaces.

## Notas de Épica 1 (Supabase)

- El registro, login, recuperación de contraseña y registro de médicos se hacen directo desde el frontend contra Supabase (`@supabase/supabase-js`), sin pasar por Express.
- El correo de recuperación de contraseña es real (lo envía Supabase Auth) — ya no hay mock.
- El bloqueo de cuenta tras 5 intentos fallidos vive en las funciones Postgres `check_login_lock`/`record_login_attempt` (`supabase/migrations/0004_login_attempts.sql`), no en Express.
- Para crear el primer usuario ADMIN, ver `supabase/README.md`.
```

Dejar sin cambios la sección `## Backlog` (HU-01..04 siguen marcadas como completadas — se reimplementaron, no se quitaron).

- [ ] **Step 4: Verificación final — instalar y correr todo**

Run: `npm install && npm test`
Expected: todos los tests de `apps/backend` y `apps/frontend` pasan.

- [ ] **Step 5: Commit**

```bash
git add apps/frontend/tests/App.test.tsx CLAUDE.md
git commit -m "docs: update CLAUDE.md for Supabase-based Epica 1, fix App smoke test"
```