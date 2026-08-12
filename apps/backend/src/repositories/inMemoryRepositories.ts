import bcrypt from 'bcrypt';
import type {
  AppServices,
  DoctorRecord,
  DoctorRepository,
  PasswordResetRecord,
  PasswordResetRepository,
  SpecialtyRecord,
  UserRecord,
  UserRepository,
} from '../services/appServices';
import { MockMailService } from '../services/mailService';

export class InMemoryUserRepository implements UserRepository {
  private users: UserRecord[];

  constructor(initialUsers: UserRecord[] = []) {
    this.users = initialUsers;
  }

  async createPatient(input: {
    email: string;
    passwordHash: string;
    nombre: string;
    apellido: string;
    telefono?: string;
  }): Promise<UserRecord> {
    const user: UserRecord = {
      id: `user-${this.users.length + 1}`,
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      nombre: input.nombre,
      apellido: input.apellido,
      telefono: input.telefono ?? null,
      rol: 'PACIENTE',
      activo: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    };
    this.users.push(user);
    return user;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.email === email.toLowerCase()) ?? null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.find((user) => user.id === id) ?? null;
  }

  async updateLoginState(
    id: string,
    data: { intentosFallidos: number; bloqueadoHasta: Date | null }
  ): Promise<void> {
    const user = await this.findById(id);
    if (user) {
      user.intentosFallidos = data.intentosFallidos;
      user.bloqueadoHasta = data.bloqueadoHasta;
    }
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    const user = await this.findById(id);
    if (user) {
      user.passwordHash = passwordHash;
      user.intentosFallidos = 0;
      user.bloqueadoHasta = null;
    }
  }
}

export class InMemoryPasswordResetRepository implements PasswordResetRepository {
  resets: PasswordResetRecord[] = [];

  async create(input: { usuarioId: string; token: string; expiraEn: Date }): Promise<PasswordResetRecord> {
    const reset = {
      id: `reset-${this.resets.length + 1}`,
      usuarioId: input.usuarioId,
      token: input.token,
      expiraEn: input.expiraEn,
      usadoEn: null,
    };
    this.resets.push(reset);
    return reset;
  }

  async findValidByToken(token: string, now: Date): Promise<PasswordResetRecord | null> {
    return this.resets.find((reset) => reset.token === token && !reset.usadoEn && reset.expiraEn > now) ?? null;
  }

  async markUsed(id: string, usadoEn: Date): Promise<void> {
    const reset = this.resets.find((item) => item.id === id);
    if (reset) {
      reset.usadoEn = usadoEn;
    }
  }
}

export class InMemoryDoctorRepository implements DoctorRepository {
  private doctors: DoctorRecord[] = [];
  private specialties: SpecialtyRecord[] = [
    { id: '11111111-1111-4111-8111-111111111111', nombre: 'Cardiologia' },
    { id: '11111111-1111-4111-8111-111111111112', nombre: 'Pediatria' },
    { id: '11111111-1111-4111-8111-111111111113', nombre: 'Medicina general' },
  ];

  async findDuplicate(email: string, licencia: string): Promise<DoctorRecord | null> {
    return (
      this.doctors.find((doctor) => doctor.email === email.toLowerCase() || doctor.licencia === licencia) ?? null
    );
  }

  async createWithSpecialty(input: {
    nombre: string;
    apellido: string;
    email: string;
    telefono?: string;
    licencia: string;
    especialidadId?: string;
    especialidadNombre?: string;
  }): Promise<DoctorRecord & { especialidad: SpecialtyRecord }> {
    const specialty =
      this.specialties.find((item) => item.id === input.especialidadId) ??
      this.createSpecialty(input.especialidadNombre ?? 'Medicina general');
    const doctor = {
      id: `doctor-${this.doctors.length + 1}`,
      email: input.email.toLowerCase(),
      licencia: input.licencia,
    };
    this.doctors.push(doctor);
    return { ...doctor, especialidad: specialty };
  }

  async listSpecialties(): Promise<SpecialtyRecord[]> {
    return this.specialties;
  }

  private createSpecialty(nombre: string): SpecialtyRecord {
    const specialty = {
      id: `22222222-2222-4222-8222-${String(this.specialties.length).padStart(12, '0')}`,
      nombre,
    };
    this.specialties.push(specialty);
    return specialty;
  }
}

export function createInMemoryServices(): AppServices {
  return {
    users: new InMemoryUserRepository([
      {
        id: 'admin-dev',
        email: 'admin@medtrack.test',
        passwordHash: bcrypt.hashSync('Admin12345', 10),
        nombre: 'Admin',
        apellido: 'MedTrack',
        telefono: null,
        rol: 'ADMIN',
        activo: true,
        intentosFallidos: 0,
        bloqueadoHasta: null,
      },
    ]),
    passwordResets: new InMemoryPasswordResetRepository(),
    doctors: new InMemoryDoctorRepository(),
    mail: new MockMailService(),
  };
}
