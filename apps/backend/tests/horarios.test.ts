import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createInMemoryServices } from '../src/repositories/inMemoryRepositories';

let services: ReturnType<typeof createInMemoryServices>;
let app: ReturnType<typeof createApp>;
let adminToken: string;
let pacienteToken: string;
let medicoId: string;

beforeEach(async () => {
  services = createInMemoryServices();
  app = createApp(services);

  await services.auth.register({ nombre: 'Admin', apellido: 'QA', email: 'admin@medtrack.test', password: 'Admin1234' });
  services.testHelpers.promoteToAdmin('admin@medtrack.test');
  const loginAdmin = await services.auth.login('admin@medtrack.test', 'Admin1234');
  if (loginAdmin.ok) adminToken = loginAdmin.value.token;

  await services.auth.register({ nombre: 'Paciente', apellido: 'QA', email: 'paciente@medtrack.test', password: 'Paciente1' });
  const loginPaciente = await services.auth.login('paciente@medtrack.test', 'Paciente1');
  if (loginPaciente.ok) pacienteToken = loginPaciente.value.token;

  const [especialidad] = await services.especialidades.list();
  if (!especialidad) throw new Error('setup failed');
  const medico = await services.medicos.create({
    nombre: 'Elena',
    apellido: 'Campos',
    email: 'elena@medtrack.test',
    licencia: 'MED-123',
    especialidadId: especialidad.id,
  });
  if (!medico.ok) throw new Error('setup failed');
  medicoId = medico.value.id;
});

describe('POST /api/horarios', () => {
  it('HU-05 crea un horario cuando el usuario es ADMIN', async () => {
    const response = await request(app)
      .post('/api/horarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ medicoId, diaSemana: 'LUN', horaInicio: '08:00', horaFin: '12:00' });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Horario creado correctamente.');
  });

  it('HU-05 rechaza hora fin menor o igual a hora inicio', async () => {
    const response = await request(app)
      .post('/api/horarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ medicoId, diaSemana: 'LUN', horaInicio: '12:00', horaFin: '08:00' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('La hora de fin debe ser posterior a la hora de inicio.');
  });

  it('HU-05 bloquea creacion si el usuario no es ADMIN', async () => {
    const response = await request(app)
      .post('/api/horarios')
      .set('Authorization', `Bearer ${pacienteToken}`)
      .send({ medicoId, diaSemana: 'LUN', horaInicio: '08:00', horaFin: '12:00' });

    expect(response.status).toBe(403);
  });
});

describe('GET /api/horarios', () => {
  it('HU-06 lista horarios disponibles para un paciente autenticado', async () => {
    await services.horarios.create({ medicoId, diaSemana: 'MAR', horaInicio: '09:00', horaFin: '11:00' });

    const response = await request(app).get('/api/horarios').set('Authorization', `Bearer ${pacienteToken}`);

    expect(response.status).toBe(200);
    expect(response.body.horarios).toHaveLength(1);
  });
});
