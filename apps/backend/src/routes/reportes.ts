import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import type { AppServices, TipoNotificacion } from '../services/appServices';

export function createReportesRouter(services: AppServices) {
  const router = Router();

  router.get('/resumen', requireAuth(services), requireRole(services, 'ADMIN'), async (_req, res) => {
    let especialidades;
    let medicos;
    let horarios;
    let citas;
    let notificaciones;

    try {
      [especialidades, medicos, horarios, citas, notificaciones] = await Promise.all([
        services.especialidades.list(),
        services.medicos.list(),
        services.horarios.list({}),
        services.citas.listAll(),
        services.notificaciones.list(),
      ]);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
      return;
    }

    const notificacionesPorTipo = notificaciones.reduce<Record<TipoNotificacion, number>>(
      (acc, notificacion) => {
        acc[notificacion.tipo] += 1;
        return acc;
      },
      {
        CONFIRMACION_RESERVA: 0,
        RECORDATORIO_24H: 0,
        CANCELACION_CITA: 0,
      },
    );
    const medicosPorEspecialidad = especialidades.map((especialidad) => ({
      especialidadId: especialidad.id,
      nombre: especialidad.nombre,
      medicos: medicos.filter((medico) => medico.especialidadId === especialidad.id).length,
    }));
    const horariosPorDia = ['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM'].map((diaSemana) => ({
      diaSemana,
      horarios: horarios.filter((horario) => horario.diaSemana === diaSemana).length,
    }));
    const citasPorEstado = {
      RESERVADA: citas.filter((cita) => cita.estado === 'RESERVADA').length,
      CANCELADA: citas.filter((cita) => cita.estado === 'CANCELADA').length,
    };
    const proximasCitas = citas
      .filter((cita) => cita.estado === 'RESERVADA')
      .sort((a, b) => `${a.fecha}T${a.horaInicio}`.localeCompare(`${b.fecha}T${b.horaInicio}`))
      .slice(0, 5);

    res.status(200).json({
      resumen: {
        especialidades: especialidades.length,
        medicos: medicos.length,
        horarios: horarios.length,
        citasReservadas: citasPorEstado.RESERVADA,
        citasCanceladas: citasPorEstado.CANCELADA,
        notificaciones: notificaciones.length,
        notificacionesPorTipo,
        citasPorEstado,
      },
      actividad: notificaciones.slice(0, 6),
      medicosPorEspecialidad,
      horariosPorDia,
      proximasCitas,
    });
  });

  return router;
}
