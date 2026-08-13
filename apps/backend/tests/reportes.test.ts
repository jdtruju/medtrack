import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { createInMemoryServices } from './helpers/inMemoryServices';

let services: ReturnType<typeof createInMemoryServices>;
let app: ReturnType<typeof createApp>;
let adminToken: string;
let pacienteToken: string;
let medicoId: string;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-16T12:00:00')); // jueves, semana 2026-07-13..2026-07-19

  services = createInMemoryServices();
  app = createApp(services);

  await services.auth.register({
    nombre: 'Admin',
    apellido: 'QA',
    email: 'admin@medtrack.test',
    password: 'Admin1234',
  });
  services.testHelpers.promoteToAdmin('admin@medtrack.test');
  const loginAdmin = await services.auth.login('admin@medtrack.test', 'Admin1234');
  if (loginAdmin.ok) adminToken = loginAdmin.value.token;

  await services.auth.register({
    nombre: 'Ana',
    apellido: 'Mora',
    email: 'paciente@medtrack.test',
    password: 'Paciente1',
  });
  const loginPaciente = await services.auth.login('paciente@medtrack.test', 'Paciente1');
  if (loginPaciente.ok) pacienteToken = loginPaciente.value.token;

  const especialidades = await services.especialidades.list();
  const medico = await services.medicos.create({
    nombre: 'Dr',
    apellido: 'Lopez',
    email: 'lopez@medtrack.test',
    licencia: 'MED-20',
    especialidadId: especialidades[0].id,
  });
  if (medico.ok) medicoId = medico.value.id;

  await services.horarios.create({
    medicoId,
    diaSemana: 'JUE',
    horaInicio: '08:00',
    horaFin: '09:00',
  });
  await services.citas.create({
    pacienteId: 'paciente-1',
    medicoId,
    fechaHora: '2026-07-16T08:00',
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('GET /api/reportes/*', () => {
  it('HU-15 rechaza si el usuario no es ADMIN', async () => {
    const dashboard = await request(app)
      .get('/api/reportes/dashboard')
      .set('Authorization', `Bearer ${pacienteToken}`);
    const disponibilidad = await request(app)
      .get('/api/reportes/disponibilidad')
      .set('Authorization', `Bearer ${pacienteToken}`);
    const citas = await request(app)
      .get('/api/reportes/citas')
      .set('Authorization', `Bearer ${pacienteToken}`);

    expect(dashboard.status).toBe(403);
    expect(disponibilidad.status).toBe(403);
    expect(citas.status).toBe(403);
  });

  it('HU-15 rechaza si el usuario no esta autenticado', async () => {
    const dashboard = await request(app).get('/api/reportes/dashboard');
    const disponibilidad = await request(app).get('/api/reportes/disponibilidad');
    const citas = await request(app).get('/api/reportes/citas');

    expect(dashboard.status).toBe(401);
    expect(disponibilidad.status).toBe(401);
    expect(citas.status).toBe(401);
  });

  it('HU-14 rechaza un rango de fechas invalido', async () => {
    const fechaInvalida = await request(app)
      .get('/api/reportes/citas?desde=no-es-una-fecha')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(fechaInvalida.status).toBe(400);

    const rangoInvertido = await request(app)
      .get('/api/reportes/citas?desde=2026-07-19&hasta=2026-07-16')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(rangoInvertido.status).toBe(400);
  });

  it('HU-15 devuelve totales y ocupacion por medico', async () => {
    const response = await request(app)
      .get('/api/reportes/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.stats.totalCitas).toBe(1);
    expect(response.body.stats.ocupacionPorMedico).toEqual([
      {
        medicoId,
        nombre: 'Dr',
        apellido: 'Lopez',
        franjasTotales: 2,
        franjasOcupadas: 1,
        porcentaje: 50,
      },
    ]);
  });

  it('HU-13 filtra la disponibilidad por medico', async () => {
    const response = await request(app)
      .get(`/api/reportes/disponibilidad?medicoId=${medicoId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      medicoId,
      franjasTotales: 2,
      franjasOcupadas: 1,
    });
  });

  it('HU-14 filtra las citas por medico y rango de fechas', async () => {
    const response = await request(app)
      .get(`/api/reportes/citas?medicoId=${medicoId}&desde=2026-07-16&hasta=2026-07-16`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({ medicoNombre: 'Dr', medicoApellido: 'Lopez' });

    const fueraDeRango = await request(app)
      .get(`/api/reportes/citas?medicoId=${medicoId}&desde=2026-07-17&hasta=2026-07-19`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(fueraDeRango.body.items).toHaveLength(0);
  });
});
