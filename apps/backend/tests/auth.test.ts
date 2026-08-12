import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createInMemoryServices } from '../src/repositories/inMemoryRepositories';

let services: ReturnType<typeof createInMemoryServices>;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  services = createInMemoryServices();
  app = createApp(services);
});

describe('POST /api/auth/register', () => {
  it('HU-01 registra un paciente valido', async () => {
    const response = await request(app).post('/api/auth/register').send({
      nombre: 'Ana',
      apellido: 'Mora',
      email: 'ana@medtrack.test',
      password: 'Segura123',
    });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Cuenta creada exitosamente. Bienvenido a MedTrack.');
  });

  it('HU-01 rechaza un correo duplicado', async () => {
    await request(app).post('/api/auth/register').send({
      nombre: 'Ana',
      apellido: 'Mora',
      email: 'ana@medtrack.test',
      password: 'Segura123',
    });

    const response = await request(app).post('/api/auth/register').send({
      nombre: 'Otra',
      apellido: 'Persona',
      email: 'ana@medtrack.test',
      password: 'Segura123',
    });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Este correo ya esta registrado. Por favor inicia sesion o usa otro correo.');
  });

  it('HU-01 exige el nombre', async () => {
    const response = await request(app).post('/api/auth/register').send({
      nombre: '',
      apellido: 'Mora',
      email: 'ana@medtrack.test',
      password: 'Segura123',
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('El nombre es un campo obligatorio.');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await services.auth.register({
      nombre: 'Ana',
      apellido: 'Mora',
      email: 'ana@medtrack.test',
      password: 'Segura123',
    });
  });

  it('HU-02 autentica con credenciales validas', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@medtrack.test', password: 'Segura123' });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeTruthy();
    expect(response.body.usuario.email).toBe('ana@medtrack.test');
  });

  it('HU-02 rechaza credenciales incorrectas con contador', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@medtrack.test', password: 'mala' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Correo o contrasena incorrectos. Intento 1 de 5.');
  });

  it('HU-02 bloquea la cuenta tras 5 intentos fallidos', async () => {
    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/auth/login').send({ email: 'ana@medtrack.test', password: 'mala' });
    }

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@medtrack.test', password: 'Segura123' });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.');
  });
});

describe('POST /api/auth/forgot-password', () => {
  it('HU-03 responde igual exista o no el correo', async () => {
    const response = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'no-existe@medtrack.test' });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Si el correo existe, recibiras un enlace de recuperacion.');
  });
});

describe('POST /api/auth/reset-password', () => {
  it('HU-03 rechaza un token invalido', async () => {
    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({ accessToken: 'token-invalido', password: 'Nueva1234' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Este enlace ha expirado. Por favor solicita uno nuevo.');
  });

  it('HU-03 permite crear una nueva contrasena con un token valido', async () => {
    await services.auth.register({
      nombre: 'Ana',
      apellido: 'Mora',
      email: 'ana@medtrack.test',
      password: 'Segura123',
    });
    const login = await services.auth.login('ana@medtrack.test', 'Segura123');
    if (!login.ok) throw new Error('setup failed');

    const response = await request(app)
      .post('/api/auth/reset-password')
      .send({ accessToken: login.value.token, password: 'Nueva1234' });

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Contrasena actualizada correctamente.');

    const relogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ana@medtrack.test', password: 'Nueva1234' });
    expect(relogin.status).toBe(200);
  });
});
