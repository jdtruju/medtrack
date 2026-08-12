# MedTrack

Sistema de gestion de citas medicas con enfoque en calidad y seguridad de software.

Proyecto academico MedTrack, ULACIT, II Cuatrimestre 2026.

## Estado actual

- Frontend: React, TypeScript, Vite, Tailwind CSS y React Router.
- Backend: Node.js, Express y TypeScript.
- Base de datos y autenticacion: Supabase.
- Pruebas: Vitest, Supertest y React Testing Library.

El frontend no habla directo con la base para operaciones sensibles. Las pantallas consumen la API de Express en `/api/...`; el backend usa Supabase con la `service_role key`.

## Como correr

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Crear los archivos de entorno:

   - `apps/backend/.env`
   - `apps/frontend/.env`

   Usa como guia los archivos `.env.example`.

3. Aplicar las migraciones SQL en Supabase:

   - Ver instrucciones en `supabase/README.md`.

4. Levantar backend:

   ```bash
   npm run dev:backend
   ```

5. Levantar frontend:

   ```bash
   npm run dev:frontend
   ```

6. Abrir la URL que muestre Vite, por ejemplo:

   ```text
   http://localhost:5173/login
   ```

## Verificacion

```bash
npm run lint
npm test
npm run build
```
