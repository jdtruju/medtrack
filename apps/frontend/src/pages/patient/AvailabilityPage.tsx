import { useEffect, useState } from 'react';
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

interface Slot {
  fecha: string;
  hora: string;
}

interface Reserva {
  medicoId: string;
  cargando: boolean;
  slots: Slot[];
  seleccionado: Slot | null;
}

const DIAS_SEMANA_CODIGOS = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];
const HORIZONTE_DIAS = 21;

function formatearFechaISO(fecha: Date): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const d = String(fecha.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function diaSemanaDe(fechaISO: string): string {
  return DIAS_SEMANA_CODIGOS[new Date(`${fechaISO}T00:00:00`).getDay()]!;
}

function formatearFechaCorta(fechaISO: string): string {
  const [, mes, dia] = fechaISO.split('-') as [string, string, string];
  return `${dia}/${mes}`;
}

function proximasFechasParaDias(dias: Set<string>, horizonteDias = HORIZONTE_DIAS): string[] {
  const fechas: string[] = [];
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  for (let i = 0; i < horizonteDias; i += 1) {
    const candidata = new Date(hoy);
    candidata.setDate(hoy.getDate() + i);
    const fechaISO = formatearFechaISO(candidata);
    if (dias.has(diaSemanaDe(fechaISO))) {
      fechas.push(fechaISO);
    }
  }
  return fechas;
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

  async function iniciarReserva(medicoId: string) {
    setReservaStatus(null);
    setFranjaError('');
    setReserva({ medicoId, cargando: true, slots: [], seleccionado: null });

    const diasDelMedico = new Set(horarios.filter((h) => h.medicoId === medicoId).map((h) => h.diaSemana));
    const fechasCandidatas = proximasFechasParaDias(diasDelMedico);
    const { token } = getSession();

    try {
      const respuestas = await Promise.all(
        fechasCandidatas.map((fecha) =>
          apiRequest<{ franjas: string[] }>(`/api/citas/disponibilidad?medicoId=${medicoId}&fecha=${fecha}`, { token })
        )
      );
      const slots: Slot[] = fechasCandidatas.flatMap((fecha, index) =>
        respuestas[index]!.franjas.map((hora) => ({ fecha, hora }))
      );
      setReserva({ medicoId, cargando: false, slots, seleccionado: null });
    } catch (error) {
      setReserva({ medicoId, cargando: false, slots: [], seleccionado: null });
      setFranjaError((error as Error).message);
    }
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

  async function handleConfirmarReserva() {
    if (!reserva || !reserva.seleccionado) return;
    const { token } = getSession();

    try {
      const response = await apiRequest<{ message: string }>('/api/citas', {
        method: 'POST',
        token,
        body: { medicoId: reserva.medicoId, fechaHora: `${reserva.seleccionado.fecha}T${reserva.seleccionado.hora}` },
      });
      setReservaStatus({ tone: 'success', message: response.message });
      setReserva(null);
    } catch (error) {
      setFranjaError((error as Error).message);
    }
  }

  const fechasConSlots = reserva ? Array.from(new Set(reserva.slots.map((slot) => slot.fecha))) : [];

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

            <div className="mt-4">
              <p className="text-sm font-semibold text-slate-700">Horarios disponibles</p>

              {reserva.cargando ? (
                <p className="mt-3 text-sm text-slate-600">Buscando horarios disponibles...</p>
              ) : fechasConSlots.length ? (
                <div className="mt-3 grid max-h-72 gap-4 overflow-y-auto pr-1">
                  {fechasConSlots.map((fecha) => (
                    <div key={fecha}>
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        {diaSemanaDe(fecha)} {formatearFechaCorta(fecha)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {reserva.slots
                          .filter((slot) => slot.fecha === fecha)
                          .map((slot) => {
                            const activo =
                              reserva.seleccionado?.fecha === slot.fecha && reserva.seleccionado?.hora === slot.hora;
                            return (
                              <button
                                key={`${slot.fecha}-${slot.hora}`}
                                type="button"
                                onClick={() => setReserva({ ...reserva, seleccionado: slot })}
                                className={`rounded-md border px-3 py-1.5 text-sm font-semibold transition ${
                                  activo
                                    ? 'border-teal-700 bg-teal-700 text-white'
                                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                {slot.hora}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-600">
                  No hay horarios libres en las próximas tres semanas para este médico.
                </p>
              )}

              {franjaError ? (
                <div className="mt-3">
                  <StatusMessage tone="error" message={franjaError} />
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-md border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-50"
                onClick={cerrarReserva}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!reserva.seleccionado}
                onClick={handleConfirmarReserva}
                className="rounded-md bg-teal-700 px-4 py-2.5 font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirmar reserva
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}
