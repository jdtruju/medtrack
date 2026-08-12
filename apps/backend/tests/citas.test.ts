import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createInMemoryServices } from './helpers/inMemoryServices';

let services: ReturnType<typeof createInMemoryServices>;
let app: ReturnType<typeof createApp>;
let pacienteToken: string;
let pacienteId: string;
let medicoId: string;

beforeEach(async () => {
  services = createInMemoryServices();
  app = createApp(services);

  await services.auth.register({ nombre: 'Ana', apellido: 'Mora', email: 'ana@medtrack.test', password: 'Segura123' });
  const login = await services.auth.login('ana@medtrack.test', 'Segura123');
  if (login.ok) {
    pacienteToken = login.value.token;
    pacienteId = login.value.usuario.id;
  }

  const especialidades = await services.especialidades.list();
  const medico = await services.medicos.create({
    nombre: 'Dr',
    apellido: 'Garcia',
    email: 'garcia@medtrack.test',
    licencia: 'MED-1',
    especialidadId: especialidades[0].id,
  });
  if (medico.ok) medicoId = medico.value.id;

  // 2026-07-16 es jueves
  await services.horarios.create({ medicoId, diaSemana: 'JUE', horaInicio: '08:00', horaFin: '12:00' });
});

describe('GET /api/citas/disponibilidad', () => {
  it('devuelve las franjas libres de un medico en una fecha', async () => {
    const response = await request(app)
      .get(`/api/citas/disponibilidad?medicoId=${medicoId}&fecha=2026-07-16`)
      .set('Authorization', `Bearer ${pacienteToken}`);

    expect(response.status).toBe(200);
    expect(response.body.franjas).toContain('10:00');
  });
});

describe('POST /api/citas', () => {
  it('HU-07 agenda una cita valida', async () => {
    const response = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${pacienteToken}`)
      .send({ medicoId, fechaHora: '2026-07-16T10:00' });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Tu cita ha sido agendada exitosamente.');
  });

  it('HU-07 rechaza la doble reserva del mismo horario (dos pacientes distintos)', async () => {
    await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${pacienteToken}`)
      .send({ medicoId, fechaHora: '2026-07-16T10:00' });

    await services.auth.register({ nombre: 'Otro', apellido: 'Paciente', email: 'otro@medtrack.test', password: 'Segura123' });
    const otroLogin = await services.auth.login('otro@medtrack.test', 'Segura123');
    if (!otroLogin.ok) throw new Error('setup failed');

    const response = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${otroLogin.value.token}`)
      .send({ medicoId, fechaHora: '2026-07-16T10:00' });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Lo sentimos, este horario ya no está disponible. Por favor selecciona otro.');
  });
});

describe('GET /api/citas', () => {
  it('solo devuelve las citas del paciente autenticado', async () => {
    await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${pacienteToken}`)
      .send({ medicoId, fechaHora: '2026-07-16T10:00' });

    const response = await request(app).get('/api/citas').set('Authorization', `Bearer ${pacienteToken}`);

    expect(response.status).toBe(200);
    expect(response.body.citas).toHaveLength(1);
    expect(response.body.citas[0].pacienteId).toBe(pacienteId);
  });
});

describe('PUT /api/citas/:id/reprogramar y /cancelar', () => {
  it('HU-08 reprograma una cita a un nuevo horario', async () => {
    const created = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${pacienteToken}`)
      .send({ medicoId, fechaHora: '2026-07-16T10:00' });

    const response = await request(app)
      .put(`/api/citas/${created.body.cita.id}/reprogramar`)
      .set('Authorization', `Bearer ${pacienteToken}`)
      .send({ fechaHora: '2026-07-16T11:00' });

    expect(response.status).toBe(200);
    expect(response.body.cita.fechaHora).toBe('2026-07-16T11:00');
  });

  it('HU-09 cancela una cita y libera el horario', async () => {
    const created = await request(app)
      .post('/api/citas')
      .set('Authorization', `Bearer ${pacienteToken}`)
      .send({ medicoId, fechaHora: '2026-07-16T10:00' });

    const cancelResponse = await request(app)
      .put(`/api/citas/${created.body.cita.id}/cancelar`)
      .set('Authorization', `Bearer ${pacienteToken}`);
    expect(cancelResponse.status).toBe(200);

    const disponibilidad = await request(app)
      .get(`/api/citas/disponibilidad?medicoId=${medicoId}&fecha=2026-07-16`)
      .set('Authorization', `Bearer ${pacienteToken}`);
    expect(disponibilidad.body.franjas).toContain('10:00');
  });
});
