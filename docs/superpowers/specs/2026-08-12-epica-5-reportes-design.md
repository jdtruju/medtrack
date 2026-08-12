# Épica 5 — Reportes y Dashboard Administrativo (Design)

## Contexto

Backlog: HU-13 (Reporte de Disponibilidad), HU-14 (Reporte de Citas), HU-15 (Dashboard
Administrativo). Épica 4 (Notificaciones) queda pendiente y no se toca en este diseño —
el equipo decidió adelantar Épica 5.

Todos los datos que necesitan estos reportes ya existen en las tablas `citas`, `horarios`,
`medicos` y `perfiles` (creadas en Épicas 1-3). No se agrega ninguna tabla ni migración SQL:
un reporte es una vista calculada al momento de la petición, no una entidad persistente.

## Backend

### Nuevos tipos en `apps/backend/src/services/appServices.ts`

```ts
export interface OcupacionMedico {
  medicoId: string;
  nombre: string;
  apellido: string;
  franjasTotales: number;
  franjasOcupadas: number;
  porcentaje: number; // 0-100, redondeado a entero
}

export interface DashboardStats {
  totalCitas: number; // conteo de citas con estado CONFIRMADA, histórico
  totalPacientes: number;
  ocupacionPorMedico: OcupacionMedico[];
}

export interface DisponibilidadReporteItem {
  horarioId: string;
  medicoId: string;
  medicoNombre: string;
  medicoApellido: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  franjasTotales: number;
  franjasOcupadas: number;
  franjasLibres: number;
}

export interface CitaReporteItem extends Cita {
  medicoNombre: string;
  medicoApellido: string;
  pacienteNombre: string;
  pacienteApellido: string;
}

export interface CitasReporteFilters {
  medicoId?: string;
  desde?: string; // YYYY-MM-DD, inclusive
  hasta?: string; // YYYY-MM-DD, inclusive
}

export interface ReportesService {
  dashboard(hoy: string): Promise<DashboardStats>;
  disponibilidad(hoy: string, medicoId?: string): Promise<DisponibilidadReporteItem[]>;
  citas(filters: CitasReporteFilters): Promise<CitaReporteItem[]>;
}
```

`AppServices` gana un campo `reportes: ReportesService`.

### Por qué `hoy: string` es un parámetro obligatorio

"Esta semana" depende de la fecha real de ejecución. Si el cálculo de la semana viviera
dentro del service usando `new Date()` internamente, las pruebas dependerían de la fecha en
que se ejecutan (frágil) o necesitarían mockear el reloj global. Al recibir `hoy` como
parámetro, las rutas Express lo calculan una sola vez
(`new Date().toISOString().slice(0, 10)`) y las pruebas pasan cualquier fecha fija
arbitraria, construyendo horarios/citas relativos a esa fecha — deterministas sin mockear
nada.

### Nuevos helpers puros en `apps/backend/src/lib/citasSlots.ts`

```ts
// Devuelve el lunes y el domingo (YYYY-MM-DD) de la semana que contiene `hoy`.
export function rangoSemanaActual(hoy: string): { inicio: string; fin: string };

// Dado el lunes de una semana (YYYY-MM-DD) y un día ('LUN'..'SAB'), devuelve la fecha
// (YYYY-MM-DD) de ese día dentro de esa semana.
export function fechaDeDiaEnSemana(inicioSemana: string, diaSemana: string): string;
```

Ambas se apoyan en la misma constante `DIAS_SEMANA` que ya usa `diaSemanaDeFecha`.

### Cálculo de ocupación (usado por `dashboard` y `disponibilidad`)

Para un médico y un horario recurrente (`diaSemana`, `horaInicio`, `horaFin`):
1. `franjas = generarFranjas(horaInicio, horaFin)` → total de franjas de ese bloque.
2. `fecha = fechaDeDiaEnSemana(rangoSemanaActual(hoy).inicio, diaSemana)` → la fecha concreta
   de ese bloque esta semana.
3. `ocupadas = citas.filter(c => c.medicoId === medicoId && c.estado === 'CONFIRMADA' && c.fechaHora.startsWith(fecha)).length`
   acotado a las horas que están en `franjas`.
4. `libres = franjas.length - ocupadas`.

`dashboard()` suma esto sobre todos los horarios de cada médico para obtener
`franjasTotales`/`franjasOcupadas` por médico, y calcula
`porcentaje = franjasTotales === 0 ? 0 : Math.round((franjasOcupadas / franjasTotales) * 100)`.
Incluye a todos los médicos registrados, aunque no tengan horarios (0%).

`disponibilidad(hoy, medicoId?)` devuelve una fila por bloque de horario (no agregado por
médico), filtrando por `medicoId` si se pasa.

### Reporte de citas

`citas(filters)` devuelve todas las citas (cualquier estado) que:
- coincidan con `medicoId` si se pasa,
- tengan `fechaHora` dentro de `[desde, hasta]` inclusive si se pasan (comparación de string
  funciona porque el formato es `YYYY-MM-DDTHH:mm`, orden lexicográfico = orden cronológico),

y las enriquece con `medicoNombre`/`medicoApellido` (de `medicos`) y
`pacienteNombre`/`pacienteApellido` (de `perfiles` en Supabase, o del array `users` en el
fake). Esto evita tener que exponer un endpoint nuevo de "listar pacientes" solo para
mostrar nombres en un reporte.

