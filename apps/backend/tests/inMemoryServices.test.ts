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
      error: {
        status: 409,
        message: 'Este correo ya está registrado. Por favor inicia sesión o usa otro correo.',
      },
    });

    for (let i = 0; i < 4; i += 1) {
      const attempt = await services.auth.login('ana@medtrack.test', 'mala');
      expect(attempt.ok).toBe(false);
    }
    const fifth = await services.auth.login('ana@medtrack.test', 'mala');
    expect(fifth).toEqual({
      ok: false,
      error: {
        status: 403,
        message: 'Cuenta bloqueada por seguridad. Intenta de nuevo en 15 minutos.',
      },
    });

    const success = await services.auth.login('ana@medtrack.test', 'Segura123');
    expect(success.ok).toBe(false); // sigue bloqueada, el bloqueo no se salta con la contraseña correcta
  });

  it('registra especialidades semilla y permite crear medicos sin licencia duplicada', async () => {
    const services = createInMemoryServices();
    const especialidades = await services.especialidades.list();
    expect(especialidades.length).toBeGreaterThan(0);

    const especialidadId = especialidades[0].id;
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
      error: { status: 409, message: 'Ya existe un médico con esta cédula profesional.' },
    });
  });

  it('crea, edita y elimina horarios validando que la hora de fin sea posterior', async () => {
    const services = createInMemoryServices();
    const [especialidad] = await services.especialidades.list();
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

  it('crea citas evitando doble reserva y respeta los bloques de horarios', async () => {
    const services = createInMemoryServices();
    const [especialidad] = await services.especialidades.list();
    const medico = await services.medicos.create({
      nombre: 'Dr',
      apellido: 'Garcia',
      email: 'garcia@medtrack.test',
      licencia: 'MED-3',
      especialidadId: especialidad.id,
    });
    if (!medico.ok) throw new Error('setup failed');

    // 2026-07-16 es jueves
    await services.horarios.create({
      medicoId: medico.value.id,
      diaSemana: 'JUE',
      horaInicio: '08:00',
      horaFin: '12:00',
    });

    const franjas = await services.citas.listSlotsDisponibles(medico.value.id, '2026-07-16');
    expect(franjas).toContain('10:00');

    const primera = await services.citas.create({
      pacienteId: 'paciente-1',
      medicoId: medico.value.id,
      fechaHora: '2026-07-16T10:00',
    });
    expect(primera.ok).toBe(true);

    // HU-07 criterio "evita citas duplicadas": doble reserva del mismo horario
    const segunda = await services.citas.create({
      pacienteId: 'paciente-2',
      medicoId: medico.value.id,
      fechaHora: '2026-07-16T10:00',
    });
    expect(segunda).toEqual({
      ok: false,
      error: {
        status: 409,
        message: 'Lo sentimos, este horario ya no está disponible. Por favor selecciona otro.',
      },
    });

    const fueraDeHorario = await services.citas.create({
      pacienteId: 'paciente-3',
      medicoId: medico.value.id,
      fechaHora: '2026-07-16T20:00',
    });
    expect(fueraDeHorario.ok).toBe(false);

    if (!primera.ok) throw new Error('unreachable');

    const reprogramada = await services.citas.reprogramar(
      primera.value.id,
      'paciente-1',
      '2026-07-16T11:00'
    );
    expect(reprogramada.ok).toBe(true);

    const franjasTrasReprogramar = await services.citas.listSlotsDisponibles(
      medico.value.id,
      '2026-07-16'
    );
    expect(franjasTrasReprogramar).toContain('10:00'); // se liberó
    expect(franjasTrasReprogramar).not.toContain('11:00'); // ahora ocupado

    const cancelada = await services.citas.cancelar(primera.value.id, 'paciente-1');
    expect(cancelada.ok).toBe(true);

    const franjasTrasCancelar = await services.citas.listSlotsDisponibles(
      medico.value.id,
      '2026-07-16'
    );
    expect(franjasTrasCancelar).toContain('11:00'); // se liberó al cancelar

    const misCitas = await services.citas.listByPaciente('paciente-1');
    expect(misCitas).toHaveLength(1);
    expect(misCitas[0].estado).toBe('CANCELADA');
  });

  it('calcula el dashboard de reportes: totales y ocupacion por medico', async () => {
    const services = createInMemoryServices();
    const [especialidad] = await services.especialidades.list();

    await services.auth.register({
      nombre: 'Ana',
      apellido: 'Mora',
      email: 'ana@medtrack.test',
      password: 'Segura123',
    });

    const medico = await services.medicos.create({
      nombre: 'Dr',
      apellido: 'Lopez',
      email: 'lopez@medtrack.test',
      licencia: 'MED-9',
      especialidadId: especialidad.id,
    });
    if (!medico.ok) throw new Error('setup failed');

    // 2026-07-16 es jueves; el horario cubre 08:00-09:00 (2 franjas de 30 min)
    await services.horarios.create({
      medicoId: medico.value.id,
      diaSemana: 'JUE',
      horaInicio: '08:00',
      horaFin: '09:00',
    });
    const cita = await services.citas.create({
      pacienteId: 'paciente-1',
      medicoId: medico.value.id,
      fechaHora: '2026-07-16T08:00',
    });
    expect(cita.ok).toBe(true);

    const stats = await services.reportes.dashboard('2026-07-16');
    expect(stats.totalCitas).toBe(1);
    expect(stats.totalPacientes).toBe(1);
    expect(stats.ocupacionPorMedico).toEqual([
      {
        medicoId: medico.value.id,
        nombre: 'Dr',
        apellido: 'Lopez',
        franjasTotales: 2,
        franjasOcupadas: 1,
        porcentaje: 50,
      },
    ]);
  });

  it('calcula la disponibilidad por medico para la semana actual', async () => {
    const services = createInMemoryServices();
    const [especialidad] = await services.especialidades.list();
    const medico = await services.medicos.create({
      nombre: 'Dr',
      apellido: 'Garcia',
      email: 'garcia@medtrack.test',
      licencia: 'MED-10',
      especialidadId: especialidad.id,
    });
    if (!medico.ok) throw new Error('setup failed');

    await services.horarios.create({
      medicoId: medico.value.id,
      diaSemana: 'JUE',
      horaInicio: '08:00',
      horaFin: '09:00',
    });
    await services.citas.create({
      pacienteId: 'paciente-1',
      medicoId: medico.value.id,
      fechaHora: '2026-07-16T08:00',
    });

    const items = await services.reportes.disponibilidad('2026-07-16', medico.value.id);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      medicoId: medico.value.id,
      medicoNombre: 'Dr',
      medicoApellido: 'Garcia',
      diaSemana: 'JUE',
      franjasTotales: 2,
      franjasOcupadas: 1,
      franjasLibres: 1,
    });
  });

  it('filtra el reporte de citas por medico y rango de fechas', async () => {
    const services = createInMemoryServices();
    const [especialidad] = await services.especialidades.list();

    await services.auth.register({
      nombre: 'Ana',
      apellido: 'Mora',
      email: 'ana@medtrack.test',
      password: 'Segura123',
    });
    const login = await services.auth.login('ana@medtrack.test', 'Segura123');
    if (!login.ok) throw new Error('setup failed');
    const pacienteId = login.value.usuario.id;

    const medico = await services.medicos.create({
      nombre: 'Dr',
      apellido: 'Torres',
      email: 'torres@medtrack.test',
      licencia: 'MED-11',
      especialidadId: especialidad.id,
    });
    if (!medico.ok) throw new Error('setup failed');

    // 2026-07-16 es jueves, 2026-07-17 es viernes
    await services.horarios.create({
      medicoId: medico.value.id,
      diaSemana: 'JUE',
      horaInicio: '08:00',
      horaFin: '08:30',
    });
    await services.horarios.create({
      medicoId: medico.value.id,
      diaSemana: 'VIE',
      horaInicio: '08:00',
      horaFin: '08:30',
    });

    const primera = await services.citas.create({
      pacienteId,
      medicoId: medico.value.id,
      fechaHora: '2026-07-16T08:00',
    });
    const segunda = await services.citas.create({
      pacienteId,
      medicoId: medico.value.id,
      fechaHora: '2026-07-17T08:00',
    });
    expect(primera.ok).toBe(true);
    expect(segunda.ok).toBe(true);

    const todas = await services.reportes.citas({ medicoId: medico.value.id });
    expect(todas).toHaveLength(2);
    expect(todas[0]).toMatchObject({
      medicoNombre: 'Dr',
      medicoApellido: 'Torres',
      pacienteNombre: 'Ana',
      pacienteApellido: 'Mora',
    });

    const soloJueves = await services.reportes.citas({
      medicoId: medico.value.id,
      desde: '2026-07-16',
      hasta: '2026-07-16',
    });
    expect(soloJueves).toHaveLength(1);
    expect(soloJueves[0].fechaHora).toBe('2026-07-16T08:00');
  });
});
