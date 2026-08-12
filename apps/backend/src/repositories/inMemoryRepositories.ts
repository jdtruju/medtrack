import type {
  AuthService,
  Especialidad,
  EspecialidadesService,
  Horario,
  HorariosService,
  Medico,
  MedicosService,
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
  let nextId = 1;
  const newId = (prefix: string) => `${prefix}-${nextId++}`;

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
  };

  const medicosService: MedicosService = {
    async list() {
      return medicos;
    },
    async create(input) {
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
    testHelpers,
  };
}