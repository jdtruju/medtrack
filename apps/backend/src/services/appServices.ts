export interface AuthUser {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  rol: 'PACIENTE' | 'ADMIN';
}

export interface TokenUser {
  id: string;
  email: string;
}

export interface ServiceError {
  status: number;
  message: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: ServiceError };

export interface RegisterInput {
  nombre: string;
  apellido: string;
  email: string;
  telefono?: string;
  password: string;
}

export interface AuthService {
  register(input: RegisterInput): Promise<Result<void>>;
  login(email: string, password: string): Promise<Result<{ token: string; usuario: AuthUser }>>;
  forgotPassword(email: string): Promise<void>;
  resetPassword(accessToken: string, password: string): Promise<Result<void>>;
  getUserFromToken(token: string): Promise<TokenUser | null>;
  getRole(userId: string): Promise<'PACIENTE' | 'ADMIN' | null>;
}

export interface Especialidad {
  id: string;
  nombre: string;
  descripcion?: string;
}

export interface EspecialidadesService {
  list(): Promise<Especialidad[]>;
  create(input: Omit<Especialidad, 'id'>): Promise<Result<Especialidad>>;
  update(id: string, input: Omit<Especialidad, 'id'>): Promise<Result<Especialidad>>;
  remove(id: string): Promise<Result<void>>;
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

export interface MedicosService {
  list(): Promise<Medico[]>;
  create(input: Omit<Medico, 'id'>): Promise<Result<Medico>>;
}

export interface Horario {
  id: string;
  medicoId: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
}

export interface HorarioFilters {
  medicoId?: string;
  especialidadId?: string;
}

export interface HorariosService {
  list(filters: HorarioFilters): Promise<Horario[]>;
  create(input: Omit<Horario, 'id'>): Promise<Result<Horario>>;
  update(id: string, input: Omit<Horario, 'id'>): Promise<Result<Horario>>;
  remove(id: string): Promise<Result<void>>;
}

export interface Cita {
  id: string;
  pacienteId: string;
  medicoId: string;
  especialidadId: string;
  fechaHora: string;
  estado: 'CONFIRMADA' | 'CANCELADA';
  motivoCancelacion?: string;
  recordatorioEnviado: boolean;
}

export interface CreateCitaInput {
  pacienteId: string;
  medicoId: string;
  fechaHora: string;
}

export interface CitasService {
  listSlotsDisponibles(medicoId: string, fecha: string): Promise<string[]>;
  create(input: CreateCitaInput): Promise<Result<Cita>>;
  listByPaciente(pacienteId: string): Promise<Cita[]>;
  reprogramar(id: string, pacienteId: string, fechaHora: string): Promise<Result<Cita>>;
  cancelar(id: string, pacienteId: string, motivo?: string): Promise<Result<void>>;
  send24HourReminders(ahora?: Date): Promise<{ processed: number }>;
}

export interface OcupacionMedico {
  medicoId: string;
  nombre: string;
  apellido: string;
  franjasTotales: number;
  franjasOcupadas: number;
  porcentaje: number;
}

export interface DashboardStats {
  totalCitas: number;
  totalPacientes: number;
  ocupacionPorMedico: OcupacionMedico[];
}

export interface DisponibilidadReporteItem {
  horarioId: string;
  medicoId: string;
  medicoNombre: string;
  medicoApellido: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  franjasTotales: number;
  franjasOcupadas: number;
  franjasLibres: number;
}

export interface CitaReporteItem extends Cita {
  medicoNombre: string;
  medicoApellido: string;
  pacienteNombre: string;
  pacienteApellido: string;
}

export interface CitasReporteFilters {
  medicoId?: string;
  desde?: string;
  hasta?: string;
}

export interface ReportesService {
  dashboard(hoy: string): Promise<DashboardStats>;
  disponibilidad(hoy: string, medicoId?: string): Promise<DisponibilidadReporteItem[]>;
  citas(filters: CitasReporteFilters): Promise<CitaReporteItem[]>;
}

export type TipoNotificacion = 'CONFIRMACION_RESERVA' | 'RECORDATORIO_24H' | 'CANCELACION_CITA';

export interface Notificacion {
  id: string;
  usuarioId: string;
  email: string;
  tipo: TipoNotificacion;
  citaId: string;
  enviadoEn: string;
  detalle?: string;
}

export interface NotificacionesService {
  list(): Promise<Notificacion[]>;
}

export interface AppServices {
  auth: AuthService;
  especialidades: EspecialidadesService;
  medicos: MedicosService;
  horarios: HorariosService;
  citas: CitasService;
  reportes: ReportesService;
  notificaciones: NotificacionesService;
}