import { AppShell, EmptyState, WorkPanel } from '../../components/AppShell';

const patientNav = [
  { label: 'Panel', to: '/patient/dashboard' },
  { label: 'Mis citas', to: '/patient/appointments' },
];

export function AppointmentsPage() {
  return (
    <AppShell title="Mis citas" subtitle="Consulta de solicitudes y proximas citas medicas." navItems={patientNav}>
      <EmptyState
        title="Todavia no hay citas registradas"
        detail="La creacion de citas corresponde a la siguiente epica. Por ahora esta vista queda lista para integrarse."
      />
      <div className="mt-6">
        <WorkPanel title="Proxima funcionalidad">
          <div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
            <p className="rounded-md bg-slate-50 p-3">Seleccion de especialidad</p>
            <p className="rounded-md bg-slate-50 p-3">Disponibilidad de medico</p>
            <p className="rounded-md bg-slate-50 p-3">Confirmacion por correo</p>
          </div>
        </WorkPanel>
      </div>
    </AppShell>
  );
}
