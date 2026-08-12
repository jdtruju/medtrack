import { AppShell, WorkPanel } from '../../components/AppShell';

const adminNav = [
  { label: 'Panel', to: '/admin/dashboard' },
  { label: 'Medicos', to: '/admin/doctors' },
  { label: 'Especialidades', to: '/admin/specialties' },
  { label: 'Reportes', to: '/admin/reports' },
];

const specialties = ['Cardiologia', 'Pediatria', 'Medicina general'];

export function SpecialtiesPage() {
  return (
    <AppShell title="Especialidades" subtitle="Catalogo inicial usado para asignar medicos." navItems={adminNav}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {specialties.map((specialty) => (
          <article key={specialty} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold">{specialty}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Disponible para asignacion en el registro de medicos.</p>
            <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Activa</p>
          </article>
        ))}
      </div>
      <div className="mt-6">
        <WorkPanel title="Catalogo de Fase 1">
          <p className="text-sm leading-6 text-slate-600">
            La gestion completa del catalogo queda preparada para la siguiente etapa. En esta fase, las especialidades
            alimentan el registro administrativo de medicos.
          </p>
        </WorkPanel>
      </div>
    </AppShell>
  );
}
