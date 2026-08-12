import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AppShell, WorkPanel } from '../../components/AppShell';
import { StatusMessage } from '../../components/StatusMessage';
import { apiRequest, Cita, diasSemana, Especialidad, getSession, Horario, Medico } from '../../lib/api';
import { patientNavItems } from '../../lib/nav';

export function AppointmentsPage() {
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [citas, setCitas] = useState<Cita[]>([]);
  const [especialidadId, setEspecialidadId] = useState('');
  const [medicoId, setMedicoId] = useState('');
  const [horarioId, setHorarioId] = useState('');
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [cancelandoId, setCancelandoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const medicosFiltrados = useMemo(
    () => medicos.filter((medico) => !especialidadId || medico.especialidadId === especialidadId),
    [especialidadId, medicos],
  );
  const horariosFiltrados = useMemo(
    () => horarios.filter((horario) => !medicoId || horario.medicoId === medicoId),
    [horarios, medicoId],
  );

  async function fetchData() {
    const { token } = getSession();
    const [especialidadesRes, medicosRes, horariosRes, citasRes] = await Promise.all([
      apiRequest<{ especialidades: Especialidad[] }>('/api/especialidades', { token }),
      apiRequest<{ medicos: Medico[] }>('/api/medicos', { token }),
      apiRequest<{ horarios: Horario[] }>('/api/horarios', { token }),
      apiRequest<{ citas: Cita[] }>('/api/citas', { token }),
    ]);
    setEspecialidades(especialidadesRes.especialidades);
    setMedicos(medicosRes.medicos);
    setHorarios(horariosRes.horarios);
    setCitas(citasRes.citas);
  }

  useEffect(() => {
    fetchData()
      .catch(() => {
        setEspecialidades([]);
        setMedicos([]);
        setHorarios([]);
        setCitas([]);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleReservar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    const form = new FormData(event.currentTarget);
    const horario = horarios.find((item) => item.id === horarioId);
    const { token } = getSession();

    if (!horario) {
      setStatus({ tone: 'error', message: 'Seleccione un horario disponible.' });
      return;
    }

    try {
      const response = await apiRequest<{ message: string }>('/api/citas', {
        method: 'POST',
        token,
        body: {
          medicoId: horario.medicoId,
          horarioId: horario.id,
          fecha: form.get('fecha'),
          horaInicio: horario.horaInicio,
        },
      });
      setStatus({ tone: 'success', message: `${response.message} Se registro la confirmacion por correo mock.` });
      setHorarioId('');
      await fetchData();
    } catch (error) {
      setStatus({ tone: 'error', message: (error as Error).message });
    }
  }

  async function handleCancelar(event: FormEvent<HTMLFormElement>, citaId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const { token } = getSession();

    try {
      const response = await apiRequest<{ message: string }>(`/api/citas/${citaId}/cancelar`, {
        method: 'POST',
        token,
        body: { motivo: form.get('motivo') },
      });
      setStatus({ tone: 'success', message: `${response.message} Se registro la notificacion de cancelacion.` });
      setCancelandoId(null);
      await fetchData();
    } catch (error) {
      setStatus({ tone: 'error', message: (error as Error).message });
    }
  }

  function medicoLabel(id: string) {
    const medico = medicos.find((item) => item.id === id);
    return medico ? `Dr. ${medico.nombre} ${medico.apellido}` : 'Medico no disponible';
  }

  return (
    <AppShell title="Mis citas" subtitle="Reserva, consulta y cancela tus citas medicas." navItems={patientNavItems}>
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <WorkPanel title="Reservar cita">
          <form className="grid gap-4" onSubmit={handleReservar}>
            <label className="block text-sm font-semibold text-slate-700" htmlFor="especialidadId">
              Especialidad
              <select
                id="especialidadId"
                value={especialidadId}
                onChange={(event) => {
                  setEspecialidadId(event.target.value);
                  setMedicoId('');
                  setHorarioId('');
                }}
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
              >
                <option value="">{loading ? 'Cargando especialidades...' : 'Todas las especialidades'}</option>
                {especialidades.map((especialidad) => (
                  <option key={especialidad.id} value={especialidad.id}>
                    {especialidad.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-semibold text-slate-700" htmlFor="medicoId">
              Medico
              <select
                id="medicoId"
                value={medicoId}
                onChange={(event) => {
                  setMedicoId(event.target.value);
                  setHorarioId('');
                }}
                required
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
              >
                <option value="">{loading ? 'Cargando medicos...' : 'Seleccione un medico'}</option>
                {medicosFiltrados.map((medico) => (
                  <option key={medico.id} value={medico.id}>
                    Dr. {medico.nombre} {medico.apellido}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-semibold text-slate-700" htmlFor="horarioId">
              Horario
              <select
                id="horarioId"
                value={horarioId}
                onChange={(event) => setHorarioId(event.target.value)}
                required
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
              >
                <option value="">{loading ? 'Cargando horarios...' : 'Seleccione un horario'}</option>
                {horariosFiltrados.map((horario) => (
                  <option key={horario.id} value={horario.id}>
                    {diasSemana[horario.diaSemana]} · {horario.horaInicio} - {horario.horaFin}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-semibold text-slate-700" htmlFor="fecha">
              Fecha
              <input
                id="fecha"
                name="fecha"
                type="date"
                required
                min={new Date().toISOString().slice(0, 10)}
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
              />
            </label>

            {status ? <StatusMessage tone={status.tone} message={status.message} /> : null}
            <button className="rounded-md bg-teal-700 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-800 sm:w-fit">
              Confirmar reserva
            </button>
          </form>
        </WorkPanel>

        <WorkPanel title="Citas registradas">
          {loading ? (
            <p className="text-sm leading-6 text-slate-600">Cargando citas...</p>
          ) : citas.length ? (
            <div className="space-y-3">
              {citas.map((cita) => (
                <article key={cita.id} className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold">{medicoLabel(cita.medicoId)}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {cita.fecha} · {cita.horaInicio}
                      </p>
                      {cita.motivoCancelacion ? <p className="mt-1 text-sm text-rose-700">Motivo: {cita.motivoCancelacion}</p> : null}
                    </div>
                    <span
                      className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                        cita.estado === 'RESERVADA' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
                      }`}
                    >
                      {cita.estado}
                    </span>
                  </div>

                  {cita.estado === 'RESERVADA' ? (
                    cancelandoId === cita.id ? (
                      <form className="mt-3 grid gap-2" onSubmit={(event) => handleCancelar(event, cita.id)}>
                        <input
                          name="motivo"
                          required
                          minLength={5}
                          placeholder="Motivo de cancelacion"
                          className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm shadow-sm"
                        />
                        <div className="flex gap-2">
                          <button className="rounded-md bg-rose-700 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-800">Cancelar cita</button>
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                            onClick={() => setCancelandoId(null)}
                          >
                            Volver
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        type="button"
                        className="mt-3 rounded-md border border-rose-300 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
                        onClick={() => setCancelandoId(cita.id)}
                      >
                        Cancelar con motivo
                      </button>
                    )
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-slate-600">Aun no tenes citas. Cuando reserves, la confirmacion quedara registrada automaticamente.</p>
          )}
        </WorkPanel>
      </div>
    </AppShell>
  );
}
