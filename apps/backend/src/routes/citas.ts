import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middlewares/auth';
import type { AppServices } from '../services/appServices';

const crearCitaSchema = z.object({
  medicoId: z.string().trim().min(1, 'El medico es obligatorio.'),
  horarioId: z.string().trim().min(1, 'El horario es obligatorio.'),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha no es valida.'),
  horaInicio: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'La hora de inicio no es valida.'),
});

const cancelarCitaSchema = z.object({
  motivo: z.string().trim().min(5, 'El motivo de cancelacion debe tener al menos 5 caracteres.'),
});

export function createCitasRouter(services: AppServices) {
  const router = Router();

  router.get('/', requireAuth(services), async (req, res) => {
    const citas = await services.citas.listByPaciente(req.user!.id);
    res.status(200).json({ citas });
  });

  router.post('/', requireAuth(services), async (req, res) => {
    const parsed = crearCitaSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]!.message });
      return;
    }

    const result = await services.citas.create({
      ...parsed.data,
      pacienteId: req.user!.id,
      pacienteEmail: req.user!.email,
    });
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.message });
      return;
    }

    res.status(201).json({ message: 'Cita reservada correctamente.', cita: result.value });
  });

  router.post('/:id/cancelar', requireAuth(services), async (req, res) => {
    const parsed = cancelarCitaSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]!.message });
      return;
    }

    const result = await services.citas.cancel({
      citaId: req.params.id!,
      pacienteId: req.user!.id,
      motivo: parsed.data.motivo,
    });
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.message });
      return;
    }

    res.status(200).json({ message: 'Cita cancelada correctamente.', cita: result.value });
  });

  router.post('/recordatorios/run', requireAuth(services), requireRole(services, 'ADMIN'), async (_req, res) => {
    const result = await services.citas.send24HourReminders();
    res.status(200).json({ message: 'Recordatorios procesados.', processed: result.processed });
  });

  return router;
}
