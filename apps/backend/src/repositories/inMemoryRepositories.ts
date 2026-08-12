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
  const correosMock: Array<{ to: string; subject: string; body: string }> = [];
  let nextId = 1;
  const newId = (prefix: string) => `${prefix}-${nextId++}`;

  const sendMockEmail = (to: string, subject: string, body: string) => {
    correosMock.push({ to, subject, body });
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
    sendMockEmail(input.email, subjectByTipo(input.tipo), input.detalle ?? `Notificacion ${input.tipo}`);
    return notificacion;
  };

  const subjectByTipo = (tipo: TipoNotificacion) => {
    if (tipo === 'CONFIRMACION_RESERVA') return 'Confirmacion de cita MedTrack';
    if (tipo === 'RECORDATORIO_24H') return 'Recordatorio de cita MedTrack';
    return 'Cancelacion de cita MedTrack';
  };

  const auth: AuthService = {
    async register({ nombre, apellido, email, telefono, password }) {
      if (users.some((u) => u.email === email)) {
        return {
          ok: false,
          error: { status: 409, message: 'Este correo ya está registrado. Por favor inicia sesión o usa otro correo.' },
        };
      }
      users.push({ id: newId('user'), email, password, nombre, apellido, telefono, rol: 'PACIENTE' });
      return { ok: true, value: undefined };
    },
    async login(email, password) {
      const lock = loginAttempts.get(email);
      if (lock?.bloqueadoHasta && lock.bloqueadoHasta > Date.now()) {
        return {
          ok: false,
          error: { status: 403, message: 'Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.' },
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
            error: { status: 403, message: 'Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.' },
          };
        }
        loginAttempts.set(email, current);
        return {
          ok: false,
          error: { status: 401, message: `Correo o contraseña incorrectos. Intento ${current.intentos} de 5.` },
        };
      }

      loginAttempts.delete(email);
      const token = newId('token');
      tokens.set(token, user.id);
      return {
        ok: true,
        value: {
          token,
          usuario: { id: user.id, email: user.email, nombre: user.nombre, apellido: user.apellido, rol: user.rol },
        },
      };
    },
    async forgotPassword() {
      // en memoria no hace nada; la implementación real llama a Supabase Auth
    },
    async resetPassword(accessToken, password) {
      const userId = tokens.get(accessToken);
      if (!userId) {
        return { ok: false, error: { status: 400, message: 'Este enlace ha expirado. Por favor solicita uno nuevo.' } };
      }
      const user = users.find((u) => u.id === userId);
      if (!user) {
        return { ok: false, error: { status: 400, message: 'Este enlace ha expirado. Por favor solicita uno nuevo.' } };
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
        return { ok: false, error: { status: 409, message: 'Ya existe un médico con esta cédula profesional.' } };
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
        return { ok: false, error: { status: 400, message: 'La hora de fin debe ser posterior a la hora de inicio.' } };
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
        return { ok: false, error: { status: 400, message: 'La hora de fin debe ser posterior a la hora de inicio.' } };
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
    async listAll() {
      return citas;
    },
    async listByPaciente(pacienteId) {
      return citas.filter((cita) => cita.pacienteId === pacienteId);
    },
    async create(input) {
      const horario = horarios.find((h) => h.id === input.horarioId && h.medicoId === input.medicoId);
      if (!horario) {
        return { ok: false, error: { status: 404, message: 'Horario no encontrado.' } };
      }
      const ocupada = citas.some(
        (cita) =>
          cita.estado === 'RESERVADA' &&
          cita.medicoId === input.medicoId &&
          cita.fecha === input.fecha &&
          cita.horaInicio === input.horaInicio,
      );
      if (ocupada) {
        return { ok: false, error: { status: 409, message: 'Este horario ya fue reservado.' } };
      }

      const cita: Cita = {
        id: newId('cita'),
        ...input,
        estado: 'RESERVADA',
        recordatorioEnviado: false,
      };
      citas.push(cita);
      registrarNotificacion({
        usuarioId: input.pacienteId,
        email: input.pacienteEmail,
        tipo: 'CONFIRMACION_RESERVA',
        citaId: cita.id,
        detalle: `Cita reservada para ${input.fecha} a las ${input.horaInicio}.`,
      });
      return { ok: true, value: cita };
    },
    async cancel({ citaId, pacienteId, motivo }) {
      const cita = citas.find((current) => current.id === citaId && current.pacienteId === pacienteId);
      if (!cita) {
        return { ok: false, error: { status: 404, message: 'Cita no encontrada.' } };
      }
      if (cita.estado === 'CANCELADA') {
        return { ok: false, error: { status: 409, message: 'La cita ya esta cancelada.' } };
      }

      cita.estado = 'CANCELADA';
      cita.motivoCancelacion = motivo;
      registrarNotificacion({
        usuarioId: cita.pacienteId,
        email: cita.pacienteEmail,
        tipo: 'CANCELACION_CITA',
        citaId: cita.id,
        detalle: `Cita cancelada. Motivo: ${motivo}`,
      });
      return { ok: true, value: cita };
    },
    async send24HourReminders(now = new Date()) {
      const start = now.getTime() + 23.5 * 60 * 60 * 1000;
      const end = now.getTime() + 24.5 * 60 * 60 * 1000;
      let processed = 0;

      for (const cita of citas) {
        const startsAt = new Date(`${cita.fecha}T${cita.horaInicio.slice(0, 5)}:00`).getTime();
        if (cita.estado === 'RESERVADA' && !cita.recordatorioEnviado && startsAt >= start && startsAt <= end) {
          registrarNotificacion({
            usuarioId: cita.pacienteId,
            email: cita.pacienteEmail,
            tipo: 'RECORDATORIO_24H',
            citaId: cita.id,
            detalle: `Recordatorio: cita el ${cita.fecha} a las ${cita.horaInicio}.`,
          });
          cita.recordatorioEnviado = true;
          processed += 1;
        }
      }

      return { processed };
    },
  };

  const notificacionesService: NotificacionesService = {
    async list() {
      return notificaciones;
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
    notificaciones: notificacionesService,
    testHelpers,
  };
}
