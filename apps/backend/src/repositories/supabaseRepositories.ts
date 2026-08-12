import { diaSemanaDeFecha, generarFranjas } from '../lib/citasSlots';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AppServices,
  AuthService,
  CitasService,
  Especialidad,
  EspecialidadesService,
  Horario,
  HorariosService,
  Medico,
  MedicosService,
} from '../services/appServices';

export function createSupabaseServices(client: SupabaseClient, frontendUrl: string): AppServices {
  const auth: AuthService = {
    async register({ nombre, apellido, email, telefono, password }) {
      const { error } = await client.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nombre, apellido, telefono },
      });

      if (error) {
        const isDuplicate = error.message.toLowerCase().includes('already');
        return {
          ok: false,
          error: {
            status: isDuplicate ? 409 : 400,
            message: isDuplicate
              ? 'Este correo ya está registrado. Por favor inicia sesión o usa otro correo.'
              : error.message,
          },
        };
      }

      return { ok: true, value: undefined };
    },

    async login(email, password) {
      const { data: lock } = await client.rpc('check_login_lock', { p_email: email });
      if (lock?.bloqueado) {
        return {
          ok: false,
          error: { status: 403, message: 'Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.' },
        };
      }

      const { data, error } = await client.auth.signInWithPassword({ email, password });

      if (error || !data.session || !data.user) {
        const { data: attempt } = await client.rpc('record_login_attempt', { p_email: email, p_exitoso: false });
        if (attempt?.bloqueado) {
          return {
            ok: false,
            error: { status: 403, message: 'Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.' },
          };
        }
        return {
          ok: false,
          error: {
            status: 401,
            message: `Correo o contraseña incorrectos. Intento ${attempt?.intentos ?? 1} de 5.`,
          },
        };
      }

      await client.rpc('record_login_attempt', { p_email: email, p_exitoso: true });

      const { data: perfil } = await client
        .from('perfiles')
        .select('nombre, apellido, rol')
        .eq('id', data.user.id)
        .single();

      return {
        ok: true,
        value: {
          token: data.session.access_token,
          usuario: {
            id: data.user.id,
            email: data.user.email ?? email,
            nombre: perfil?.nombre ?? '',
            apellido: perfil?.apellido ?? '',
            rol: (perfil?.rol as 'PACIENTE' | 'ADMIN') ?? 'PACIENTE',
          },
        },
      };
    },

    async forgotPassword(email) {
      await client.auth.resetPasswordForEmail(email, { redirectTo: `${frontendUrl}/reset-password` });
    },

    async resetPassword(accessToken, password) {
      const { data, error } = await client.auth.getUser(accessToken);
      if (error || !data.user) {
        return { ok: false, error: { status: 400, message: 'Este enlace ha expirado. Por favor solicita uno nuevo.' } };
      }

      const { error: updateError } = await client.auth.admin.updateUserById(data.user.id, { password });
      if (updateError) {
        return { ok: false, error: { status: 400, message: 'Este enlace ha expirado. Por favor solicita uno nuevo.' } };
      }

      return { ok: true, value: undefined };
    },

    async getUserFromToken(token) {
      const { data, error } = await client.auth.getUser(token);
      if (error || !data.user) return null;
      return { id: data.user.id, email: data.user.email ?? '' };
    },

    async getRole(userId) {
      const { data } = await client.from('perfiles').select('rol').eq('id', userId).single();
      return (data?.rol as 'PACIENTE' | 'ADMIN') ?? null;
    },
  };

  const especialidades: EspecialidadesService = {
    async list() {
      const { data } = await client.from('especialidades').select('id, nombre').order('nombre');
      return (data as Especialidad[]) ?? [];
    },
  };

  const medicos: MedicosService = {
    async list() {
      const { data } = await client
        .from('medicos')
        .select('id, nombre, apellido, email, telefono, licencia, especialidad_id');
      return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: row.id as string,
        nombre: row.nombre as string,
        apellido: row.apellido as string,
        email: row.email as string,
        telefono: row.telefono as string | undefined,
        licencia: row.licencia as string,
        especialidadId: row.especialidad_id as string,
      }));
    },
    async create(input) {
      const { data, error } = await client
        .from('medicos')
        .insert({
          nombre: input.nombre,
          apellido: input.apellido,
          email: input.email,
          telefono: input.telefono,
          licencia: input.licencia,
          especialidad_id: input.especialidadId,
        })
        .select()
        .single();

      if (error) {
        const isDuplicate = error.code === '23505';
        return {
          ok: false,
          error: {
            status: isDuplicate ? 409 : 400,
            message: isDuplicate ? 'Ya existe un médico con esta cédula profesional.' : error.message,
          },
        };
      }

      const medico: Medico = {
        id: data.id,
        nombre: data.nombre,
        apellido: data.apellido,
        email: data.email,
        telefono: data.telefono,
        licencia: data.licencia,
        especialidadId: data.especialidad_id,
      };
      return { ok: true, value: medico };
    },
  };

  const horarios: HorariosService = {
    async list({ medicoId, especialidadId }) {
      let medicoIds: string[] | undefined;
      if (especialidadId) {
        const { data } = await client.from('medicos').select('id').eq('especialidad_id', especialidadId);
        medicoIds = ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
      }

      let query = client.from('horarios').select('id, medico_id, dia_semana, hora_inicio, hora_fin');
      if (medicoId) query = query.eq('medico_id', medicoId);
      if (medicoIds) query = query.in('medico_id', medicoIds);

      const { data } = await query;
      return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: row.id as string,
        medicoId: row.medico_id as string,
        diaSemana: row.dia_semana as string,
        horaInicio: row.hora_inicio as string,
        horaFin: row.hora_fin as string,
      }));
    },
    async create(input) {
      if (input.horaFin <= input.horaInicio) {
        return { ok: false, error: { status: 400, message: 'La hora de fin debe ser posterior a la hora de inicio.' } };
      }
      const { data, error } = await client
        .from('horarios')
        .insert({
          medico_id: input.medicoId,
          dia_semana: input.diaSemana,
          hora_inicio: input.horaInicio,
          hora_fin: input.horaFin,
        })
        .select()
        .single();

      if (error) {
        return { ok: false, error: { status: 400, message: error.message } };
      }

      return {
        ok: true,
        value: {
          id: data.id,
          medicoId: data.medico_id,
          diaSemana: data.dia_semana,
          horaInicio: data.hora_inicio,
          horaFin: data.hora_fin,
        },
      };
    },
    async update(id, input) {
      if (input.horaFin <= input.horaInicio) {
        return { ok: false, error: { status: 400, message: 'La hora de fin debe ser posterior a la hora de inicio.' } };
      }
      const { data, error } = await client
        .from('horarios')
        .update({
          medico_id: input.medicoId,
          dia_semana: input.diaSemana,
          hora_inicio: input.horaInicio,
          hora_fin: input.horaFin,
        })
        .eq('id', id)
        .select()
        .single();

      if (error || !data) {
        return { ok: false, error: { status: 404, message: 'Horario no encontrado.' } };
      }

      return {
        ok: true,
        value: {
          id: data.id,
          medicoId: data.medico_id,
          diaSemana: data.dia_semana,
          horaInicio: data.hora_inicio,
          horaFin: data.hora_fin,
        },
      };
    },
    async remove(id) {
      const { error } = await client.from('horarios').delete().eq('id', id);
      if (error) {
        return { ok: false, error: { status: 404, message: 'Horario no encontrado.' } };
      }
      return { ok: true, value: undefined };
    },
  };

  const citas: CitasService = {
    async listSlotsDisponibles(medicoId, fecha) {
      const dia = diaSemanaDeFecha(fecha);
      const { data: bloques } = await client
        .from('horarios')
        .select('hora_inicio, hora_fin')
        .eq('medico_id', medicoId)
        .eq('dia_semana', dia);
      const franjasValidas = ((bloques ?? []) as Array<{ hora_inicio: string; hora_fin: string }>).flatMap((h) =>
        generarFranjas(h.hora_inicio, h.hora_fin)
      );

      const { data: ocupadasRows } = await client
        .from('citas')
        .select('fecha_hora')
        .eq('medico_id', medicoId)
        .eq('estado', 'CONFIRMADA')
        .gte('fecha_hora', `${fecha}T00:00:00`)
        .lte('fecha_hora', `${fecha}T23:59:59`);
      const ocupadas = new Set(
        ((ocupadasRows ?? []) as Array<{ fecha_hora: string }>).map((row) => row.fecha_hora.slice(11, 16))
      );

      return franjasValidas.filter((hora) => !ocupadas.has(hora));
    },

    async create({ pacienteId, medicoId, fechaHora }) {
      const { data: medico } = await client.from('medicos').select('especialidad_id').eq('id', medicoId).single();
      if (!medico) {
        return { ok: false, error: { status: 404, message: 'Médico no encontrado.' } };
      }

      const [fecha, hora] = fechaHora.split('T') as [string, string];
      const dia = diaSemanaDeFecha(fecha);
      const { data: bloques } = await client
        .from('horarios')
        .select('hora_inicio, hora_fin')
        .eq('medico_id', medicoId)
        .eq('dia_semana', dia);
      const franjasValidas = ((bloques ?? []) as Array<{ hora_inicio: string; hora_fin: string }>).flatMap((h) =>
        generarFranjas(h.hora_inicio, h.hora_fin)
      );

      if (!franjasValidas.includes(hora)) {
        return {
          ok: false,
          error: { status: 400, message: 'El horario seleccionado no está disponible. Elige otro para continuar.' },
        };
      }

      const { data, error } = await client
        .from('citas')
        .insert({
          paciente_id: pacienteId,
          medico_id: medicoId,
          especialidad_id: medico.especialidad_id,
          fecha_hora: fechaHora,
          estado: 'CONFIRMADA',
        })
        .select()
        .single();

      if (error) {
        const isDuplicate = error.code === '23505';
        return {
          ok: false,
          error: {
            status: isDuplicate ? 409 : 400,
            message: isDuplicate
              ? 'Lo sentimos, este horario ya no está disponible. Por favor selecciona otro.'
              : error.message,
          },
        };
      }

      return {
        ok: true,
        value: {
          id: data.id,
          pacienteId: data.paciente_id,
          medicoId: data.medico_id,
          especialidadId: data.especialidad_id,
          fechaHora: data.fecha_hora,
          estado: data.estado,
        },
      };
    },

    async listByPaciente(pacienteId) {
      const { data } = await client.from('citas').select('*').eq('paciente_id', pacienteId).order('fecha_hora');
      return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: row.id as string,
        pacienteId: row.paciente_id as string,
        medicoId: row.medico_id as string,
        especialidadId: row.especialidad_id as string,
        fechaHora: row.fecha_hora as string,
        estado: row.estado as 'CONFIRMADA' | 'CANCELADA',
      }));
    },

    async reprogramar(id, pacienteId, fechaHora) {
      const { data: existing } = await client
        .from('citas')
        .select('medico_id')
        .eq('id', id)
        .eq('paciente_id', pacienteId)
        .eq('estado', 'CONFIRMADA')
        .single();

      if (!existing) {
        return { ok: false, error: { status: 404, message: 'Cita no encontrada.' } };
      }

      const [fecha, hora] = fechaHora.split('T') as [string, string];
      const dia = diaSemanaDeFecha(fecha);
      const { data: bloques } = await client
        .from('horarios')
        .select('hora_inicio, hora_fin')
        .eq('medico_id', existing.medico_id)
        .eq('dia_semana', dia);
      const franjasValidas = ((bloques ?? []) as Array<{ hora_inicio: string; hora_fin: string }>).flatMap((h) =>
        generarFranjas(h.hora_inicio, h.hora_fin)
      );

      if (!franjasValidas.includes(hora)) {
        return {
          ok: false,
          error: { status: 400, message: 'El horario seleccionado no está disponible. Elige otro para continuar.' },
        };
      }

      const { data, error } = await client
        .from('citas')
        .update({ fecha_hora: fechaHora, actualizada_en: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        const isDuplicate = error.code === '23505';
        return {
          ok: false,
          error: {
            status: isDuplicate ? 409 : 400,
            message: isDuplicate
              ? 'Lo sentimos, este horario ya no está disponible. Por favor selecciona otro.'
              : error.message,
          },
        };
      }

      return {
        ok: true,
        value: {
          id: data.id,
          pacienteId: data.paciente_id,
          medicoId: data.medico_id,
          especialidadId: data.especialidad_id,
          fechaHora: data.fecha_hora,
          estado: data.estado,
        },
      };
    },

    async cancelar(id, pacienteId) {
      const { data, error } = await client
        .from('citas')
        .update({ estado: 'CANCELADA', actualizada_en: new Date().toISOString() })
        .eq('id', id)
        .eq('paciente_id', pacienteId)
        .select()
        .single();

      if (error || !data) {
        return { ok: false, error: { status: 404, message: 'Cita no encontrada.' } };
      }

      return { ok: true, value: undefined };
    },
  };

  return { auth, especialidades, medicos, horarios, citas };
}