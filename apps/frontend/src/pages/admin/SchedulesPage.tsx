import { FormEvent, useEffect, useState } from 'react';
import { AppShell, WorkPanel } from '../../components/AppShell';
import { StatusMessage } from '../../components/StatusMessage';
import { apiRequest, getSession } from '../../lib/api';
import { adminNavItems } from '../../lib/nav';

interface Medico {
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

const dias = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'];

export function SchedulesPage() {
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const { token } = getSession();

  async function loadData() {
    const [medicosRes, horariosRes] = await Promise.all([
      apiRequest<{ medicos: Medico[] }>('/api/medicos', { token }),
      apiRequest<{ horarios: Horario[] }>('/api/horarios', { token }),
    ]);
    setMedicos(medicosRes.medicos);
    setHorarios(horariosRes.horarios);
  }

  useEffect(() => {
    loadData().catch(() => setStatus({ tone: 'error', message: 'No se pudieron cargar los horarios.' }));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setStatus(null);

    try {
      const response = await apiRequest<{ message: string; horario: Horario }>('/api/horarios', {
        method: 'POST',
        token,
        body: {
          medicoId: form.get('medicoId'),
          diaSemana: form.get('diaSemana'),
          horaInicio: form.get('horaInicio'),
          horaFin: form.get('horaFin'),
        },
      });
      setHorarios((current) => [response.horario, ...current]);
      formElement.reset();
      setStatus({ tone: 'success', message: response.message });
    } catch (error) {
      setStatus({ tone: 'error', message: (error as Error).message });
    }
  }

  function medicoLabel(id: string) {
    const medico = medicos.find((item) => item.id === id);
    return medico ? `Dr ${medico.nombre} ${medico.apellido}` : id;
  }

  return (
    <AppShell title="Horarios" subtitle="Gestion de disponibilidad medica por dia y rango horario." navItems={adminNavItems}>
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <WorkPanel title="Crear horario">
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <label className="block text-sm font-semibold text-slate-700" htmlFor="medicoId">
              Medico
              <select
                id="medicoId"
                name="medicoId"
                required
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
              >
                <option value="">Seleccione un medico</option>
                {medicos.map((medico) => (
                  <option key={medico.id} value={medico.id}>
                    Dr {medico.nombre} {medico.apellido}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold text-slate-700" htmlFor="diaSemana">
              Dia
              <select
                id="diaSemana"
                name="diaSemana"
                required
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
              >
                {dias.map((dia) => (
                  <option key={dia} value={dia}>
                    {dia}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700" htmlFor="horaInicio">
                Hora inicio
                <input id="horaInicio" name="horaInicio" type="time" required className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5" />
              </label>
              <label className="block text-sm font-semibold text-slate-700" htmlFor="horaFin">
                Hora fin
                <input id="horaFin" name="horaFin" type="time" required className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5" />
              </label>
            </div>
            {status ? <StatusMessage tone={status.tone} message={status.message} /> : null}
            <button className="rounded-md bg-teal-700 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-800 sm:w-fit">
              Guardar horario
            </button>
          </form>
        </WorkPanel>

        <WorkPanel title="Horarios registrados">
          <div className="grid gap-3">
            {horarios.length ? (
              horarios.map((horario) => (
                <article key={horario.id} className="rounded-md border border-slate-200 p-4">
                  <p className="font-semibold">{medicoLabel(horario.medicoId)}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {horario.diaSemana} {horario.horaInicio} - {horario.horaFin}
                  </p>
                </article>
              ))
            ) : (
              <p className="text-sm text-slate-600">Aun no hay horarios registrados.</p>
            )}
          </div>
        </WorkPanel>
      </div>
    </AppShell>
  );
}
