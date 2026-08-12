import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell, StatGrid, WorkPanel } from '../../components/AppShell';
import { apiRequest, Cita, diasSemana, getSession, Notificacion } from '../../lib/api';
import { adminNavItems } from '../../lib/nav';

interface ResumenAdmin {
  especialidades: number;
  medicos: number;
  horarios: number;
  citasReservadas: number;
  citasCanceladas: number;
  notificaciones: number;
  notificacionesPorTipo: Record<string, number>;
  citasPorEstado: Record<string, number>;
}

interface MedicosPorEspecialidad {
  especialidadId: string;
  nombre: string;
  medicos: number;
}

interface HorariosPorDia {
  diaSemana: string;
  horarios: number;
}

interface ReportesResponse {
  resumen: ResumenAdmin;
  actividad: Notificacion[];
  medicosPorEspecialidad: MedicosPorEspecialidad[];
  horariosPorDia: HorariosPorDia[];
  proximasCitas: Cita[];
}

export function ReportsPage() {
  const [data, setData] = useState<ReportesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const { token } = getSession();
    apiRequest<ReportesResponse>('/api/reportes/resumen', { token })
      .then((response) => {
        setData(response);
        setError('');
      })
      .catch((err) => {
        setData(null);
        setError((err as Error).message);
      })
      .finally(() => setLoading(false));
  }, []);

  const maxMedicosPorEspecialidad = useMemo(
    () => Math.max(1, ...(data?.medicosPorEspecialidad.map((item) => item.medicos) ?? [0])),
    [data],
  );
  const maxHorariosPorDia = useMemo(() => Math.max(1, ...(data?.horariosPorDia.map((item) => item.horarios) ?? [0])), [data]);

  const resumen = data?.resumen;

  return (
    <AppShell title="Reportes" subtitle="Indicadores reales para seguimiento de agenda, capacidad y notificaciones." navItems={adminNavItems}>
      {error ? <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div> : null}

      <StatGrid
        stats={[
          {
            label: 'Citas activas',
            value: loading ? '...' : String(resumen?.citasReservadas ?? 0),
            detail: 'Reservas vigentes',
            tone: 'teal',
          },
          {
            label: 'Cancelaciones',
            value: loading ? '...' : String(resumen?.citasCanceladas ?? 0),
            detail: 'Con motivo registrado',
            tone: 'rose',
          },
          {
            label: 'Capacidad',
            value: loading ? '...' : `${resumen?.medicos ?? 0}/${resumen?.horarios ?? 0}`,
            detail: 'Medicos y horarios',
            tone: 'blue',
          },
          {
            label: 'Notificaciones',
            value: loading ? '...' : String(resumen?.notificaciones ?? 0),
            detail: 'Auditoria de correos mock',
            tone: 'amber',
          },
        ]}
      />

      <section className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <WorkPanel title="Reporte operativo">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2 pr-4">Indicador</th>
                  <th className="py-2 pr-4">Valor</th>
                  <th className="py-2 pr-4">Proposito</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <ReportRow label="Confirmaciones" value={resumen?.notificacionesPorTipo.CONFIRMACION_RESERVA ?? 0} detail="Reservas con correo mock registrado" />
                <ReportRow label="Recordatorios 24h" value={resumen?.notificacionesPorTipo.RECORDATORIO_24H ?? 0} detail="Citas proximas procesadas por job" />
                <ReportRow label="Cancelaciones notificadas" value={resumen?.notificacionesPorTipo.CANCELACION_CITA ?? 0} detail="Cancelaciones con motivo auditable" />
                <ReportRow label="Especialidades" value={resumen?.especialidades ?? 0} detail="Catalogo disponible para asignar medicos" />
              </tbody>
            </table>
          </div>
        </WorkPanel>

        <WorkPanel title="Proximas citas">
          {loading ? (
            <p className="text-sm text-slate-600">Cargando citas...</p>
          ) : data?.proximasCitas.length ? (
            <div className="space-y-3">
              {data.proximasCitas.map((cita) => (
                <article key={cita.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-950">{cita.pacienteEmail}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {cita.fecha} · {cita.horaInicio}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              No hay citas activas.{' '}
              <Link className="font-semibold underline" to="/admin/schedules">
                Revisar disponibilidad
              </Link>
            </div>
          )}
        </WorkPanel>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <WorkPanel title="Medicos por especialidad">
          {loading ? (
            <p className="text-sm text-slate-600">Cargando especialidades...</p>
          ) : data?.medicosPorEspecialidad.length ? (
            <div className="space-y-3">
              {data.medicosPorEspecialidad.map((item) => (
                <MetricBar key={item.especialidadId} label={item.nombre} value={item.medicos} max={maxMedicosPorEspecialidad} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No hay especialidades registradas.</p>
          )}
        </WorkPanel>

        <WorkPanel title="Horarios por dia">
          {loading ? (
            <p className="text-sm text-slate-600">Cargando horarios...</p>
          ) : (
            <div className="space-y-3">
              {data?.horariosPorDia.map((item) => (
                <MetricBar key={item.diaSemana} label={diasSemana[item.diaSemana] ?? item.diaSemana} value={item.horarios} max={maxHorariosPorDia} />
              ))}
            </div>
          )}
        </WorkPanel>

        <WorkPanel title="Ultimos envios">
          {loading ? (
            <p className="text-sm text-slate-600">Cargando notificaciones...</p>
          ) : data?.actividad.length ? (
            <div className="space-y-3">
              {data.actividad.map((item) => (
                <article key={item.id} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-950">{item.tipo.replaceAll('_', ' ')}</p>
                  <p className="mt-1 break-words text-sm text-slate-600">{item.email}</p>
                  <p className="mt-1 text-xs text-slate-500">{new Date(item.enviadoEn).toLocaleString()}</p>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">Sin notificaciones registradas.</p>
          )}
        </WorkPanel>
      </section>
    </AppShell>
  );
}

function ReportRow({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <tr>
      <td className="py-3 pr-4 font-medium text-slate-950">{label}</td>
      <td className="py-3 pr-4">{value}</td>
      <td className="py-3 pr-4 text-slate-600">{detail}</td>
    </tr>
  );
}

function MetricBar({ label, value, max }: { label: string; value: number; max: number }) {
  const width = `${Math.max(4, Math.round((value / max) * 100))}%`;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
        <span className="truncate font-medium text-slate-700">{label}</span>
        <span className="font-semibold text-slate-950">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-teal-700" style={{ width }} />
      </div>
    </div>
  );
}
