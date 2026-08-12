import bcrypt from 'bcrypt';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createSessionToken } from '../src/services/tokens';
import {
  createInMemoryServices,
  InMemoryPasswordResetRepository,
  InMemoryUserRepository,
} from './helpers/inMemoryServices';

describe('Epica 1 - Gestion de Usuarios', () => {
  it('HU-01 registra datos obligatorios de paciente y confirma al finalizar', async () => {
    const services = createInMemoryServices();
    const app = createApp(services);

    const response = await request(app).post('/auth/register').send({
      nombre: 'Ana',
      apellido: 'Mora',
      email: 'ana@medtrack.test',
      password: 'Segura123',
    });

    expect(response.status).toBe(201);
    expect(response.body.message).toContain('Registro completado');
    expect(response.body.user).toMatchObject({ email: 'ana@medtrack.test', rol: 'PACIENTE' });
  });

  it('HU-01 no permite correo duplicado', async () => {
    const services = createInMemoryServices();
    const app = createApp(services);
    const payload = {
      nombre: 'Ana',
      apellido: 'Mora',
      email: 'ana@medtrack.test',
      password: 'Segura123',
    };

    await request(app).post('/auth/register').send(payload);
    const response = await request(app).post('/auth/register').send(payload);

    expect(response.status).toBe(409);
    expect(response.body.error).toContain('Ya existe');
  });

  it('HU-02 ingresa con credenciales validas y rechaza credenciales incorrectas', async () => {
    const services = createInMemoryServices();
    const users = services.users as InMemoryUserRepository;
    const app = createApp(services);
    await users.createPatient({
      nombre: 'Luis',
      apellido: 'Solano',
      email: 'luis@medtrack.test',
      passwordHash: await bcrypt.hash('Correcta123', 10),
    });

    const failed = await request(app).post('/auth/login').send({
      email: 'luis@medtrack.test',
      password: 'Mala123',
    });
    const success = await request(app).post('/auth/login').send({
      email: 'luis@medtrack.test',
      password: 'Correcta123',
    });

    expect(failed.status).toBe(401);
    expect(success.status).toBe(200);
    expect(success.body.token).toBeTruthy();
  });

  it('HU-02 bloquea la cuenta tras varios intentos fallidos', async () => {
    const services = createInMemoryServices();
    const users = services.users as InMemoryUserRepository;
    const app = createApp(services);
    await users.createPatient({
      nombre: 'Luis',
      apellido: 'Solano',
      email: 'luis@medtrack.test',
      passwordHash: await bcrypt.hash('Correcta123', 10),
    });

    await request(app).post('/auth/login').send({ email: 'luis@medtrack.test', password: 'x' });
    await request(app).post('/auth/login').send({ email: 'luis@medtrack.test', password: 'x' });
    const response = await request(app).post('/auth/login').send({ email: 'luis@medtrack.test', password: 'x' });

    expect(response.status).toBe(423);
    expect(response.body.error).toContain('bloqueada');
  });

  it('HU-03 envia correo simulado de recuperacion', async () => {
    const services = createInMemoryServices();
    const users = services.users as InMemoryUserRepository;
    const app = createApp(services);
    await users.createPatient({
      nombre: 'Maria',
      apellido: 'Diaz',
      email: 'maria@medtrack.test',
      passwordHash: await bcrypt.hash('Anterior123', 10),
    });

    const response = await request(app).post('/auth/forgot-password').send({ email: 'maria@medtrack.test' });

    expect(response.status).toBe(200);
    expect(services.mail.sentPasswordResetEmails).toHaveLength(1);
  });

  it('HU-03 rechaza enlaces expirados', async () => {
    const services = createInMemoryServices();
    const resets = services.passwordResets as InMemoryPasswordResetRepository;
    const app = createApp(services);
    await resets.create({
      usuarioId: 'user-1',
      token: 'expired-token-with-enough-length',
      expiraEn: new Date(Date.now() - 1000),
    });

    const response = await request(app).post('/auth/reset-password').send({
      token: 'expired-token-with-enough-length',
      password: 'Nueva1234',
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('expiro');
  });

  it('HU-03 permite crear una nueva contrasena con enlace valido', async () => {
    const services = createInMemoryServices();
    const users = services.users as InMemoryUserRepository;
    const resets = services.passwordResets as InMemoryPasswordResetRepository;
    const app = createApp(services);
    const user = await users.createPatient({
      nombre: 'Maria',
      apellido: 'Diaz',
      email: 'maria@medtrack.test',
      passwordHash: await bcrypt.hash('Anterior123', 10),
    });
    await resets.create({
      usuarioId: user.id,
      token: 'valid-token-with-enough-length',
      expiraEn: new Date(Date.now() + 60_000),
    });

    const response = await request(app).post('/auth/reset-password').send({
      token: 'valid-token-with-enough-length',
      password: 'Nueva1234',
    });
    const login = await request(app).post('/auth/login').send({
      email: 'maria@medtrack.test',
      password: 'Nueva1234',
    });

    expect(response.status).toBe(200);
    expect(login.status).toBe(200);
  });

  it('HU-04 registra medico y asigna especialidad como administrador', async () => {
    const services = createInMemoryServices();
    const app = createApp(services);
    const token = createSessionToken({ sub: 'admin-1', email: 'admin@medtrack.test', rol: 'ADMIN' });

    const response = await request(app)
      .post('/doctors')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: 'Elena',
        apellido: 'Campos',
        email: 'elena@medtrack.test',
        licencia: 'MED-123',
        especialidadNombre: 'Pediatria',
      });

    expect(response.status).toBe(201);
    expect(response.body.doctor.especialidad.nombre).toBe('Pediatria');
  });

  it('HU-04 evita duplicados de medico', async () => {
    const services = createInMemoryServices();
    const app = createApp(services);
    const token = createSessionToken({ sub: 'admin-1', email: 'admin@medtrack.test', rol: 'ADMIN' });
    const payload = {
      nombre: 'Elena',
      apellido: 'Campos',
      email: 'elena@medtrack.test',
      licencia: 'MED-123',
      especialidadNombre: 'Pediatria',
    };

    await request(app).post('/doctors').set('Authorization', `Bearer ${token}`).send(payload);
    const response = await request(app).post('/doctors').set('Authorization', `Bearer ${token}`).send(payload);

    expect(response.status).toBe(409);
    expect(response.body.error).toContain('Ya existe');
  });
});
