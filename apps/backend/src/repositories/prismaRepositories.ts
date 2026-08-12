import { getPrisma } from '../lib/prisma';
import type {
  DoctorRepository,
  DoctorRecord,
  PasswordResetRecord,
  PasswordResetRepository,
  SpecialtyRecord,
  UserRecord,
  UserRepository,
} from '../services/appServices';

interface RawUser {
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

interface RawSpecialty {
  id: string;
  nombre: string;
  descripcion: string | null;
}

interface PasswordResetDelegate {
  create(args: { data: { usuarioId: string; token: string; expiraEn: Date } }): Promise<PasswordResetRecord>;
  findFirst(args: {
    where: { token: string; usadoEn: null; expiraEn: { gt: Date } };
  }): Promise<PasswordResetRecord | null>;
  update(args: { where: { id: string }; data: { usadoEn: Date } }): Promise<PasswordResetRecord>;
}

interface PrismaWithPasswordReset {
  passwordResetToken: PasswordResetDelegate;
}

function mapUser(user: RawUser): UserRecord {
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    nombre: user.nombre,
    apellido: user.apellido,
    telefono: user.telefono,
    rol: user.rol,
    activo: user.activo,
    intentosFallidos: user.intentosFallidos,
    bloqueadoHasta: user.bloqueadoHasta,
  };
}

function mapSpecialty(especialidad: RawSpecialty): SpecialtyRecord {
  return {
    id: especialidad.id,
    nombre: especialidad.nombre,
    descripcion: especialidad.descripcion,
  };
}

export class PrismaUserRepository implements UserRepository {
  async createPatient(input: {
    email: string;
    passwordHash: string;
    nombre: string;
    apellido: string;
    telefono?: string;
  }): Promise<UserRecord> {
    const prisma = getPrisma();
    const user = await prisma.usuario.create({
      data: {
        ...input,
        email: input.email.toLowerCase(),
        rol: 'PACIENTE',
      },
    });
    return mapUser(user);
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const prisma = getPrisma();
    const user = await prisma.usuario.findUnique({ where: { email: email.toLowerCase() } });
    return user ? mapUser(user) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const prisma = getPrisma();
    const user = await prisma.usuario.findUnique({ where: { id } });
    return user ? mapUser(user) : null;
  }

  async updateLoginState(
    id: string,
    data: { intentosFallidos: number; bloqueadoHasta: Date | null }
  ): Promise<void> {
    const prisma = getPrisma();
    await prisma.usuario.update({ where: { id }, data });
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    const prisma = getPrisma();
    await prisma.usuario.update({
      where: { id },
      data: { passwordHash, intentosFallidos: 0, bloqueadoHasta: null },
    });
  }
}

export class PrismaPasswordResetRepository implements PasswordResetRepository {
  async create(input: {
    usuarioId: string;
    token: string;
    expiraEn: Date;
  }): Promise<PasswordResetRecord> {
    const prisma = getPrisma() as unknown as PrismaWithPasswordReset;
    const reset = await prisma.passwordResetToken.create({ data: input });
    return reset;
  }

  async findValidByToken(token: string, now: Date): Promise<PasswordResetRecord | null> {
    const prisma = getPrisma() as unknown as PrismaWithPasswordReset;
    return prisma.passwordResetToken.findFirst({
      where: {
        token,
        usadoEn: null,
        expiraEn: { gt: now },
      },
    });
  }

  async markUsed(id: string, usadoEn: Date): Promise<void> {
    const prisma = getPrisma() as unknown as PrismaWithPasswordReset;
    await prisma.passwordResetToken.update({ where: { id }, data: { usadoEn } });
  }
}

export class PrismaDoctorRepository implements DoctorRepository {
  async findDuplicate(email: string, licencia: string): Promise<DoctorRecord | null> {
    const prisma = getPrisma();
    const doctor = await prisma.medico.findFirst({
      where: {
        OR: [{ email: email.toLowerCase() }, { licencia }],
      },
    });
    return doctor;
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
    const prisma = getPrisma();
    const doctor = await prisma.medico.create({
      data: {
        nombre: input.nombre,
        apellido: input.apellido,
        email: input.email.toLowerCase(),
        telefono: input.telefono,
        licencia: input.licencia,
        especialidades: {
          create: {
            especialidad: input.especialidadId
              ? { connect: { id: input.especialidadId } }
              : {
                  connectOrCreate: {
                    where: { nombre: input.especialidadNombre ?? '' },
                    create: { nombre: input.especialidadNombre ?? '' },
                  },
                },
          },
        },
      },
      include: { especialidades: { include: { especialidad: true } } },
    });
    const assignedSpecialty = doctor.especialidades[0]?.especialidad;
    if (!assignedSpecialty) {
      throw new Error('No se pudo asignar la especialidad al medico.');
    }

    return {
      id: doctor.id,
      email: doctor.email,
      licencia: doctor.licencia,
      especialidad: mapSpecialty(assignedSpecialty),
    };
  }

  async listSpecialties(): Promise<SpecialtyRecord[]> {
    const prisma = getPrisma();
    const specialties = await prisma.especialidad.findMany({ orderBy: { nombre: 'asc' } });
    return specialties.map(mapSpecialty);
  }
}

export function createPrismaServices() {
  return {
    users: new PrismaUserRepository(),
    passwordResets: new PrismaPasswordResetRepository(),
    doctors: new PrismaDoctorRepository(),
  };
}
