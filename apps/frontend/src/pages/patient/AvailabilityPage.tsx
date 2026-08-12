import { useEffect, useState } from 'react';
import { AppShell, WorkPanel } from '../../components/AppShell';
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

export function AvailabilityPage() {
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  const [medicos, setMedicos] = useState<Medico[]>([]);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [especialidadId, setEspecialidadId] = useState('');

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
  }, []);

  function medicoLabel(medicoId: string) {
    const medico = medicos.find((m) => m.id === medicoId);
    return medico ? `Dr ${medico.nombre} ${medico.apellido}` : medicoId;
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

      <div className="mt-6 grid gap-4">
        {horarios.length ? (
          horarios.map((horario) => (
            <div key={horario.id} className="rounded-md border border-slate-200 bg-white p-4">
              <p className="font-semibold">{medicoLabel(horario.medicoId)}</p>
              <p className="mt-1 text-sm text-slate-600">
                {horario.diaSemana} {horario.horaInicio} - {horario.horaFin}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-600">No hay horarios disponibles con este filtro.</p>
        )}
      </div>
    </AppShell>
  );
}
