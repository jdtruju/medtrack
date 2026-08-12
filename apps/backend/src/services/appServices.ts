export type Role = 'PACIENTE' | 'ADMIN';

export interface SessionUser {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: Role;
}

export interface Especialidad {
  id: string;
  nombre: string;
}

export interface Medico {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string;
  licencia: string;
  especialidadId: string;
}

export interface Horario {
  id: string;
  medicoId: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
}

export type ServiceResult<T> = { ok: true; value: T } | { ok: false; error: { status: number; message: string } };

export interface AuthService {
  register(input: {
    nombre: string;
    apellido: string;
    email: string;
    telefono?: string;
    password: string;
  }): Promise<ServiceResult<void>>;
  login(email: string, password: string): Promise<ServiceResult<{ token: string; usuario: SessionUser }>>;
  forgotPassword(email: string): Promise<void>;
  resetPassword(accessToken: string, password: string): Promise<ServiceResult<void>>;
  getUserFromToken(token: string): Promise<{ id: string; email: string } | null>;
  getRole(userId: string): Promise<Role | null>;
}

export interface EspecialidadesService {
  list(): Promise<Especialidad[]>;
}

export interface MedicosService {
  list(): Promise<Medico[]>;
  create(input: Omit<Medico, 'id'>): Promise<ServiceResult<Medico>>;
}

export interface HorariosService {
  list(filters: { medicoId?: string; especialidadId?: string }): Promise<Horario[]>;
  create(input: Omit<Horario, 'id'>): Promise<ServiceResult<Horario>>;
  update(id: string, input: Omit<Horario, 'id'>): Promise<ServiceResult<Horario>>;
  remove(id: string): Promise<ServiceResult<void>>;
}

export interface AppServices {
  auth: AuthService;
  especialidades: EspecialidadesService;
  medicos: MedicosService;
  horarios: HorariosService;
}
