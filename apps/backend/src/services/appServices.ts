import { MockMailService, type MailService } from './mailService';

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  rol: 'PACIENTE' | 'ADMIN';
  activo: boolean;
  intentosFallidos: number;
  bloqueadoHasta: Date | null;
}

export interface DoctorRecord {
  id: string;
  email: string;
  licencia: string;
}

export interface SpecialtyRecord {
  id: string;
  nombre: string;
  descripcion?: string | null;
}

export interface PasswordResetRecord {
  id: string;
  usuarioId: string;
  token: string;
  expiraEn: Date;
  usadoEn: Date | null;
}

export interface UserRepository {
  createPatient(input: {
    email: string;
    passwordHash: string;
    nombre: string;
    apellido: string;
    telefono?: string;
  }): Promise<UserRecord>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  updateLoginState(id: string, data: { intentosFallidos: number; bloqueadoHasta: Date | null }): Promise<void>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
}

export interface PasswordResetRepository {
  create(input: { usuarioId: string; token: string; expiraEn: Date }): Promise<PasswordResetRecord>;
  findValidByToken(token: string, now: Date): Promise<PasswordResetRecord | null>;
  markUsed(id: string, usadoEn: Date): Promise<void>;
}

export interface DoctorRepository {
  findDuplicate(email: string, licencia: string): Promise<DoctorRecord | null>;
  createWithSpecialty(input: {
    nombre: string;
    apellido: string;
    email: string;
    telefono?: string;
    licencia: string;
    especialidadId?: string;
    especialidadNombre?: string;
  }): Promise<DoctorRecord & { especialidad: SpecialtyRecord }>;
  listSpecialties(): Promise<SpecialtyRecord[]>;
}

export interface AppServices {
  users: UserRepository;
  passwordResets: PasswordResetRepository;
  doctors: DoctorRepository;
  mail: MailService;
}

export function createDefaultSupportServices(): Pick<AppServices, 'mail'> {
  return {
    mail: new MockMailService(),
  };
}
