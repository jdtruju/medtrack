import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { AppShell, StatGrid, WorkPanel } from '../../components/AppShell';
import { apiRequest, getSession } from '../../lib/api';
import { adminNavItems } from '../../lib/nav';

interface OcupacionMedico {
  medicoId: string;
  nombre: string;
  apellido: string;
  franjasTotales: number;
  franjasOcupadas: number;
  porcentaje: number;
}

interface DashboardStats {
  totalCitas: number;
  totalPacientes: number;
  ocupacionPorMedico: OcupacionMedico[];
}

export function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    const { token } = getSession();
    apiRequest<{ stats: DashboardStats }>('/api/reportes/dashboard', { token })
      .then((response) => setStats(response.stats))
      .catch(() => setStats(null));
  }, []);

  const datosGrafico = (stats?.ocupacionPorMedico ?? []).map((item) => ({
    nombre: `Dr ${item.nombre} ${item.apellido}`,
    porcentaje: item.porcentaje,
  }));

  return (
    <AppShell
      title="Panel administrativo"
      subtitle="Resumen operativo para gestion de MedTrack."
      navItems={adminNavItems}
    >
      <StatGrid
        stats={[
          {
            label: 'Citas confirmadas',
            value: String(stats?.totalCitas ?? 0),
            detail: 'Historico',
          },
          {
            label: 'Pacientes registrados',
            value: String(stats?.totalPacientes ?? 0),
            detail: 'Total en el sistema',
          },
        ]}
      />
      <div className="mt-6">
        <WorkPanel title="Ocupacion por medico (esta semana)">
          {datosGrafico.length ? (
            <BarChart width={640} height={300} data={datosGrafico} className="mt-4">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="nombre" />
              <YAxis unit="%" domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="porcentaje" fill="#0f766e" />
            </BarChart>
          ) : (
            <p className="mt-4 text-sm text-slate-600">Sin datos de ocupacion todavia.</p>
          )}
        </WorkPanel>
      </div>
    </AppShell>
  );
}
