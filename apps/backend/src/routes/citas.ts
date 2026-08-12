import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/auth';
import type { AppServices } from '../services/appServices';

const fechaHoraSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'La fecha y hora no son válidas.');

const crearCitaSchema = z.object({
  medicoId: z.string().trim().min(1, 'El médico es obligatorio.'),
  fechaHora: fechaHoraSchema,
});

const reprogramarSchema = z.object({
  fechaHora: fechaHoraSchema,
});

export function createCitasRouter(services: AppServices) {
  const router = Router();

  router.get('/disponibilidad', requireAuth(services), async (req, res) => {
    const medicoId = typeof req.query.medicoId === 'string' ? req.query.medicoId : '';
    const fecha = typeof req.query.fecha === 'string' ? req.query.fecha : '';
    if (!medicoId || !fecha) {
      res.status(400).json({ error: 'Médico y fecha son obligatorios.' });
      return;
    }

    const franjas = await services.citas.listSlotsDisponibles(medicoId, fecha);
    res.status(200).json({ franjas });
  });

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
      pacienteId: req.user!.id,
      medicoId: parsed.data.medicoId,
      fechaHora: parsed.data.fechaHora,
    });
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.message });
      return;
    }

    res.status(201).json({ message: 'Tu cita ha sido agendada exitosamente.', cita: result.value });
  });

  router.put('/:id/reprogramar', requireAuth(services), async (req, res) => {
    const parsed = reprogramarSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]!.message });
      return;
    }

    const result = await services.citas.reprogramar(req.params.id!, req.user!.id, parsed.data.fechaHora);
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.message });
      return;
    }

    res.status(200).json({ message: 'Tu cita ha sido reprogramada exitosamente.', cita: result.value });
  });

  router.put('/:id/cancelar', requireAuth(services), async (req, res) => {
    const result = await services.citas.cancelar(req.params.id!, req.user!.id);
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.message });
      return;
    }

    res.status(200).json({ message: 'Tu cita ha sido cancelada.' });
  });

  return router;
}
