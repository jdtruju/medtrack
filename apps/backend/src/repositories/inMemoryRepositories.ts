import {
  diaSemanaDeFecha,
  fechaDeDiaEnSemana,
  generarFranjas,
  rangoSemanaActual,
} from '../lib/citasSlots';
import type {
  AuthService,
  Cita,
  CitasService,
  Especialidad,
  EspecialidadesService,
  Horario,
  HorariosService,
  Medico,
  MedicosService,
  Notificacion,
  NotificacionesService,
  OcupacionMedico,
  ReportesService,
  TipoNotificacion,
} from '../services/appServices';

interface StoredUser {
  id: string;
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  rol: 'PACIENTE' | 'ADMIN';
}

const LOCK_DURATION_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function createInMemoryServices() {
  const users: StoredUser[] = [];
  const tokens = new Map<string, string>();
  const loginAttempts = new Map<string, { intentos: number; bloqueadoHasta: number | null }>();
  const especialidades: Especialidad[] = [
    { id: 'esp-1', nombre: 'Cardiología' },
    { id: 'esp-2', nombre: 'Pediatría' },
    { id: 'esp-3', nombre: 'Dermatología' },
  ];
  const medicos: Medico[] = [];
  const horarios: Horario[] = [];
  const citas: Cita[] = [];
  const notificaciones: Notificacion[] = [];
  let nextId = 1;
  const newId = (prefix: string) => `${prefix}-${nextId++}`;

  const subjectByTipo = (tipo: TipoNotificacion) => {
    if (tipo === 'CONFIRMACION_RESERVA') return 'Confirmacion de cita MedTrack';
    if (tipo === 'RECORDATORIO_24H') return 'Recordatorio de cita MedTrack';
    return 'Cancelacion de cita MedTrack';
  };

  const registrarNotificacion = (input: {
    usuarioId: string;
    email: string;
    tipo: TipoNotificacion;
    citaId: string;
    detalle?: string;
  }) => {
    const notificacion: Notificacion = {
      id: newId('notificacion'),
      usuarioId: input.usuarioId,
      email: input.email,
      tipo: input.tipo,
      citaId: input.citaId,
      enviadoEn: new Date().toISOString(),
      detalle: input.detalle,
    };
    notificaciones.push(notificacion);
    console.info('[correo-mock]', { to: input.email, subject: subjectByTipo(input.tipo), text: input.detalle });
    return notificacion;
  };

  const auth: AuthService = {
    async register({ nombre, apellido, email, telefono, password }) {
      if (users.some((u) => u.email === email)) {
        return {
          ok: false,
          error: {
            status: 409,
            message: 'Este correo ya está registrado. Por favor inicia sesión o usa otro correo.',
          },
        };
      }
      users.push({
        id: newId('user'),
        email,
        password,
        nombre,
        apellido,
        telefono,
        rol: 'PACIENTE',
      });
      return { ok: true, value: undefined };
    },
    async login(email, password) {
      const lock = loginAttempts.get(email);
      if (lock?.bloqueadoHasta && lock.bloqueadoHasta > Date.now()) {
        return {
          ok: false,
          error: {
            status: 403,
            message: 'Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.',
          },
        };
      }

      const user = users.find((u) => u.email === email && u.password === password);
      if (!user) {
        const current = loginAttempts.get(email) ?? { intentos: 0, bloqueadoHasta: null };
        current.intentos += 1;
        if (current.intentos >= MAX_ATTEMPTS) {
          current.bloqueadoHasta = Date.now() + LOCK_DURATION_MS;
          loginAttempts.set(email, current);
          return {
            ok: false,
            error: {
              status: 403,
              message: 'Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.',
            },
          };
        }
        loginAttempts.set(email, current);
        return {
          ok: false,
          error: {
            status: 401,
            message: `Correo o contraseña incorrectos. Intento ${current.intentos} de 5.`,
          },
        };
      }

      loginAttempts.delete(email);
      const token = newId('token');
      tokens.set(token, user.id);
      return {
        ok: true,
        value: {
          token,
          usuario: {
            id: user.id,
            email: user.email,
            nombre: user.nombre,
            apellido: user.apellido,
            rol: user.rol,
          },
        },
      };
    },
    async forgotPassword() {
      // en memoria no hace nada; la implementación real llama a Supabase Auth
    },
    async resetPassword(accessToken, password) {
      const userId = tokens.get(accessToken);
      if (!userId) {
        return {
          ok: false,
          error: { status: 400, message: 'Este enlace ha expirado. Por favor solicita uno nuevo.' },
        };
      }
      const user = users.find((u) => u.id === userId);
      if (!user) {
        return {
          ok: false,
          error: { status: 400, message: 'Este enlace ha expirado. Por favor solicita uno nuevo.' },
        };
      }
      user.password = password;
      return { ok: true, value: undefined };
    },
    async getUserFromToken(token) {
      const userId = tokens.get(token);
      if (!userId) return null;
      const user = users.find((u) => u.id === userId);
      return user ? { id: user.id, email: user.email } : null;
    },
    async getRole(userId) {
      return users.find((u) => u.id === userId)?.rol ?? null;
    },
  };

  const especialidadesService: EspecialidadesService = {
    async list() {
      return especialidades;
    },
    async create(input) {
      if (especialidades.some((especialidad) => especialidad.nombre.toLowerCase() === input.nombre.toLowerCase())) {
        return { ok: false, error: { status: 409, message: 'Ya existe una especialidad con este nombre.' } };
      }
      const especialidad: Especialidad = { id: newId('esp'), ...input };
      especialidades.push(especialidad);
      return { ok: true, value: especialidad };
    },
    async update(id, input) {
      const index = especialidades.findIndex((especialidad) => especialidad.id === id);
      if (index === -1) {
        return { ok: false, error: { status: 404, message: 'Especialidad no encontrada.' } };
      }
      if (
        especialidades.some(
          (especialidad) => especialidad.id !== id && especialidad.nombre.toLowerCase() === input.nombre.toLowerCase(),
        )
      ) {
        return { ok: false, error: { status: 409, message: 'Ya existe una especialidad con este nombre.' } };
      }
      especialidades[index] = { id, ...input };
      return { ok: true, value: especialidades[index] };
    },
    async remove(id) {
      if (medicos.some((medico) => medico.especialidadId === id)) {
        return {
          ok: false,
          error: { status: 409, message: 'No se puede eliminar una especialidad con medicos asociados.' },
        };
      }
      const index = especialidades.findIndex((especialidad) => especialidad.id === id);
      if (index === -1) {
        return { ok: false, error: { status: 404, message: 'Especialidad no encontrada.' } };
      }
      especialidades.splice(index, 1);
      return { ok: true, value: undefined };
    },
  };

  const medicosService: MedicosService = {
    async list() {
      return medicos;
    },
    async create(input) {
      if (!especialidades.some((especialidad) => especialidad.id === input.especialidadId)) {
        return { ok: false, error: { status: 404, message: 'Especialidad no encontrada.' } };
      }
      if (medicos.some((m) => m.licencia === input.licencia)) {
        return {
          ok: false,
          error: { status: 409, message: 'Ya existe un médico con esta cédula profesional.' },
        };
      }
      const medico: Medico = { id: newId('medico'), ...input };
      medicos.push(medico);
      return { ok: true, value: medico };
    },
  };

  const horariosService: HorariosService = {
    async list({ medicoId, especialidadId }) {
      return horarios.filter((h) => {
        if (medicoId && h.medicoId !== medicoId) return false;
        if (especialidadId) {
          const medico = medicos.find((m) => m.id === h.medicoId);
          if (!medico || medico.especialidadId !== especialidadId) return false;
        }
        return true;
      });
    },
    async create(input) {
      if (input.horaFin <= input.horaInicio) {
        return {
          ok: false,
          error: { status: 400, message: 'La hora de fin debe ser posterior a la hora de inicio.' },
        };
      }
      const horario: Horario = { id: newId('horario'), ...input };
      horarios.push(horario);
      return { ok: true, value: horario };
    },
    async update(id, input) {
      const index = horarios.findIndex((h) => h.id === id);
      if (index === -1) {
        return { ok: false, error: { status: 404, message: 'Horario no encontrado.' } };
      }
      if (input.horaFin <= input.horaInicio) {
        return {
          ok: false,
          error: { status: 400, message: 'La hora de fin debe ser posterior a la hora de inicio.' },
        };
      }
      horarios[index] = { id, ...input };
      return { ok: true, value: horarios[index] };
    },
    async remove(id) {
      const index = horarios.findIndex((h) => h.id === id);
      if (index === -1) {
        return { ok: false, error: { status: 404, message: 'Horario no encontrado.' } };
      }
      horarios.splice(index, 1);
      return { ok: true, value: undefined };
    },
  };

  const citasService: CitasService = {
    async listSlotsDisponibles(medicoId, fecha) {
      const dia = diaSemanaDeFecha(fecha);
      const bloques = horarios.filter((h) => h.medicoId === medicoId && h.diaSemana === dia);
      const franjasValidas = bloques.flatMap((h) => generarFranjas(h.horaInicio, h.horaFin));
      const ocupadas = new Set(
        citas
          .filter(
            (c) =>
              c.medicoId === medicoId && c.estado === 'CONFIRMADA' && c.fechaHora.startsWith(fecha)
          )
          .map((c) => c.fechaHora.split('T')[1]!)
      );
      return franjasValidas.filter((hora) => !ocupadas.has(hora));
    },
    async create({ pacienteId, medicoId, fechaHora }) {
      const medico = medicos.find((m) => m.id === medicoId);
      if (!medico) {
        return { ok: false, error: { status: 404, message: 'Médico no encontrado.' } };
      }

      const [fecha, hora] = fechaHora.split('T') as [string, string];
      const dia = diaSemanaDeFecha(fecha);
      const franjasValidas = horarios
        .filter((h) => h.medicoId === medicoId && h.diaSemana === dia)
        .flatMap((h) => generarFranjas(h.horaInicio, h.horaFin));

      if (!franjasValidas.includes(hora)) {
        return {
          ok: false,
          error: {
            status: 400,
            message: 'El horario seleccionado no está disponible. Elige otro para continuar.',
          },
        };
      }

      const ocupado = citas.some(
        (c) => c.medicoId === medicoId && c.fechaHora === fechaHora && c.estado === 'CONFIRMADA'
      );
      if (ocupado) {
        return {
          ok: false,
          error: {
            status: 409,
            message: 'Lo sentimos, este horario ya no está disponible. Por favor selecciona otro.',
          },
        };
      }

      const cita: Cita = {
        id: newId('cita'),
        pacienteId,
        medicoId,
        especialidadId: medico.especialidadId,
        fechaHora,
        estado: 'CONFIRMADA',
        recordatorioEnviado: false,
      };
      citas.push(cita);

      const paciente = users.find((u) => u.id === pacienteId);
      registrarNotificacion({
        usuarioId: pacienteId,
        email: paciente?.email ?? '',
        tipo: 'CONFIRMACION_RESERVA',
        citaId: cita.id,
        detalle: `Cita reservada para ${fechaHora.replace('T', ' ')}.`,
      });

      return { ok: true, value: cita };
    },
    async listByPaciente(pacienteId) {
      return citas.filter((c) => c.pacienteId === pacienteId);
    },
    async reprogramar(id, pacienteId, fechaHora) {
      const cita = citas.find(
        (c) => c.id === id && c.pacienteId === pacienteId && c.estado === 'CONFIRMADA'
      );
      if (!cita) {
        return { ok: false, error: { status: 404, message: 'Cita no encontrada.' } };
      }

      const [fecha, hora] = fechaHora.split('T') as [string, string];
      const dia = diaSemanaDeFecha(fecha);
      const franjasValidas = horarios
        .filter((h) => h.medicoId === cita.medicoId && h.diaSemana === dia)
        .flatMap((h) => generarFranjas(h.horaInicio, h.horaFin));

      if (!franjasValidas.includes(hora)) {
        return {
          ok: false,
          error: {
            status: 400,
            message: 'El horario seleccionado no está disponible. Elige otro para continuar.',
          },
        };
      }

      const ocupado = citas.some(
        (c) =>
          c.id !== id &&
          c.medicoId === cita.medicoId &&
          c.fechaHora === fechaHora &&
          c.estado === 'CONFIRMADA'
      );
      if (ocupado) {
        return {
          ok: false,
          error: {
            status: 409,
            message: 'Lo sentimos, este horario ya no está disponible. Por favor selecciona otro.',
          },
        };
      }

      cita.fechaHora = fechaHora;
      return { ok: true, value: cita };
    },
    async cancelar(id, pacienteId, motivo) {
      const cita = citas.find((c) => c.id === id && c.pacienteId === pacienteId);
      if (!cita) {
        return { ok: false, error: { status: 404, message: 'Cita no encontrada.' } };
      }
      cita.estado = 'CANCELADA';
      cita.motivoCancelacion = motivo;

      const paciente = users.find((u) => u.id === pacienteId);
      registrarNotificacion({
        usuarioId: pacienteId,
        email: paciente?.email ?? '',
        tipo: 'CANCELACION_CITA',
        citaId: cita.id,
        detalle: motivo ? `Cita cancelada. Motivo: ${motivo}` : 'Cita cancelada.',
      });

      return { ok: true, value: undefined };
    },
    async send24HourReminders(ahora = new Date()) {
      const inicioVentana = ahora.getTime() + 23.5 * 60 * 60 * 1000;
      const finVentana = ahora.getTime() + 24.5 * 60 * 60 * 1000;
      let processed = 0;

      for (const cita of citas) {
        if (cita.estado !== 'CONFIRMADA' || cita.recordatorioEnviado) continue;
        const empiezaEn = new Date(cita.fechaHora).getTime();
        if (empiezaEn < inicioVentana || empiezaEn > finVentana) continue;

        const paciente = users.find((u) => u.id === cita.pacienteId);
        registrarNotificacion({
          usuarioId: cita.pacienteId,
          email: paciente?.email ?? '',
          tipo: 'RECORDATORIO_24H',
          citaId: cita.id,
          detalle: `Recordatorio: cita el ${cita.fechaHora.replace('T', ' ')}.`,
        });
        cita.recordatorioEnviado = true;
        processed += 1;
      }

      return { processed };
    },
  };

  const notificacionesService: NotificacionesService = {
    async list() {
      return notificaciones;
    },
  };

  const reportesService: ReportesService = {
    async dashboard(hoy) {
      const totalCitas = citas.filter((c) => c.estado === 'CONFIRMADA').length;
      const totalPacientes = users.filter((u) => u.rol === 'PACIENTE').length;
      const { inicio } = rangoSemanaActual(hoy);

      const ocupacionPorMedico: OcupacionMedico[] = medicos.map((medico) => {
        const bloques = horarios.filter((h) => h.medicoId === medico.id);
        let franjasTotales = 0;
        let franjasOcupadas = 0;
        for (const bloque of bloques) {
          const franjas = generarFranjas(bloque.horaInicio, bloque.horaFin);
          franjasTotales += franjas.length;
          const fecha = fechaDeDiaEnSemana(inicio, bloque.diaSemana);
          franjasOcupadas += citas.filter(
            (c) =>
              c.medicoId === medico.id &&
              c.estado === 'CONFIRMADA' &&
              c.fechaHora.startsWith(fecha) &&
              franjas.includes(c.fechaHora.split('T')[1]!)
          ).length;
        }
        return {
          medicoId: medico.id,
          nombre: medico.nombre,
          apellido: medico.apellido,
          franjasTotales,
          franjasOcupadas,
          porcentaje:
            franjasTotales === 0 ? 0 : Math.round((franjasOcupadas / franjasTotales) * 100),
        };
      });

      return { totalCitas, totalPacientes, ocupacionPorMedico };
    },

    async disponibilidad(hoy, medicoId) {
      const { inicio } = rangoSemanaActual(hoy);
      const bloques = horarios.filter((h) => !medicoId || h.medicoId === medicoId);

      return bloques.map((bloque) => {
        const medico = medicos.find((m) => m.id === bloque.medicoId);
        const franjas = generarFranjas(bloque.horaInicio, bloque.horaFin);
        const fecha = fechaDeDiaEnSemana(inicio, bloque.diaSemana);
        const franjasOcupadas = citas.filter(
          (c) =>
            c.medicoId === bloque.medicoId &&
            c.estado === 'CONFIRMADA' &&
            c.fechaHora.startsWith(fecha) &&
            franjas.includes(c.fechaHora.split('T')[1]!)
        ).length;

        return {
          horarioId: bloque.id,
          medicoId: bloque.medicoId,
          medicoNombre: medico?.nombre ?? '',
          medicoApellido: medico?.apellido ?? '',
          diaSemana: bloque.diaSemana,
          horaInicio: bloque.horaInicio,
          horaFin: bloque.horaFin,
          franjasTotales: franjas.length,
          franjasOcupadas,
          franjasLibres: franjas.length - franjasOcupadas,
        };
      });
    },

    async citas(filters) {
      return citas
        .filter((c) => !filters.medicoId || c.medicoId === filters.medicoId)
        .filter((c) => !filters.desde || c.fechaHora >= filters.desde)
        .filter((c) => !filters.hasta || c.fechaHora <= `${filters.hasta}T23:59`)
        .map((c) => {
          const medico = medicos.find((m) => m.id === c.medicoId);
          const paciente = users.find((u) => u.id === c.pacienteId);
          return {
            ...c,
            medicoNombre: medico?.nombre ?? '',
            medicoApellido: medico?.apellido ?? '',
            pacienteNombre: paciente?.nombre ?? '',
            pacienteApellido: paciente?.apellido ?? '',
          };
        });
    },
  };

  const testHelpers = {
    promoteToAdmin(email: string) {
      const user = users.find((u) => u.email === email);
      if (user) user.rol = 'ADMIN';
    },
  };

  return {
    auth,
    especialidades: especialidadesService,
    medicos: medicosService,
    horarios: horariosService,
    citas: citasService,
    reportes: reportesService,
    notificaciones: notificacionesService,
    testHelpers,
  };
}