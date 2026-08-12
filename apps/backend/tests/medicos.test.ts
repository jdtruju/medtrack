import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createInMemoryServices } from './helpers/inMemoryServices';

let services: ReturnType<typeof createInMemoryServices>;
let app: ReturnType<typeof createApp>;
let adminToken: string;
let pacienteToken: string;

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
});

describe('GET /api/especialidades', () => {
  it('HU-04 requiere autenticacion', async () => {
    const response = await request(app).get('/api/especialidades');
    expect(response.status).toBe(401);
  });

  it('HU-04 lista especialidades para cualquier usuario autenticado', async () => {
    const response = await request(app)
      .get('/api/especialidades')
      .set('Authorization', `Bearer ${pacienteToken}`);

    expect(response.status).toBe(200);
    expect(response.body.especialidades.length).toBeGreaterThan(0);
  });
});

describe('CRUD /api/especialidades', () => {
  it('permite a ADMIN crear, editar y eliminar especialidades sin medicos asociados', async () => {
    const created = await request(app)
      .post('/api/especialidades')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Neurologia', descripcion: 'Sistema nervioso' });

    expect(created.status).toBe(201);
    expect(created.body.especialidad.nombre).toBe('Neurologia');

    const updated = await request(app)
      .put(`/api/especialidades/${created.body.especialidad.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ nombre: 'Neurologia clinica', descripcion: 'Atencion neurologica' });

    expect(updated.status).toBe(200);
    expect(updated.body.especialidad.nombre).toBe('Neurologia clinica');

    const removed = await request(app)
      .delete(`/api/especialidades/${created.body.especialidad.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(removed.status).toBe(200);
  });

  it('rechaza crear especialidades si el usuario no es ADMIN', async () => {
    const response = await request(app)
      .post('/api/especialidades')
      .set('Authorization', `Bearer ${pacienteToken}`)
      .send({ nombre: 'Neurologia' });

    expect(response.status).toBe(403);
  });

  it('bloquea eliminar una especialidad con medicos asociados', async () => {
    const especialidades = await services.especialidades.list();
    await request(app)
      .post('/api/medicos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombre: 'Elena',
        apellido: 'Campos',
        email: 'elena@medtrack.test',
        licencia: 'MED-999',
        especialidadId: especialidades[0].id,
      });

    const response = await request(app)
      .delete(`/api/especialidades/${especialidades[0].id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(409);
  });
});

describe('POST /api/medicos', () => {
  it('HU-04 registra un medico con especialidad cuando el usuario es ADMIN', async () => {
    const especialidades = await services.especialidades.list();
    const response = await request(app)
      .post('/api/medicos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombre: 'Elena',
        apellido: 'Campos',
        email: 'elena@medtrack.test',
        licencia: 'MED-123',
        especialidadId: especialidades[0].id,
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Médico registrado correctamente.');
  });

  it('HU-04 bloquea el registro con licencia duplicada', async () => {
    const especialidades = await services.especialidades.list();
    await request(app)
      .post('/api/medicos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombre: 'Elena',
        apellido: 'Campos',
        email: 'elena@medtrack.test',
        licencia: 'MED-123',
        especialidadId: especialidades[0].id,
      });

    const response = await request(app)
      .post('/api/medicos')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombre: 'Otro',
        apellido: 'Medico',
        email: 'otro@medtrack.test',
        licencia: 'MED-123',
        especialidadId: especialidades[0].id,
      });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Ya existe un médico con esta cédula profesional.');
  });

  it('HU-04 rechaza el registro si el usuario no es ADMIN', async () => {
    const especialidades = await services.especialidades.list();
    const response = await request(app)
      .post('/api/medicos')
      .set('Authorization', `Bearer ${pacienteToken}`)
      .send({
        nombre: 'Elena',
        apellido: 'Campos',
        email: 'elena@medtrack.test',
        licencia: 'MED-123',
        especialidadId: especialidades[0].id,
      });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('No tienes permisos para acceder a esta sección.');
  });
});
