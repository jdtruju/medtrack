import { AppShell, StatGrid, WorkPanel } from '../../components/AppShell';

const adminNav = [
  { label: 'Panel', to: '/admin/dashboard' },
  { label: 'Medicos', to: '/admin/doctors' },
  { label: 'Especialidades', to: '/admin/specialties' },
  { label: 'Reportes', to: '/admin/reports' },
];

export function ReportsPage() {
  return (
    <AppShell title="Reportes" subtitle="Indicadores iniciales para seguimiento de calidad y operacion." navItems={adminNav}>
      <StatGrid
        stats={[
          { label: 'Citas pendientes', value: '8', detail: 'Muestra de referencia' },
          { label: 'Citas completadas', value: '16', detail: 'Ultimos 30 dias' },
          { label: 'Cancelaciones', value: '2', detail: 'Bajo observacion' },
          { label: 'Intentos fallidos', value: '0', detail: 'Bloqueos activos' },
        ]}
      />
      <WorkPanel title="Reporte de Sprint 1">
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-2 pr-4">Historia</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4">Cobertura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-3 pr-4">HU-01 Registro de Pacientes</td>
                <td className="py-3 pr-4">Completada</td>
                <td className="py-3 pr-4">Backend y frontend</td>
              </tr>
              <tr>
                <td className="py-3 pr-4">HU-02 Inicio de Sesion</td>
                <td className="py-3 pr-4">Completada</td>
                <td className="py-3 pr-4">Credenciales y bloqueo</td>
              </tr>
              <tr>
                <td className="py-3 pr-4">HU-03 Recuperar Contrasena</td>
                <td className="py-3 pr-4">Completada</td>
                <td className="py-3 pr-4">Correo mock y expiracion</td>
              </tr>
              <tr>
                <td className="py-3 pr-4">HU-04 Registrar Medico</td>
                <td className="py-3 pr-4">Completada</td>
                <td className="py-3 pr-4">Rol admin y duplicados</td>
              </tr>
            </tbody>
          </table>
        </div>
      </WorkPanel>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <WorkPanel title="Seguridad">
          <p className="text-sm leading-6 text-slate-600">Bloqueo tras 3 intentos fallidos, contrasenas hasheadas y token JWT para sesion.</p>
        </WorkPanel>
        <WorkPanel title="Calidad">
          <p className="text-sm leading-6 text-slate-600">Pruebas de backend y frontend cubren los criterios principales de aceptacion.</p>
        </WorkPanel>
        <WorkPanel title="Correo">
          <p className="text-sm leading-6 text-slate-600">Recuperacion simulada con registro del enlace en consola del backend.</p>
        </WorkPanel>
      </div>
    </AppShell>
  );
}
