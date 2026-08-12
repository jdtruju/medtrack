import { FormEvent, useEffect, useState } from 'react';
import { AppShell, WorkPanel } from '../../components/AppShell';
import { StatusMessage } from '../../components/StatusMessage';
import { apiRequest, getSession } from '../../lib/api';
import { adminNavItems } from '../../lib/nav';

interface MedicoOption {
  id: string;
  nombre: string;
  apellido: string;
}

interface Horario {
  id: string;
  medicoId: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
}

const dias = [
  { value: 'LUN', label: 'Lunes' },
  { value: 'MAR', label: 'Martes' },
  { value: 'MIE', label: 'Miercoles' },
  { value: 'JUE', label: 'Jueves' },
  { value: 'VIE', label: 'Viernes' },
  { value: 'SAB', label: 'Sabado' },
  { value: 'DOM', label: 'Domingo' },
];

export function SchedulesPage() {
  const [medicos, setMedicos] = useState<MedicoOption[]>([]);
  const [medicoId, setMedicoId] = useState('');
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [loadingMedicos, setLoadingMedicos] = useState(true);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const { token } = getSession();
    apiRequest<{ medicos: MedicoOption[] }>('/api/medicos', { token })
      .then((response) => setMedicos(response.medicos))
      .catch(() => setMedicos([]))
      .finally(() => setLoadingMedicos(false));
  }, []);

  useEffect(() => {
    if (!medicoId) {
      setHorarios([]);
      return;
    }
    const { token } = getSession();
    setLoadingHorarios(true);
    apiRequest<{ horarios: Horario[] }>(`/api/horarios?medicoId=${medicoId}`, { token })
      .then((response) => setHorarios(response.horarios))
      .catch(() => setHorarios([]))
      .finally(() => setLoadingHorarios(false));
  }, [medicoId]);

  async function refetchHorarios() {
    const { token } = getSession();
    const response = await apiRequest<{ horarios: Horario[] }>(`/api/horarios?medicoId=${medicoId}`, { token });
    setHorarios(response.horarios);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const form = new FormData(event.currentTarget);
    const { token } = getSession();

    try {
      const response = await apiRequest<{ message: string }>('/api/horarios', {
        method: 'POST',
        token,
        body: {
          medicoId,
          diaSemana: form.get('diaSemana'),
          horaInicio: form.get('horaInicio'),
          horaFin: form.get('horaFin'),
        },
      });
      setStatus({ tone: 'success', message: response.message });
      await refetchHorarios();
    } catch (error) {
      setStatus({ tone: 'error', message: (error as Error).message });
    }
  }

  async function handleDelete(id: string) {
    const { token } = getSession();
    await apiRequest(`/api/horarios/${id}`, { method: 'DELETE', token });
    await refetchHorarios();
  }

  return (
    <AppShell title="Horarios" subtitle="Configuracion de horarios disponibles por medico." navItems={adminNavItems}>
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <WorkPanel title="Seleccionar medico">
          <label className="block text-sm font-semibold text-slate-700" htmlFor="medicoId">
            Medico
            <select
              id="medicoId"
              value={medicoId}
              onChange={(event) => setMedicoId(event.target.value)}
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
            >
              <option value="">{loadingMedicos ? 'Cargando medicos...' : 'Seleccione un medico'}</option>
              {medicos.map((medico) => (
                <option key={medico.id} value={medico.id}>
                  {medico.nombre} {medico.apellido}
                </option>
              ))}
            </select>
          </label>

          {medicoId ? (
            <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
              <label className="block text-sm font-semibold text-slate-700" htmlFor="diaSemana">
                Dia
                <select
                  id="diaSemana"
                  name="diaSemana"
                  required
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
                >
                  {dias.map((dia) => (
                    <option key={dia.value} value={dia.value}>
                      {dia.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700" htmlFor="horaInicio">
                  Hora inicio
                  <input
                    id="horaInicio"
                    name="horaInicio"
                    type="time"
                    required
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700" htmlFor="horaFin">
                  Hora fin
                  <input
                    id="horaFin"
                    name="horaFin"
                    type="time"
                    required
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
                  />
                </label>
              </div>
              {status ? <StatusMessage tone={status.tone} message={status.message} /> : null}
              <button className="rounded-md bg-teal-700 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-800 sm:w-fit">
                Guardar horario
              </button>
            </form>
          ) : null}
        </WorkPanel>

        <WorkPanel title="Horarios configurados">
          {loadingHorarios ? (
            <p className="text-sm text-slate-600">Cargando horarios...</p>
          ) : horarios.length ? (
            <div className="space-y-3">
              {horarios.map((horario) => (
                <div key={horario.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3">
                  <span>
                    {horario.diaSemana} {horario.horaInicio} - {horario.horaFin}
                  </span>
                  <button
                    type="button"
                    className="rounded-md border border-rose-300 px-3 py-1.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                    onClick={() => handleDelete(horario.id)}
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">Este medico todavia no tiene horarios configurados.</p>
          )}
        </WorkPanel>
      </div>
    </AppShell>
  );
}
