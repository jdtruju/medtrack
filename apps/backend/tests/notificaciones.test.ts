import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createInMemoryServices } from './helpers/inMemoryServices';

let services: ReturnType<typeof createInMemoryServices>;
let app: ReturnType<typeof createApp>;
let adminToken: string;
let pacienteToken: string;
let pacienteId: string;
let medicoId: string;

beforeEach(async () => {
  services = createInMemoryServices();
  app = createApp(services);

  await services.auth.register({ nombre: 'Admin', apellido: 'QA', email: 'admin@medtrack.test', password: 'Admin1234' });
  services.testHelpers.promoteToAdmin('admin@medtrack.test');
  const loginAdmin = await services.auth.login('admin@medtrack.test', 'Admin1234');
  if (loginAdmin.ok) adminToken = loginAdmin.value.token;

  await services.auth.register({
    nombre: 'Paciente',
    apellido: 'Uno',
    email: 'paciente@medtrack.test',
    password: 'Paciente1',
  });
  const loginPaciente = await services.auth.login('paciente@medtrack.test', 'Paciente1');
  if (loginPaciente.ok) {
    pacienteToken = loginPaciente.value.token;
    pacienteId = loginPaciente.value.usuario.id;
  }

  const [especialidad] = await services.especialidades.list();
  const medico = await services.medicos.create({
    nombre: 'Dr',
    apellido: 'Lopez',
    email: 'lopez@medtrack.test',
    licencia: 'MED-10',
    especialidadId: especialidad.id,
  });
  if (medico.ok) medicoId = medico.value.id;

  // 2026-07-16 es jueves
  await services.horarios.create({ medicoId, diaSemana: 'JUE', horaInicio: '08:00', horaFin: '12:00' });
});

describe('Epica 4 - Notificaciones', () => {
  it('HU-10 registra confirmacion por correo mock al reservar una cita', async () => {
    const response = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${pacienteToken}`)
      .send({ medicoId, fechaHora: '2026-07-16T08:00' });

    expect(response.status).toBe(201);

    const log = await request(app).get('/api/notificaciones').set('Authorization', `Bearer ${adminToken}`);
    expect(log.status).toBe(200);
    expect(log.body.notificaciones).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          email: 'paciente@medtrack.test',
          tipo: 'CONFIRMACION_RESERVA',
          citaId: response.body.cita.id,
        }),
      ]),
    );
  });

  it('HU-12 registra notificacion de cancelacion con motivo', async () => {
    const created = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${pacienteToken}`)
      .send({ medicoId, fechaHora: '2026-07-16T08:00' });

    const response = await request(app)
      .put(`/api/citas/${created.body.cita.id}/cancelar`)
      .set('Authorization', `Bearer ${pacienteToken}`)
      .send({ motivo: 'Tengo otro compromiso medico.' });

    expect(response.status).toBe(200);

    const log = await services.notificaciones.list();
    expect(log).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tipo: 'CANCELACION_CITA',
          detalle: expect.stringContaining('Tengo otro compromiso medico.'),
        }),
      ]),
    );
  });

  it('HU-11 registra un recordatorio 24 horas antes y evita duplicados', async () => {
    const created = await services.citas.create({
      pacienteId,
      medicoId,
      fechaHora: '2026-07-16T08:00',
    });
    expect(created.ok).toBe(true);

    const firstRun = await services.citas.send24HourReminders(new Date('2026-07-15T08:00:00'));
    const secondRun = await services.citas.send24HourReminders(new Date('2026-07-15T08:00:00'));

    expect(firstRun.processed).toBe(1);
    expect(secondRun.processed).toBe(0);

    const log = await services.notificaciones.list();
    expect(log.filter((notificacion) => notificacion.tipo === 'RECORDATORIO_24H')).toHaveLength(1);
  });

  it('HU-15 el dashboard refleja las citas y notificaciones registradas', async () => {
    await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${pacienteToken}`)
      .send({ medicoId, fechaHora: '2026-07-16T08:00' });

    const response = await request(app).get('/api/reportes/dashboard').set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.stats.totalCitas).toBe(1);

    const log = await request(app).get('/api/notificaciones').set('Authorization', `Bearer ${adminToken}`);
    expect(log.body.notificaciones).toHaveLength(1);
  });

  it('rechaza el acceso a /api/notificaciones si el usuario no es ADMIN', async () => {
    const response = await request(app).get('/api/notificaciones').set('Authorization', `Bearer ${pacienteToken}`);
    expect(response.status).toBe(403);
  });
});