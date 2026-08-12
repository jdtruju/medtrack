import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell, StatGrid, WorkPanel } from '../../components/AppShell';
import { apiRequest, getSession, Notificacion } from '../../lib/api';
import { adminNavItems } from '../../lib/nav';

interface ResumenAdmin {
  especialidades: number;
  medicos: number;
  horarios: number;
  citasReservadas: number;
  citasCanceladas: number;
  notificaciones: number;
}

export function AdminDashboardPage() {
  const [resumen, setResumen] = useState<ResumenAdmin | null>(null);
  const [actividad, setActividad] = useState<Notificacion[]>([]);

  useEffect(() => {
    const { token } = getSession();
    apiRequest<{ resumen: ResumenAdmin; actividad: Notificacion[] }>('/api/reportes/resumen', { token })
      .then((response) => {
        setResumen(response.resumen);
        setActividad(response.actividad);
      })
      .catch(() => {
        setResumen(null);
        setActividad([]);
      });
  }, []);

  return (
    <AppShell title="Panel administrativo" subtitle="Resumen operativo para gestion de MedTrack." navItems={adminNavItems}>
      <StatGrid
        stats={[
          { label: 'Medicos activos', value: String(resumen?.medicos ?? 0), detail: 'Profesionales registrados', tone: 'teal' },
          { label: 'Horarios', value: String(resumen?.horarios ?? 0), detail: 'Bloques configurados', tone: 'blue' },
          { label: 'Citas activas', value: String(resumen?.citasReservadas ?? 0), detail: 'Reservas vigentes', tone: 'amber' },
          { label: 'Notificaciones', value: String(resumen?.notificaciones ?? 0), detail: 'Correos mock registrados', tone: 'rose' },
        ]}
      />
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <WorkPanel title="Actividad reciente">
          {actividad.length ? (
            <div className="space-y-3">
              {actividad.map((item) => (
                <article key={item.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-900">{item.tipo.replaceAll('_', ' ')}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.email}</p>
                  <p className="mt-1 text-xs text-slate-500">{new Date(item.enviadoEn).toLocaleString()}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-slate-600">Todavia no hay notificaciones registradas.</p>
          )}
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
            Los medicos, horarios, citas y notificaciones se actualizan desde la API. El correo sigue en modo mock,
            pero cada envio queda registrado para auditoria.
          </p>
        </WorkPanel>
      </section>
    </AppShell>
  );
}
