import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const admin = {
  email: 'admin@medtrack.test',
  password: 'Admin12345',
  nombre: 'Admin',
  apellido: 'MedTrack',
};

async function main() {
  const passwordHash = await bcrypt.hash(admin.password, 10);

  await prisma.usuario.upsert({
    where: { email: admin.email },
    update: {
      passwordHash,
      nombre: admin.nombre,
      apellido: admin.apellido,
      rol: 'ADMIN',
      activo: true,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    },
    create: {
      email: admin.email,
      passwordHash,
      nombre: admin.nombre,
      apellido: admin.apellido,
      rol: 'ADMIN',
      activo: true,
    },
  });

  console.log('Admin listo: admin@medtrack.test / Admin12345');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