### Nuevas rutas — `apps/backend/src/routes/reportes.ts`

Montadas en `/api/reportes` desde `routes/index.ts`. Todas usan
`requireAuth(services)` + `requireRole(services, 'ADMIN')`.

- `GET /api/reportes/dashboard` → `{ stats: DashboardStats }`
- `GET /api/reportes/disponibilidad?medicoId=` → `{ items: DisponibilidadReporteItem[] }`
- `GET /api/reportes/citas?medicoId=&desde=&hasta=` → `{ items: CitaReporteItem[] }`

Las tres rutas calculan `hoy` con `new Date().toISOString().slice(0, 10)` y lo pasan al
service correspondiente (solo aplica a `dashboard`/`disponibilidad`).

## Frontend

### `AdminDashboardPage.tsx` (reemplaza el contenido de demostración actual)

- `StatGrid` con `totalCitas` y `totalPacientes` reales desde
  `GET /api/reportes/dashboard`, reemplazando los valores fijos ("Demo", "Sesion") que hay
  hoy.
- `WorkPanel` con un `BarChart` de Recharts: una barra por médico, eje Y =
  `porcentaje`. El tooltip muestra `franjasOcupadas / franjasTotales`.
- Si `ocupacionPorMedico` está vacío, se muestra un mensaje ("Sin datos de ocupación
  todavía") en vez de un gráfico vacío.

### `ReportsPage.tsx` (reemplazo completo)

El contenido actual está desactualizado (menciona JWT y "3 intentos fallidos", ya no
aplica desde la migración a Express+Supabase) y se reemplaza por completo.

Dos secciones independientes, cada una con su filtro propio y botón "Exportar PDF":

1. **Disponibilidad (HU-13)** — selector de médico (opcional, "todos" por defecto) →
   tabla con columnas Día, Hora inicio, Hora fin, Franjas totales, Ocupadas, Libres, vía
   `GET /api/reportes/disponibilidad`.
2. **Citas (HU-14)** — selectores de médico + fecha desde/hasta → tabla con columnas
   Paciente, Médico, Fecha/Hora, Estado, vía `GET /api/reportes/citas`.

Cambiar cualquier filtro vuelve a pedir los datos (mismo patrón que `SchedulesPage`).

### Exportar a PDF — `apps/frontend/src/lib/exportPdf.ts`

```ts
export function exportarTablaPdf(titulo: string, columnas: string[], filas: string[][]): void
```

Usa `jsPDF` + `jspdf-autotable` para generar el PDF en el navegador a partir de los datos
ya filtrados que están en pantalla (no pide nada nuevo al backend) y dispara la descarga
con `doc.save(...)`. Cada sección de `ReportsPage` construye sus columnas/filas y llama a
este helper al hacer clic en "Exportar PDF".

**Por qué cliente y no servidor:** el PDF no necesita la `service_role key` de Supabase —
son datos que el frontend ya recibió por la API normal, solo se formatean como PDF. Hacerlo
en el servidor agregaría una dependencia pesada (Puppeteer/Chromium o una librería de layout
manual) sin beneficio real para el objetivo del curso.

### Nuevas dependencias — `apps/frontend/package.json`

`recharts`, `jspdf`, `jspdf-autotable`.

## Testing

**Backend:**
- `citasSlots.test.ts` — casos nuevos para `rangoSemanaActual` y `fechaDeDiaEnSemana`.
- `inMemoryServices.test.ts` — casos nuevos para `reportes.dashboard()`,
  `reportes.disponibilidad()`, `reportes.citas()`, todos con una fecha `hoy` fija elegida en
  el test (no depende de la fecha real de ejecución).
- `reportes.test.ts` (nuevo, supertest sobre las rutas HTTP) — incluye caso explícito de
  **403 si un PACIENTE intenta acceder** a cualquiera de las tres rutas, y casos de
  filtrado por `medicoId`/`desde`/`hasta` en `/citas`.

**Frontend:**
- `AdminDashboardPage.test.tsx` — verifica que los stats vengan del fetch mockeado y que el
  gráfico reciba los datos de ocupación correctos.
- `ReportsPage.test.tsx` — cambiar un filtro dispara el fetch con los query params
  correctos; clic en "Exportar PDF" llama a `jspdf`/`jspdf-autotable` (mockeados igual que
  ya se mockea `supabaseClient`) con las columnas/filas visibles en pantalla.

**Riesgo técnico anotado:** Recharts usa `ResponsiveContainer`, que mide el contenedor vía
`ResizeObserver`; en jsdom el tamaño siempre es 0×0 y el SVG no se renderiza. En los tests,
el `BarChart` se renderiza con ancho/alto fijos (sin `ResponsiveContainer`) para evitar este
problema, y las aserciones se hacen sobre los datos que recibe el componente, no sobre
píxeles del SVG.

## Fuera de alcance

- Épica 4 (Notificaciones) — sigue pendiente, no se toca en esta épica.
- Exportar a CSV/Excel — no se pidió, solo PDF.
- Paginación en el reporte de citas — dataset chico de un proyecto académico, no se
  justifica.
- Cambios a RLS de Supabase — no aplica, el backend ya usa `service_role key` y lee sin
  restricción de RLS.
- Actualización en tiempo real (Realtime) de los reportes — se recalculan al pedirlos, no
  hace falta suscripción.