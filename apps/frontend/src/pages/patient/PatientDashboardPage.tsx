import { Link } from 'react-router-dom';
import { AppShell, StatGrid, WorkPanel } from '../../components/AppShell';
import { patientNavItems } from '../../lib/nav';

export function PatientDashboardPage() {
  return (
    <AppShell title="Panel del paciente" subtitle="Resumen de citas y estado de la cuenta." navItems={patientNavItems}>
      <StatGrid
        stats={[
          { label: 'Citas pendientes', value: '0', detail: 'Sin solicitudes activas' },
          { label: 'Citas completadas', value: '0', detail: 'Historial inicial' },
          { label: 'Notificaciones', value: '0', detail: 'Sin mensajes nuevos' },
          { label: 'Estado', value: 'Activo', detail: 'Cuenta habilitada' },
        ]}
      />
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <WorkPanel title="Cuenta del paciente">
          <p className="text-sm leading-6 text-slate-600">
            La cuenta esta lista para solicitar citas cuando se implemente la gestion de agenda en la siguiente epica.
          </p>
        </WorkPanel>
        <WorkPanel title="Acceso rapido">
          <Link className="inline-flex rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800" to="/patient/appointments">
            Ver mis citas
          </Link>
        </WorkPanel>
      </section>
    </AppShell>
  );
}
