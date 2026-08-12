import { Link } from 'react-router-dom';
import { AppShell, StatGrid, WorkPanel } from '../../components/AppShell';
import { adminNavItems } from '../../lib/nav';

export function AdminDashboardPage() {
  return (
    <AppShell title="Panel administrativo" subtitle="Resumen operativo para gestion de MedTrack." navItems={adminNavItems}>
      <StatGrid
        stats={[
          { label: 'Pacientes registrados', value: 'Supabase', detail: 'Auth y perfiles activos' },
          { label: 'Medicos activos', value: 'BD', detail: 'Datos persistentes' },
          { label: 'Especialidades', value: '3', detail: 'Catalogo inicial disponible' },
          { label: 'Alertas QA', value: '0', detail: 'Sin incidentes abiertos' },
        ]}
      />
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <WorkPanel title="Actividad reciente">
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li>Registro de pacientes habilitado con validacion de correo duplicado.</li>
            <li>Inicio de sesion protegido con bloqueo por intentos fallidos.</li>
            <li>Registro administrativo de medicos y horarios disponible.</li>
          </ul>
        </WorkPanel>
        <WorkPanel title="Acciones principales">
          <div className="grid gap-3 sm:grid-cols-2">
            <Link className="rounded-md bg-teal-700 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-teal-800" to="/admin/doctors">
              Registrar medico
            </Link>
            <Link className="rounded-md border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50" to="/admin/schedules">
              Gestionar horarios
            </Link>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            El sistema usa Supabase como base persistente y Express como capa segura de acceso.
          </p>
        </WorkPanel>
      </section>
    </AppShell>
  );
}
