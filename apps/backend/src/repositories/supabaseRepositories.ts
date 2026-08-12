import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AppServices,
  AuthService,
  Cita,
  CitasService,
  Especialidad,
  EspecialidadesService,
  HorariosService,
  Medico,
  MedicosService,
  Notificacion,
  NotificacionesService,
  TipoNotificacion,
} from '../services/appServices';
import { createEmailSender } from '../services/emailService';

export function createSupabaseServices(client: SupabaseClient, frontendUrl: string): AppServices {
  const normalizeTime = (value: unknown) => String(value).slice(0, 5);
  const emailSender = createEmailSender();

  const subjectByTipo = (tipo: TipoNotificacion) => {
    if (tipo === 'CONFIRMACION_RESERVA') return 'Confirmacion de cita MedTrack';
    if (tipo === 'RECORDATORIO_24H') return 'Recordatorio de cita MedTrack';
    return 'Cancelacion de cita MedTrack';
  };

  const registrarNotificacion = async (input: {
    usuarioId: string;
    email: string;
    tipo: TipoNotificacion;
    citaId: string;
    detalle?: string;
  }) => {
    const subject = subjectByTipo(input.tipo);
    const text = input.detalle ?? `Notificacion ${input.tipo}`;
    let delivery: { provider: string; id?: string; error?: string };
    try {
      delivery = await emailSender.send({
        to: input.email,
        subject,
        text,
      });
    } catch (error) {
      delivery = { provider: 'error', error: (error as Error).message };
      console.error('No se pudo enviar la notificacion por correo.', error);
    }
    await client.from('notificaciones').insert({
      usuario_id: input.usuarioId,
      email: input.email,
      tipo: input.tipo,
      cita_id: input.citaId,
      detalle: `${text} Canal: ${delivery.provider}${delivery.id ? ` (${delivery.id})` : ''}${delivery.error ? ` - ${delivery.error}` : ''}.`,
    });
  };

  const mapCita = (row: Record<string, unknown>): Cita => ({
    id: row.id as string,
    pacienteId: row.paciente_id as string,
    pacienteEmail: row.paciente_email as string,
    medicoId: row.medico_id as string,
    horarioId: row.horario_id as string,
    fecha: row.fecha as string,
    horaInicio: normalizeTime(row.hora_inicio),
    estado: row.estado as Cita['estado'],
    motivoCancelacion: row.motivo_cancelacion as string | undefined,
    recordatorioEnviado: Boolean(row.recordatorio_enviado),
  });

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
      const { data } = await client.from('especialidades').select('id, nombre, descripcion').order('nombre');
      return (data as Especialidad[]) ?? [];
    },
    async create(input) {
      const { data, error } = await client
        .from('especialidades')
        .insert({ nombre: input.nombre, descripcion: input.descripcion })
        .select('id, nombre, descripcion')
        .single();
      if (error || !data) {
        return {
          ok: false,
          error: {
            status: error?.code === '23505' ? 409 : 400,
            message: error?.code === '23505' ? 'Ya existe una especialidad con este nombre.' : (error?.message ?? 'No se pudo crear la especialidad.'),
          },
        };
      }
      return { ok: true, value: data as Especialidad };
    },
    async update(id, input) {
      const { data, error } = await client
        .from('especialidades')
        .update({ nombre: input.nombre, descripcion: input.descripcion })
        .eq('id', id)
        .select('id, nombre, descripcion')
        .single();
      if (error || !data) {
        return {
          ok: false,
          error: {
            status: error?.code === '23505' ? 409 : 404,
            message: error?.code === '23505' ? 'Ya existe una especialidad con este nombre.' : 'Especialidad no encontrada.',
          },
        };
      }
      return { ok: true, value: data as Especialidad };
    },
    async remove(id) {
      const { error } = await client.from('especialidades').delete().eq('id', id);
      if (error) {
        return {
          ok: false,
          error: {
            status: error.code === '23503' ? 409 : 404,
            message:
              error.code === '23503'
                ? 'No se puede eliminar una especialidad con medicos asociados.'
                : 'Especialidad no encontrada.',
          },
        };
      }
      return { ok: true, value: undefined };
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
        horaInicio: normalizeTime(row.hora_inicio),
        horaFin: normalizeTime(row.hora_fin),
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
          horaInicio: normalizeTime(data.hora_inicio),
          horaFin: normalizeTime(data.hora_fin),
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
          horaInicio: normalizeTime(data.hora_inicio),
          horaFin: normalizeTime(data.hora_fin),
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
    async listAll() {
      const { data, error } = await client
        .from('citas')
        .select('id, paciente_id, paciente_email, medico_id, horario_id, fecha, hora_inicio, estado, motivo_cancelacion, recordatorio_enviado')
        .order('fecha', { ascending: true });
      if (error) throw new Error(`No se pudieron leer las citas: ${error.message}`);
      return ((data ?? []) as Array<Record<string, unknown>>).map(mapCita);
    },
    async listByPaciente(pacienteId) {
      const { data, error } = await client
        .from('citas')
        .select('id, paciente_id, paciente_email, medico_id, horario_id, fecha, hora_inicio, estado, motivo_cancelacion, recordatorio_enviado')
        .eq('paciente_id', pacienteId)
        .order('fecha', { ascending: true });
      if (error) throw new Error(`No se pudieron leer las citas del paciente: ${error.message}`);
      return ((data ?? []) as Array<Record<string, unknown>>).map(mapCita);
    },
    async create(input) {
      const { data: horario } = await client
        .from('horarios')
        .select('id')
        .eq('id', input.horarioId)
        .eq('medico_id', input.medicoId)
        .single();
      if (!horario) {
        return { ok: false, error: { status: 404, message: 'Horario no encontrado.' } };
      }

      const { data, error } = await client
        .from('citas')
        .insert({
          paciente_id: input.pacienteId,
          paciente_email: input.pacienteEmail,
          medico_id: input.medicoId,
          horario_id: input.horarioId,
          fecha: input.fecha,
          hora_inicio: input.horaInicio,
        })
        .select(
          'id, paciente_id, paciente_email, medico_id, horario_id, fecha, hora_inicio, estado, motivo_cancelacion, recordatorio_enviado',
        )
        .single();

      if (error || !data) {
        const isDuplicate = error?.code === '23505';
        return {
          ok: false,
          error: { status: isDuplicate ? 409 : 400, message: isDuplicate ? 'Este horario ya fue reservado.' : (error?.message ?? 'No se pudo crear la cita.') },
        };
      }

      const cita = mapCita(data as Record<string, unknown>);
      await registrarNotificacion({
        usuarioId: input.pacienteId,
        email: input.pacienteEmail,
        tipo: 'CONFIRMACION_RESERVA',
        citaId: cita.id,
        detalle: `Cita reservada para ${input.fecha} a las ${input.horaInicio}.`,
      });
      return { ok: true, value: cita };
    },
    async cancel({ citaId, pacienteId, motivo }) {
      const { data: current } = await client
        .from('citas')
        .select('estado')
        .eq('id', citaId)
        .eq('paciente_id', pacienteId)
        .single();
      if (!current) {
        return { ok: false, error: { status: 404, message: 'Cita no encontrada.' } };
      }
      if ((current as { estado: string }).estado === 'CANCELADA') {
        return { ok: false, error: { status: 409, message: 'La cita ya esta cancelada.' } };
      }

      const { data, error } = await client
        .from('citas')
        .update({ estado: 'CANCELADA', motivo_cancelacion: motivo })
        .eq('id', citaId)
        .eq('paciente_id', pacienteId)
        .select(
          'id, paciente_id, paciente_email, medico_id, horario_id, fecha, hora_inicio, estado, motivo_cancelacion, recordatorio_enviado',
        )
        .single();
      if (error || !data) {
        return { ok: false, error: { status: 404, message: 'Cita no encontrada.' } };
      }

      const cita = mapCita(data as Record<string, unknown>);
      await registrarNotificacion({
        usuarioId: cita.pacienteId,
        email: cita.pacienteEmail,
        tipo: 'CANCELACION_CITA',
        citaId: cita.id,
        detalle: `Cita cancelada. Motivo: ${motivo}`,
      });
      return { ok: true, value: cita };
    },
    async send24HourReminders(now = new Date()) {
      const start = new Date(now.getTime() + 23.5 * 60 * 60 * 1000).toISOString();
      const end = new Date(now.getTime() + 24.5 * 60 * 60 * 1000).toISOString();
      const { data } = await client
        .from('citas')
        .select('id, paciente_id, paciente_email, medico_id, horario_id, fecha, hora_inicio, estado, motivo_cancelacion, recordatorio_enviado')
        .eq('estado', 'RESERVADA')
        .eq('recordatorio_enviado', false)
        .gte('fecha_hora_inicio', start)
        .lte('fecha_hora_inicio', end);

      const due = ((data ?? []) as Array<Record<string, unknown>>).map(mapCita);
      for (const cita of due) {
        await registrarNotificacion({
          usuarioId: cita.pacienteId,
          email: cita.pacienteEmail,
          tipo: 'RECORDATORIO_24H',
          citaId: cita.id,
          detalle: `Recordatorio: cita el ${cita.fecha} a las ${cita.horaInicio}.`,
        });
        await client.from('citas').update({ recordatorio_enviado: true }).eq('id', cita.id);
      }
      return { processed: due.length };
    },
  };

  const notificaciones: NotificacionesService = {
    async list() {
      const { data } = await client
        .from('notificaciones')
        .select('id, usuario_id, email, tipo, cita_id, enviado_en, detalle')
        .order('enviado_en', { ascending: false });
      return ((data ?? []) as Array<Record<string, unknown>>).map((row): Notificacion => ({
        id: row.id as string,
        usuarioId: row.usuario_id as string,
        email: row.email as string,
        tipo: row.tipo as TipoNotificacion,
        citaId: row.cita_id as string,
        enviadoEn: row.enviado_en as string,
        detalle: row.detalle as string | undefined,
      }));
    },
  };

  return { auth, especialidades, medicos, horarios, citas, notificaciones };
}
