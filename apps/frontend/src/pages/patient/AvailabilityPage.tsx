import { FormEvent, useEffect, useState } from 'react';
import { AppShell, WorkPanel } from '../../components/AppShell';
import { StatusMessage } from '../../components/StatusMessage';
import { apiRequest, getSession } from '../../lib/api';
import { patientNavItems } from '../../lib/nav';
import { supabase } from '../../lib/supabaseClient';

interface Especialidad {
  id: string;
  nombre: string;
}

interface Medico {
  id: string;
  nombre: string;
  apellido: string;
  especialidadId: string;
}

interface Horario {
  id: string;
  medicoId: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
}

interface Reserva {
  medicoId: string;
  fecha: string;
  franjas: string[];
  franjaSeleccionada: string;
}

export function AvailabilityPage() {
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [especialidadId, setEspecialidadId] = useState('');
  const [reserva, setReserva] = useState<Reserva | null>(null);
  const [reservaStatus, setReservaStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [franjaError, setFranjaError] = useState('');

  async function fetchAll() {
    const { token } = getSession();
    const [especialidadesRes, medicosRes] = await Promise.all([
      apiRequest<{ especialidades: Especialidad[] }>('/api/especialidades', { token }),
      apiRequest<{ medicos: Medico[] }>('/api/medicos', { token }),
    ]);
    setEspecialidades(especialidadesRes.especialidades);
    setMedicos(medicosRes.medicos);

    const query = especialidadId ? `?especialidadId=${especialidadId}` : '';
    const horariosRes = await apiRequest<{ horarios: Horario[] }>(`/api/horarios${query}`, { token });
    setHorarios(horariosRes.horarios);
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [especialidadId]);

  useEffect(() => {
    const channel = supabase
      .channel('horarios-disponibilidad')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'horarios' }, () => {
        fetchAll();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function medicoLabel(medicoId: string) {
    const medico = medicos.find((m) => m.id === medicoId);
    return medico ? `Dr ${medico.nombre} ${medico.apellido}` : medicoId;
  }

  function iniciarReserva(medicoId: string) {
    setReservaStatus(null);
    setFranjaError('');
    setReserva({ medicoId, fecha: '', franjas: [], franjaSeleccionada: '' });
  }

  function cerrarReserva() {
    setReserva(null);
  }

  useEffect(() => {
    if (!reserva) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') cerrarReserva();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reserva !== null]);

  async function handleFechaChange(fecha: string) {
    if (!reserva) return;
    setFranjaError('');
    setReserva({ ...reserva, fecha, franjas: [], franjaSeleccionada: '' });
    try {
      const { token } = getSession();
      const response = await apiRequest<{ franjas: string[] }>(
        `/api/citas/disponibilidad?medicoId=${reserva.medicoId}&fecha=${fecha}`,
        { token }
      );
      setReserva({ ...reserva, fecha, franjas: response.franjas, franjaSeleccionada: '' });
      if (!response.franjas.length) {
        setFranjaError('Este médico no atiende ese día, o ya no quedan franjas libres. Elegí otra fecha.');
      }
    } catch (error) {
      setFranjaError((error as Error).message);
    }
  }

  async function handleConfirmarReserva(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reserva || !reserva.franjaSeleccionada) return;
    const { token } = getSession();

    try {
      const response = await apiRequest<{ message: string }>('/api/citas', {
        method: 'POST',
        token,
        body: { medicoId: reserva.medicoId, fechaHora: `${reserva.fecha}T${reserva.franjaSeleccionada}` },
      });
      setReservaStatus({ tone: 'success', message: response.message });
      setReserva(null);
    } catch (error) {
      setReservaStatus({ tone: 'error', message: (error as Error).message });
    }
  }

  return (
    <AppShell title="Disponibilidad" subtitle="Consulte horarios disponibles por especialidad." navItems={patientNavItems}>
      <WorkPanel title="Filtrar por especialidad">
        <label className="block text-sm font-semibold text-slate-700" htmlFor="especialidadId">
          Especialidad
          <select
            id="especialidadId"
            value={especialidadId}
            onChange={(event) => setEspecialidadId(event.target.value)}
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
          >
            <option value="">Todas las especialidades</option>
            {especialidades.map((especialidad) => (
              <option key={especialidad.id} value={especialidad.id}>
                {especialidad.nombre}
              </option>
            ))}
          </select>
        </label>
      </WorkPanel>

      {reservaStatus ? (
        <div className="mt-4">
          <StatusMessage tone={reservaStatus.tone} message={reservaStatus.message} />
        </div>
      ) : null}

      <div className="mt-6 grid gap-4">
        {horarios.length ? (
          horarios.map((horario) => (
            <div key={horario.id} className="rounded-md border border-slate-200 bg-white p-4">
              <p className="font-semibold">{medicoLabel(horario.medicoId)}</p>
              <p className="mt-1 text-sm text-slate-600">
                {horario.diaSemana} {horario.horaInicio} - {horario.horaFin}
              </p>
              <button
                type="button"
                className="mt-3 rounded-md bg-teal-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-800"
                onClick={() => iniciarReserva(horario.medicoId)}
              >
                Reservar
              </button>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-600">No hay horarios disponibles con este filtro.</p>
        )}
      </div>

      {reserva ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          onClick={cerrarReserva}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reservarCitaTitulo"
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 id="reservarCitaTitulo" className="text-lg font-semibold">
                  Reservar cita
                </h2>
                <p className="mt-1 text-sm text-slate-600">{medicoLabel(reserva.medicoId)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Atiende:{' '}
                  {horarios
                    .filter((h) => h.medicoId === reserva.medicoId)
                    .map((h) => `${h.diaSemana} ${h.horaInicio}-${h.horaFin}`)
                    .join(' · ')}
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                className="text-slate-400 hover:text-slate-600"
                onClick={cerrarReserva}
              >
                ✕
              </button>
            </div>
            <form className="mt-4 grid gap-4" onSubmit={handleConfirmarReserva}>
              <label className="block text-sm font-semibold text-slate-700" htmlFor="fechaReserva">
                Fecha
                <input
                  id="fechaReserva"
                  type="date"
                  required
                  value={reserva.fecha}
                  onChange={(event) => handleFechaChange(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
                />
              </label>
              {reserva.fecha && reserva.franjas.length ? (
                <label className="block text-sm font-semibold text-slate-700" htmlFor="horaReserva">
                  Hora disponible
                  <select
                    id="horaReserva"
                    required
                    value={reserva.franjaSeleccionada}
                    onChange={(event) => setReserva({ ...reserva, franjaSeleccionada: event.target.value })}
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm"
                  >
                    <option value="">Seleccione una hora</option>
                    {reserva.franjas.map((franja) => (
                      <option key={franja} value={franja}>
                        {franja}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {franjaError ? <StatusMessage tone="error" message={franjaError} /> : null}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  className="rounded-md border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-50"
                  onClick={cerrarReserva}
                >
                  Cancelar
                </button>
                <button
                  disabled={!reserva.franjaSeleccionada}
                  className="rounded-md bg-teal-700 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Confirmar reserva
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
