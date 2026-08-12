import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createInMemoryServices } from './helpers/inMemoryServices';

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

  await services.auth.register({ nombre: 'Paciente', apellido: 'Uno', email: 'paciente@medtrack.test', password: 'Paciente1' });
  const loginPaciente = await services.auth.login('paciente@medtrack.test', 'Paciente1');
  if (loginPaciente.ok) pacienteToken = loginPaciente.value.token;

  const especialidades = await services.especialidades.list();
  const medico = await services.medicos.create({
    nombre: 'Dr',
    apellido: 'Lopez',
    email: 'lopez@medtrack.test',
    licencia: 'MED-1',
    especialidadId: especialidades[0].id,
  });
  if (medico.ok) medicoId = medico.value.id;
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

  it('HU-05 rechaza si la hora de fin no es posterior a la de inicio', async () => {
    const response = await request(app)
      .post('/api/horarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ medicoId, diaSemana: 'LUN', horaInicio: '12:00', horaFin: '08:00' });

    expect(response.status).toBe(400);
  });

  it('HU-05 rechaza si el usuario no es ADMIN', async () => {
    const response = await request(app)
      .post('/api/horarios')
      .set('Authorization', `Bearer ${pacienteToken}`)
      .send({ medicoId, diaSemana: 'LUN', horaInicio: '08:00', horaFin: '12:00' });

    expect(response.status).toBe(403);
  });
});

describe('PUT y DELETE /api/horarios/:id', () => {
  it('HU-05 edita un horario existente', async () => {
    const created = await request(app)
      .post('/api/horarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ medicoId, diaSemana: 'LUN', horaInicio: '08:00', horaFin: '12:00' });

    const response = await request(app)
      .put(`/api/horarios/${created.body.horario.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ medicoId, diaSemana: 'LUN', horaInicio: '09:00', horaFin: '13:00' });

    expect(response.status).toBe(200);
    expect(response.body.horario.horaInicio).toBe('09:00');
  });

  it('HU-05 elimina un horario existente', async () => {
    const created = await request(app)
      .post('/api/horarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ medicoId, diaSemana: 'LUN', horaInicio: '08:00', horaFin: '12:00' });

    const response = await request(app)
      .delete(`/api/horarios/${created.body.horario.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);

    const list = await request(app)
      .get(`/api/horarios?medicoId=${medicoId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.body.horarios).toHaveLength(0);
  });
});

describe('GET /api/horarios', () => {
  it('HU-06 filtra por especialidad', async () => {
    await request(app)
      .post('/api/horarios')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ medicoId, diaSemana: 'MAR', horaInicio: '08:00', horaFin: '12:00' });

    const especialidades = await services.especialidades.list();
    const response = await request(app)
      .get(`/api/horarios?especialidadId=${especialidades[0].id}`)
      .set('Authorization', `Bearer ${pacienteToken}`);

    expect(response.status).toBe(200);
    expect(response.body.horarios).toHaveLength(1);
  });
});
