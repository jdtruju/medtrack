import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppShell, StatGrid, WorkPanel } from '../../components/AppShell';
import { apiRequest, getSession } from '../../lib/api';
import { patientNavItems } from '../../lib/nav';

interface CitaPaciente {
  id: string;
  fechaHora: string;
  estado: 'CONFIRMADA' | 'CANCELADA';
  recordatorioEnviado: boolean;
}

export function PatientDashboardPage() {
  const [citas, setCitas] = useState<CitaPaciente[]>([]);

  useEffect(() => {
    const { token } = getSession();
    apiRequest<{ citas: CitaPaciente[] }>('/api/citas', { token })
      .then((response) => setCitas(response.citas))
      .catch(() => setCitas([]));
  }, []);

  const activas = citas.filter((cita) => cita.estado === 'CONFIRMADA');
  const canceladas = citas.filter((cita) => cita.estado === 'CANCELADA');
  const proxima = activas[0];

  return (
    <AppShell title="Panel del paciente" subtitle="Resumen de citas y estado de la cuenta." navItems={patientNavItems}>
      <StatGrid
        stats={[
          { label: 'Citas activas', value: String(activas.length), detail: 'Reservas vigentes', tone: 'teal' },
          { label: 'Canceladas', value: String(canceladas.length), detail: 'Con motivo registrado', tone: 'rose' },
          { label: 'Recordatorios', value: String(activas.filter((cita) => cita.recordatorioEnviado).length), detail: '24h enviados', tone: 'amber' },
          { label: 'Estado', value: 'Activo', detail: 'Cuenta habilitada', tone: 'blue' },
        ]}
      />
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <WorkPanel title="Cuenta del paciente">
          {proxima ? (
            <p className="text-sm leading-6 text-slate-600">
              Tu proxima cita esta reservada para el {proxima.fechaHora.replace('T', ' a las ')}. Recibiras confirmacion
              y recordatorio desde el canal mock registrado por el sistema.
            </p>
          ) : (
            <p className="text-sm leading-6 text-slate-600">No tenes citas activas. Podes revisar disponibilidad y reservar un horario.</p>
          )}
        </WorkPanel>
        <WorkPanel title="Acceso rapido">
          <div className="flex flex-wrap gap-3">
            <Link className="inline-flex rounded-md bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800" to="/patient/appointments">
              Reservar cita
            </Link>
            <Link className="inline-flex rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" to="/patient/availability">
              Ver disponibilidad
            </Link>
          </div>
        </WorkPanel>
      </section>
    </AppShell>
  );
}