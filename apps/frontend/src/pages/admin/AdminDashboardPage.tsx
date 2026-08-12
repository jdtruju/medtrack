import { Link } from 'react-router-dom';
import { AppShell, StatGrid, WorkPanel } from '../../components/AppShell';

const adminNav = [
  { label: 'Panel', to: '/admin/dashboard' },
  { label: 'Medicos', to: '/admin/doctors' },
  { label: 'Especialidades', to: '/admin/specialties' },
  { label: 'Reportes', to: '/admin/reports' },
];

export function AdminDashboardPage() {
  return (
    <AppShell title="Panel administrativo" subtitle="Resumen operativo para gestion de MedTrack." navItems={adminNav}>
      <StatGrid
        stats={[
          { label: 'Pacientes registrados', value: 'Demo', detail: 'Memoria temporal activa' },
          { label: 'Medicos activos', value: 'Sesion', detail: 'Altas disponibles hasta reiniciar' },
          { label: 'Especialidades', value: '3', detail: 'Catalogo inicial disponible' },
          { label: 'Alertas QA', value: '0', detail: 'Sin incidentes abiertos' },
        ]}
      />
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <WorkPanel title="Actividad reciente">
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li>Registro de pacientes habilitado con validacion de correo duplicado.</li>
            <li>Inicio de sesion protegido con bloqueo por intentos fallidos.</li>
            <li>Registro administrativo de medicos disponible.</li>
          </ul>
        </WorkPanel>
        <WorkPanel title="Acciones principales">
          <div className="grid gap-3 sm:grid-cols-2">
            <Link className="rounded-md bg-teal-700 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-teal-800" to="/admin/doctors">
              Registrar medico
            </Link>
            <Link className="rounded-md border border-slate-300 px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50" to="/admin/reports">
              Ver reportes
            </Link>
          </div>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            El sistema esta corriendo sin base de datos persistente. Los datos se guardan en memoria durante la sesion
            del backend.
          </p>
        </WorkPanel>
      </section>
    </AppShell>
  );
}
