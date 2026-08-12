import { useEffect, useState } from 'react';
import { AppShell, WorkPanel } from '../../components/AppShell';
import { apiRequest, getSession } from '../../lib/api';
import { adminNavItems } from '../../lib/nav';

interface MedicoOption {
  id: string;
  nombre: string;
  apellido: string;
}

interface DisponibilidadItem {
  horarioId: string;
  medicoId: string;
  medicoNombre: string;
  medicoApellido: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  franjasTotales: number;
  franjasOcupadas: number;
  franjasLibres: number;
}

interface CitaReporteItem {
  id: string;
  medicoNombre: string;
  medicoApellido: string;
  pacienteNombre: string;
  pacienteApellido: string;
  fechaHora: string;
  estado: 'CONFIRMADA' | 'CANCELADA';
}

function medicoLabel(nombre: string, apellido: string) {
  return `Dr ${nombre} ${apellido}`;
}

export function ReportsPage() {
  const [medicos, setMedicos] = useState<MedicoOption[]>([]);

  const [medicoDisponibilidad, setMedicoDisponibilidad] = useState('');
  const [disponibilidad, setDisponibilidad] = useState<DisponibilidadItem[]>([]);

  const [medicoCitas, setMedicoCitas] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [citas, setCitas] = useState<CitaReporteItem[]>([]);

  useEffect(() => {
    const { token } = getSession();
    apiRequest<{ medicos: MedicoOption[] }>('/api/medicos', { token })
      .then((response) => setMedicos(response.medicos))
      .catch(() => setMedicos([]));
  }, []);

  useEffect(() => {
    const { token } = getSession();
    const query = medicoDisponibilidad ? `?medicoId=${medicoDisponibilidad}` : '';
    apiRequest<{ items: DisponibilidadItem[] }>(`/api/reportes/disponibilidad${query}`, { token })
      .then((response) => setDisponibilidad(response.items))
      .catch(() => setDisponibilidad([]));
  }, [medicoDisponibilidad]);

  useEffect(() => {
    const { token } = getSession();
    const params = new URLSearchParams();
    if (medicoCitas) params.set('medicoId', medicoCitas);
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    const query = params.toString() ? `?${params.toString()}` : '';
    apiRequest<{ items: CitaReporteItem[] }>(`/api/reportes/citas${query}`, { token })
      .then((response) => setCitas(response.items))
      .catch(() => setCitas([]));
  }, [medicoCitas, desde, hasta]);

  return (
    <AppShell
      title="Reportes"
      subtitle="Disponibilidad y citas para seguimiento operativo."
      navItems={adminNavItems}
    >
      <WorkPanel title="Disponibilidad por medico">
        <div className="flex flex-wrap items-end gap-4">
          <label
            className="block text-sm font-semibold text-slate-700"
            htmlFor="medicoDisponibilidad"
          >
            Medico
            <select
              id="medicoDisponibilidad"
              value={medicoDisponibilidad}
              onChange={(event) => setMedicoDisponibilidad(event.target.value)}
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
            >
              <option value="">Todos los medicos</option>
              {medicos.map((medico) => (
                <option key={medico.id} value={medico.id}>
                  {medico.nombre} {medico.apellido}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-2 pr-4">Medico</th>
                <th className="py-2 pr-4">Dia</th>
                <th className="py-2 pr-4">Hora inicio</th>
                <th className="py-2 pr-4">Hora fin</th>
                <th className="py-2 pr-4">Franjas totales</th>
                <th className="py-2 pr-4">Ocupadas</th>
                <th className="py-2 pr-4">Libres</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {disponibilidad.map((item) => (
                <tr key={item.horarioId}>
                  <td className="py-3 pr-4">
                    {medicoLabel(item.medicoNombre, item.medicoApellido)}
                  </td>
                  <td className="py-3 pr-4">{item.diaSemana}</td>
                  <td className="py-3 pr-4">{item.horaInicio}</td>
                  <td className="py-3 pr-4">{item.horaFin}</td>
                  <td className="py-3 pr-4">{item.franjasTotales}</td>
                  <td className="py-3 pr-4">{item.franjasOcupadas}</td>
                  <td className="py-3 pr-4">{item.franjasLibres}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {disponibilidad.length === 0 ? (
            <p className="mt-4 text-sm text-slate-600">Sin horarios para este filtro.</p>
          ) : null}
        </div>
      </WorkPanel>

      <div className="mt-6">
        <WorkPanel title="Citas">
          <div className="flex flex-wrap items-end gap-4">
            <label className="block text-sm font-semibold text-slate-700" htmlFor="medicoCitas">
              Medico
              <select
                id="medicoCitas"
                value={medicoCitas}
                onChange={(event) => setMedicoCitas(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
              >
                <option value="">Todos los medicos</option>
                {medicos.map((medico) => (
                  <option key={medico.id} value={medico.id}>
                    {medico.nombre} {medico.apellido}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700" htmlFor="desde">
              Desde
              <input
                id="desde"
                type="date"
                value={desde}
                onChange={(event) => setDesde(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-700" htmlFor="hasta">
              Hasta
              <input
                id="hasta"
                type="date"
                value={hasta}
                onChange={(event) => setHasta(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
              />
            </label>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2 pr-4">Paciente</th>
                  <th className="py-2 pr-4">Medico</th>
                  <th className="py-2 pr-4">Fecha y hora</th>
                  <th className="py-2 pr-4">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {citas.map((cita) => (
                  <tr key={cita.id}>
                    <td className="py-3 pr-4">
                      {cita.pacienteNombre} {cita.pacienteApellido}
                    </td>
                    <td className="py-3 pr-4">
                      {medicoLabel(cita.medicoNombre, cita.medicoApellido)}
                    </td>
                    <td className="py-3 pr-4">{cita.fechaHora}</td>
                    <td className="py-3 pr-4">{cita.estado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {citas.length === 0 ? (
              <p className="mt-4 text-sm text-slate-600">Sin citas para este filtro.</p>
            ) : null}
          </div>
        </WorkPanel>
      </div>
    </AppShell>
  );
}
