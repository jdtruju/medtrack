import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middlewares/auth';
import type { AppServices } from '../services/appServices';

const horarioSchema = z.object({
  medicoId: z.string().trim().min(1, 'El médico es obligatorio.'),
  diaSemana: z.enum(['LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB', 'DOM']),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/, 'La hora de inicio no es válida.'),
  horaFin: z.string().regex(/^\d{2}:\d{2}$/, 'La hora de fin no es válida.'),
});

export function createHorariosRouter(services: AppServices) {
  const router = Router();

  router.get('/', requireAuth(services), async (req, res) => {
    const medicoId = typeof req.query.medicoId === 'string' ? req.query.medicoId : undefined;
    const especialidadId = typeof req.query.especialidadId === 'string' ? req.query.especialidadId : undefined;
    const horarios = await services.horarios.list({ medicoId, especialidadId });
    res.status(200).json({ horarios });
  });

  router.post('/', requireAuth(services), requireRole(services, 'ADMIN'), async (req, res) => {
    const parsed = horarioSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const result = await services.horarios.create(parsed.data);
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.message });
      return;
    }

    res.status(201).json({ message: 'Horario creado correctamente.', horario: result.value });
  });

  router.put('/:id', requireAuth(services), requireRole(services, 'ADMIN'), async (req, res) => {
    const parsed = horarioSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const result = await services.horarios.update(req.params.id, parsed.data);
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.message });
      return;
    }

    res.status(200).json({ message: 'Horario actualizado correctamente.', horario: result.value });
  });

  router.delete('/:id', requireAuth(services), requireRole(services, 'ADMIN'), async (req, res) => {
    const result = await services.horarios.remove(req.params.id);
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.message });
      return;
    }

    res.status(200).json({ message: 'Horario eliminado correctamente.' });
  });

  return router;
}
