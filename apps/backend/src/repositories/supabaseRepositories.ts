import {
  bloquesSeSuperponen,
  diaSemanaDeFecha,
  fechaDeDiaEnSemana,
  generarFranjas,
  rangoSemanaActual,
} from '../lib/citasSlots';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AppServices,
  AuthService,
  CitasService,
  DisponibilidadReporteItem,
  Especialidad,
  EspecialidadesService,
  HorariosService,
  Medico,
  MedicosService,
  Notificacion,
  NotificacionesService,
  ReportesService,
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

  const emailDePaciente = async (pacienteId: string): Promise<string> => {
    const { data } = await client.from('perfiles').select('email').eq('id', pacienteId).single();
    return (data?.email as string | undefined) ?? '';
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
      delivery = await emailSender.send({ to: input.email, subject, text });
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
          error: {
            status: 403,
            message: 'Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.',
          },
        };
      }

      const { data, error } = await client.auth.signInWithPassword({ email, password });

      if (error || !data.session || !data.user) {
        const { data: attempt } = await client.rpc('record_login_attempt', {
          p_email: email,
          p_exitoso: false,
        });
        if (attempt?.bloqueado) {
          return {
            ok: false,
            error: {
              status: 403,
              message: 'Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.',
            },
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
      await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${frontendUrl}/reset-password`,
      });
    },

    async resetPassword(accessToken, password) {
      const { data, error } = await client.auth.getUser(accessToken);
      if (error || !data.user) {
        return {
          ok: false,
          error: { status: 400, message: 'Este enlace ha expirado. Por favor solicita uno nuevo.' },
        };
      }

      const { error: updateError } = await client.auth.admin.updateUserById(data.user.id, {
        password,
      });
      if (updateError) {
        return {
          ok: false,
          error: { status: 400, message: 'Este enlace ha expirado. Por favor solicita uno nuevo.' },
        };
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
            message: isDuplicate
              ? 'Ya existe un médico con esta cédula profesional.'
              : error.message,
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
        const { data } = await client
          .from('medicos')
          .select('id')
          .eq('especialidad_id', especialidadId);
        medicoIds = ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
      }

      let query = client
        .from('horarios')
        .select('id, medico_id, dia_semana, hora_inicio, hora_fin');
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
        return {
          ok: false,
          error: { status: 400, message: 'La hora de fin debe ser posterior a la hora de inicio.' },
        };
      }
      const { data: existentes } = await client
        .from('horarios')
        .select('hora_inicio, hora_fin')
        .eq('medico_id', input.medicoId)
        .eq('dia_semana', input.diaSemana);
      const superpuesto = ((existentes ?? []) as Array<{ hora_inicio: string; hora_fin: string }>).some((h) =>
        bloquesSeSuperponen(input.horaInicio, input.horaFin, normalizeTime(h.hora_inicio), normalizeTime(h.hora_fin))
      );
      if (superpuesto) {
        return {
          ok: false,
          error: { status: 409, message: 'Este médico ya tiene un horario que se superpone ese día.' },
        };
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
        return {
          ok: false,
          error: { status: 400, message: 'La hora de fin debe ser posterior a la hora de inicio.' },
        };
      }
      const { data: existentes } = await client
        .from('horarios')
        .select('id, hora_inicio, hora_fin')
        .eq('medico_id', input.medicoId)
        .eq('dia_semana', input.diaSemana);
      const superpuesto = ((existentes ?? []) as Array<{ id: string; hora_inicio: string; hora_fin: string }>).some(
        (h) =>
          h.id !== id &&
          bloquesSeSuperponen(input.horaInicio, input.horaFin, normalizeTime(h.hora_inicio), normalizeTime(h.hora_fin))
      );
      if (superpuesto) {
        return {
          ok: false,
          error: { status: 409, message: 'Este médico ya tiene un horario que se superpone ese día.' },
        };
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
    async listSlotsDisponibles(medicoId, fecha) {
      const dia = diaSemanaDeFecha(fecha);
      const { data: bloques } = await client
        .from('horarios')
        .select('hora_inicio, hora_fin')
        .eq('medico_id', medicoId)
        .eq('dia_semana', dia);
      const franjasValidas = (
        (bloques ?? []) as Array<{ hora_inicio: string; hora_fin: string }>
      ).flatMap((h) => generarFranjas(h.hora_inicio, h.hora_fin));

      const { data: ocupadasRows } = await client
        .from('citas')
        .select('fecha_hora')
        .eq('medico_id', medicoId)
        .eq('estado', 'CONFIRMADA')
        .gte('fecha_hora', `${fecha}T00:00:00`)
        .lte('fecha_hora', `${fecha}T23:59:59`);
      const ocupadas = new Set(
        ((ocupadasRows ?? []) as Array<{ fecha_hora: string }>).map((row) =>
          row.fecha_hora.slice(11, 16)
        )
      );

      return franjasValidas.filter((hora) => !ocupadas.has(hora));
    },

    async create({ pacienteId, medicoId, fechaHora }) {
      const { data: medico } = await client
        .from('medicos')
        .select('especialidad_id')
        .eq('id', medicoId)
        .single();
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
      const franjasValidas = (
        (bloques ?? []) as Array<{ hora_inicio: string; hora_fin: string }>
      ).flatMap((h) => generarFranjas(h.hora_inicio, h.hora_fin));

      if (!franjasValidas.includes(hora)) {
        return {
          ok: false,
          error: {
            status: 400,
            message: 'El horario seleccionado no está disponible. Elige otro para continuar.',
          },
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

      const cita = {
        id: data.id as string,
        pacienteId: data.paciente_id as string,
        medicoId: data.medico_id as string,
        especialidadId: data.especialidad_id as string,
        fechaHora: data.fecha_hora as string,
        estado: data.estado as 'CONFIRMADA' | 'CANCELADA',
        recordatorioEnviado: Boolean(data.recordatorio_enviado),
      };

      const email = await emailDePaciente(pacienteId);
      await registrarNotificacion({
        usuarioId: pacienteId,
        email,
        tipo: 'CONFIRMACION_RESERVA',
        citaId: cita.id,
        detalle: `Cita reservada para ${fechaHora.replace('T', ' ')}.`,
      });

      return { ok: true, value: cita };
    },

    async listByPaciente(pacienteId) {
      const { data } = await client
        .from('citas')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('fecha_hora');
      return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
        id: row.id as string,
        pacienteId: row.paciente_id as string,
        medicoId: row.medico_id as string,
        especialidadId: row.especialidad_id as string,
        fechaHora: row.fecha_hora as string,
        estado: row.estado as 'CONFIRMADA' | 'CANCELADA',
        motivoCancelacion: row.motivo_cancelacion as string | undefined,
        recordatorioEnviado: Boolean(row.recordatorio_enviado),
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
      const franjasValidas = (
        (bloques ?? []) as Array<{ hora_inicio: string; hora_fin: string }>
      ).flatMap((h) => generarFranjas(h.hora_inicio, h.hora_fin));

      if (!franjasValidas.includes(hora)) {
        return {
          ok: false,
          error: {
            status: 400,
            message: 'El horario seleccionado no está disponible. Elige otro para continuar.',
          },
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
          motivoCancelacion: data.motivo_cancelacion,
          recordatorioEnviado: Boolean(data.recordatorio_enviado),
        },
      };
    },

    async cancelar(id, pacienteId, motivo) {
      const { data, error } = await client
        .from('citas')
        .update({
          estado: 'CANCELADA',
          motivo_cancelacion: motivo,
          actualizada_en: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('paciente_id', pacienteId)
        .select()
        .single();

      if (error || !data) {
        return { ok: false, error: { status: 404, message: 'Cita no encontrada.' } };
      }

      const email = await emailDePaciente(pacienteId);
      await registrarNotificacion({
        usuarioId: pacienteId,
        email,
        tipo: 'CANCELACION_CITA',
        citaId: data.id as string,
        detalle: motivo ? `Cita cancelada. Motivo: ${motivo}` : 'Cita cancelada.',
      });

      return { ok: true, value: undefined };
    },

    async send24HourReminders(ahora = new Date()) {
      const inicioVentana = new Date(ahora.getTime() + 23.5 * 60 * 60 * 1000).toISOString();
      const finVentana = new Date(ahora.getTime() + 24.5 * 60 * 60 * 1000).toISOString();

      const { data } = await client
        .from('citas')
        .select('id, paciente_id, fecha_hora')
        .eq('estado', 'CONFIRMADA')
        .eq('recordatorio_enviado', false)
        .gte('fecha_hora', inicioVentana.slice(0, 16))
        .lte('fecha_hora', finVentana.slice(0, 16));

      const due = (data ?? []) as Array<{ id: string; paciente_id: string; fecha_hora: string }>;
      for (const cita of due) {
        const email = await emailDePaciente(cita.paciente_id);
        await registrarNotificacion({
          usuarioId: cita.paciente_id,
          email,
          tipo: 'RECORDATORIO_24H',
          citaId: cita.id,
          detalle: `Recordatorio: cita el ${cita.fecha_hora.replace('T', ' ')}.`,
        });
        await client.from('citas').update({ recordatorio_enviado: true }).eq('id', cita.id);
      }

      return { processed: due.length };
    },
  };

  const reportes: ReportesService = {
    async dashboard(hoy) {
      const { count: totalCitas } = await client
        .from('citas')
        .select('*', { count: 'exact', head: true })
        .eq('estado', 'CONFIRMADA');

      const { count: totalPacientes } = await client
        .from('perfiles')
        .select('*', { count: 'exact', head: true })
        .eq('rol', 'PACIENTE');

      const { data: medicosRows } = await client.from('medicos').select('id, nombre, apellido');
      const { data: horariosRows } = await client
        .from('horarios')
        .select('medico_id, dia_semana, hora_inicio, hora_fin');
      const { inicio, fin } = rangoSemanaActual(hoy);
      const { data: citasSemana } = await client
        .from('citas')
        .select('medico_id, fecha_hora')
        .eq('estado', 'CONFIRMADA')
        .gte('fecha_hora', `${inicio}T00:00`)
        .lte('fecha_hora', `${fin}T23:59`);

      const ocupacionPorMedico = ((medicosRows ?? []) as Array<Record<string, unknown>>).map(
        (medico) => {
          const bloques = ((horariosRows ?? []) as Array<Record<string, unknown>>).filter(
            (h) => h.medico_id === medico.id
          );
          let franjasTotales = 0;
          let franjasOcupadas = 0;
          for (const bloque of bloques) {
            const franjas = generarFranjas(bloque.hora_inicio as string, bloque.hora_fin as string);
            franjasTotales += franjas.length;
            const fecha = fechaDeDiaEnSemana(inicio, bloque.dia_semana as string);
            franjasOcupadas += (
              (citasSemana ?? []) as Array<{ medico_id: string; fecha_hora: string }>
            ).filter(
              (c) =>
                c.medico_id === medico.id &&
                c.fecha_hora.startsWith(fecha) &&
                franjas.includes(c.fecha_hora.slice(11, 16))
            ).length;
          }
          return {
            medicoId: medico.id as string,
            nombre: medico.nombre as string,
            apellido: medico.apellido as string,
            franjasTotales,
            franjasOcupadas,
            porcentaje:
              franjasTotales === 0 ? 0 : Math.round((franjasOcupadas / franjasTotales) * 100),
          };
        }
      );

      return {
        totalCitas: totalCitas ?? 0,
        totalPacientes: totalPacientes ?? 0,
        ocupacionPorMedico,
      };
    },

    async disponibilidad(hoy, medicoId) {
      let query = client
        .from('horarios')
        .select('id, medico_id, dia_semana, hora_inicio, hora_fin')
        .order('medico_id')
        .order('dia_semana')
        .order('hora_inicio');
      if (medicoId) query = query.eq('medico_id', medicoId);
      const { data: bloques } = await query;

      const { data: medicosRows } = await client.from('medicos').select('id, nombre, apellido');
      const { inicio } = rangoSemanaActual(hoy);

      const resultado: DisponibilidadReporteItem[] = [];
      for (const bloque of (bloques ?? []) as Array<Record<string, unknown>>) {
        const medico = ((medicosRows ?? []) as Array<Record<string, unknown>>).find(
          (m) => m.id === bloque.medico_id
        );
        const franjas = generarFranjas(bloque.hora_inicio as string, bloque.hora_fin as string);
        const fecha = fechaDeDiaEnSemana(inicio, bloque.dia_semana as string);
        const { data: citasDia } = await client
          .from('citas')
          .select('fecha_hora')
          .eq('medico_id', bloque.medico_id as string)
          .eq('estado', 'CONFIRMADA')
          .gte('fecha_hora', `${fecha}T00:00`)
          .lte('fecha_hora', `${fecha}T23:59`);
        const franjasOcupadas = ((citasDia ?? []) as Array<{ fecha_hora: string }>).filter((c) =>
          franjas.includes(c.fecha_hora.slice(11, 16))
        ).length;

        resultado.push({
          horarioId: bloque.id as string,
          medicoId: bloque.medico_id as string,
          medicoNombre: (medico?.nombre as string) ?? '',
          medicoApellido: (medico?.apellido as string) ?? '',
          diaSemana: bloque.dia_semana as string,
          horaInicio: bloque.hora_inicio as string,
          horaFin: bloque.hora_fin as string,
          franjasTotales: franjas.length,
          franjasOcupadas,
          franjasLibres: franjas.length - franjasOcupadas,
        });
      }
      return resultado;
    },

    async citas(filters) {
      let query = client
        .from('citas')
        .select('id, paciente_id, medico_id, especialidad_id, fecha_hora, estado, motivo_cancelacion, recordatorio_enviado')
        .order('fecha_hora')
        .limit(1000);
      if (filters.medicoId) query = query.eq('medico_id', filters.medicoId);
      if (filters.desde) query = query.gte('fecha_hora', filters.desde);
      if (filters.hasta) query = query.lte('fecha_hora', `${filters.hasta}T23:59`);

      const { data } = await query;
      const rows = (data ?? []) as Array<Record<string, unknown>>;

      const { data: medicosRows } = await client.from('medicos').select('id, nombre, apellido');
      const { data: perfilesRows } = await client.from('perfiles').select('id, nombre, apellido');

      return rows.map((row) => {
        const medico = ((medicosRows ?? []) as Array<Record<string, unknown>>).find(
          (m) => m.id === row.medico_id
        );
        const paciente = ((perfilesRows ?? []) as Array<Record<string, unknown>>).find(
          (p) => p.id === row.paciente_id
        );
        return {
          id: row.id as string,
          pacienteId: row.paciente_id as string,
          medicoId: row.medico_id as string,
          especialidadId: row.especialidad_id as string,
          fechaHora: row.fecha_hora as string,
          estado: row.estado as 'CONFIRMADA' | 'CANCELADA',
          motivoCancelacion: row.motivo_cancelacion as string | undefined,
          recordatorioEnviado: Boolean(row.recordatorio_enviado),
          medicoNombre: (medico?.nombre as string) ?? '',
          medicoApellido: (medico?.apellido as string) ?? '',
          pacienteNombre: (paciente?.nombre as string) ?? '',
          pacienteApellido: (paciente?.apellido as string) ?? '',
        };
      });
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

  return { auth, especialidades, medicos, horarios, citas, reportes, notificaciones };
}