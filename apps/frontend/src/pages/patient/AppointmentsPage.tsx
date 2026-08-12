import { FormEvent, useEffect, useState } from 'react';
import { AppShell, WorkPanel } from '../../components/AppShell';
import { StatusMessage } from '../../components/StatusMessage';
import { apiRequest, getSession } from '../../lib/api';
import { patientNavItems } from '../../lib/nav';

interface MedicoOption {
  id: string;
  nombre: string;
  apellido: string;
  especialidadId: string;
}

interface Cita {
  id: string;
  pacienteId: string;
  medicoId: string;
  especialidadId: string;
  fechaHora: string;
  estado: 'CONFIRMADA' | 'CANCELADA';
}

interface Reprogramacion {
  citaId: string;
  medicoId: string;
  fecha: string;
  franjas: string[];
  franjaSeleccionada: string;
}

export function AppointmentsPage() {
  const [medicos, setMedicos] = useState<MedicoOption[]>([]);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [reprogramacion, setReprogramacion] = useState<Reprogramacion | null>(null);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  async function cargarDatos() {
    const { token } = getSession();
    const [medicosRes, citasRes] = await Promise.all([
      apiRequest<{ medicos: MedicoOption[] }>('/api/medicos', { token }),
      apiRequest<{ citas: Cita[] }>('/api/citas', { token }),
    ]);
    setMedicos(medicosRes.medicos);
    setCitas(citasRes.citas);
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  function medicoLabel(medicoId: string) {
    const medico = medicos.find((m) => m.id === medicoId);
    return medico ? `Dr ${medico.nombre} ${medico.apellido}` : medicoId;
  }

  async function handleCancelar(citaId: string) {
    if (!window.confirm('¿Seguro que querés cancelar esta cita?')) {
      return;
    }
    setStatus(null);
    const { token } = getSession();
    try {
      const response = await apiRequest<{ message: string }>(`/api/citas/${citaId}/cancelar`, {
        method: 'PUT',
        token,
      });
      setStatus({ tone: 'success', message: response.message });
      await cargarDatos();
    } catch (error) {
      setStatus({ tone: 'error', message: (error as Error).message });
    }
  }

  function iniciarReprogramacion(cita: Cita) {
    setStatus(null);
    setReprogramacion({ citaId: cita.id, medicoId: cita.medicoId, fecha: '', franjas: [], franjaSeleccionada: '' });
  }

  async function handleNuevaFecha(fecha: string) {
    if (!reprogramacion) return;
    const { token } = getSession();
    const response = await apiRequest<{ franjas: string[] }>(
      `/api/citas/disponibilidad?medicoId=${reprogramacion.medicoId}&fecha=${fecha}`,
      { token }
    );
    setReprogramacion({ ...reprogramacion, fecha, franjas: response.franjas, franjaSeleccionada: '' });
  }

  async function handleConfirmarReprogramacion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reprogramacion) return;
    const { token } = getSession();

    try {
      const response = await apiRequest<{ message: string }>(`/api/citas/${reprogramacion.citaId}/reprogramar`, {
        method: 'PUT',
        token,
        body: { fechaHora: `${reprogramacion.fecha}T${reprogramacion.franjaSeleccionada}` },
      });
      setStatus({ tone: 'success', message: response.message });
      setReprogramacion(null);
      await cargarDatos();
    } catch (error) {
      setStatus({ tone: 'error', message: (error as Error).message });
    }
  }

  return (
    <AppShell title="Mis citas" subtitle="Consulta de solicitudes y proximas citas medicas." navItems={patientNavItems}>
      {status ? <StatusMessage tone={status.tone} message={status.message} /> : null}

      {citas.length ? (
        <div className="mt-4 grid gap-4">
          {citas.map((cita) => (
            <div key={cita.id} className="rounded-md border border-slate-200 bg-white p-4">
              <p className="font-semibold">{medicoLabel(cita.medicoId)}</p>
              <p className="mt-1 text-sm text-slate-600">{cita.fechaHora}</p>
              <p className="mt-1 text-sm font-semibold text-slate-700">{cita.estado}</p>
              {cita.estado === 'CONFIRMADA' ? (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    onClick={() => iniciarReprogramacion(cita)}
                  >
                    Reprogramar
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-rose-300 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                    onClick={() => handleCancelar(cita.id)}
                  >
                    Cancelar
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-600">Todavia no hay citas registradas.</p>
      )}

      {reprogramacion ? (
        <div className="mt-6">
          <WorkPanel title="Reprogramar cita">
            <form className="grid gap-4" onSubmit={handleConfirmarReprogramacion}>
              <label className="block text-sm font-semibold text-slate-700" htmlFor="nuevaFecha">
                Nueva fecha
                <input
                  id="nuevaFecha"
                  type="date"
                  required
                  value={reprogramacion.fecha}
                  onChange={(event) => handleNuevaFecha(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
                />
              </label>
              {reprogramacion.fecha ? (
                <label className="block text-sm font-semibold text-slate-700" htmlFor="nuevaHora">
                  Nueva hora
                  <select
                    id="nuevaHora"
                    required
                    value={reprogramacion.franjaSeleccionada}
                    onChange={(event) => setReprogramacion({ ...reprogramacion, franjaSeleccionada: event.target.value })}
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
                  >
                    <option value="">Seleccione una hora</option>
                    {reprogramacion.franjas.map((franja) => (
                      <option key={franja} value={franja}>
                        {franja}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <button className="rounded-md bg-teal-700 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-800 sm:w-fit">
                Confirmar nueva fecha
              </button>
            </form>
          </WorkPanel>
        </div>
      ) : null}
    </AppShell>
  );
}
