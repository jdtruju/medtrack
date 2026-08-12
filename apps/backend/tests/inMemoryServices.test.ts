import { describe, expect, it } from 'vitest';
import { createInMemoryServices } from '../src/repositories/inMemoryRepositories';

describe('createInMemoryServices', () => {
  it('registra, loguea y bloquea tras 5 intentos fallidos', async () => {
    const services = createInMemoryServices();

    const registered = await services.auth.register({
      nombre: 'Ana',
      apellido: 'Mora',
      email: 'ana@medtrack.test',
      password: 'Segura123',
    });
    expect(registered.ok).toBe(true);

    const dup = await services.auth.register({
      nombre: 'Otra',
      apellido: 'Persona',
      email: 'ana@medtrack.test',
      password: 'Segura123',
    });
    expect(dup).toEqual({
      ok: false,
      error: { status: 409, message: 'Este correo ya esta registrado. Por favor inicia sesion o usa otro correo.' },
    });

    for (let i = 0; i < 4; i += 1) {
      const attempt = await services.auth.login('ana@medtrack.test', 'mala');
      expect(attempt.ok).toBe(false);
    }
    const fifth = await services.auth.login('ana@medtrack.test', 'mala');
    expect(fifth).toEqual({
      ok: false,
      error: { status: 403, message: 'Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.' },
    });

    const success = await services.auth.login('ana@medtrack.test', 'Segura123');
    expect(success.ok).toBe(false);
  });

  it('registra especialidades semilla y permite crear medicos sin licencia duplicada', async () => {
    const services = createInMemoryServices();
    const especialidades = await services.especialidades.list();
    expect(especialidades.length).toBeGreaterThan(0);

    const especialidadId = especialidades[0]!.id;
    const created = await services.medicos.create({
      nombre: 'Elena',
      apellido: 'Campos',
      email: 'elena@medtrack.test',
      licencia: 'MED-1',
      especialidadId,
    });
    expect(created.ok).toBe(true);

    const dup = await services.medicos.create({
      nombre: 'Otro',
      apellido: 'Medico',
      email: 'otro@medtrack.test',
      licencia: 'MED-1',
      especialidadId,
    });
    expect(dup).toEqual({
      ok: false,
      error: { status: 409, message: 'Ya existe un medico con esta cedula profesional.' },
    });
  });

  it('crea, edita y elimina horarios validando que la hora de fin sea posterior', async () => {
    const services = createInMemoryServices();
    const [especialidad] = await services.especialidades.list();
    if (!especialidad) throw new Error('setup failed');

    const medico = await services.medicos.create({
      nombre: 'Dr',
      apellido: 'Lopez',
      email: 'lopez@medtrack.test',
      licencia: 'MED-2',
      especialidadId: especialidad.id,
    });
    if (!medico.ok) throw new Error('setup failed');

    const invalid = await services.horarios.create({
      medicoId: medico.value.id,
      diaSemana: 'LUN',
      horaInicio: '10:00',
      horaFin: '09:00',
    });
    expect(invalid.ok).toBe(false);

    const created = await services.horarios.create({
      medicoId: medico.value.id,
      diaSemana: 'LUN',
      horaInicio: '08:00',
      horaFin: '12:00',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('unreachable');

    const updated = await services.horarios.update(created.value.id, {
      medicoId: medico.value.id,
      diaSemana: 'LUN',
      horaInicio: '09:00',
      horaFin: '13:00',
    });
    expect(updated.ok).toBe(true);

    const listed = await services.horarios.list({ medicoId: medico.value.id });
    expect(listed).toHaveLength(1);

    const removed = await services.horarios.remove(created.value.id);
    expect(removed.ok).toBe(true);

    const afterRemove = await services.horarios.list({ medicoId: medico.value.id });
    expect(afterRemove).toHaveLength(0);
  });
});
