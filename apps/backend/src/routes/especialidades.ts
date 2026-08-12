import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middlewares/auth';
import type { AppServices } from '../services/appServices';

const especialidadSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre de la especialidad debe tener al menos 2 caracteres.'),
  descripcion: z.string().trim().optional(),
});

export function createEspecialidadesRouter(services: AppServices) {
  const router = Router();

  router.get('/', requireAuth(services), async (_req, res) => {
    const especialidades = await services.especialidades.list();
    res.status(200).json({ especialidades });
  });

  router.post('/', requireAuth(services), requireRole(services, 'ADMIN'), async (req, res) => {
    const parsed = especialidadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]!.message });
      return;
    }

    const result = await services.especialidades.create(parsed.data);
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.message });
      return;
    }

    res.status(201).json({ message: 'Especialidad creada correctamente.', especialidad: result.value });
  });

  router.put('/:id', requireAuth(services), requireRole(services, 'ADMIN'), async (req, res) => {
    const parsed = especialidadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]!.message });
      return;
    }

    const result = await services.especialidades.update(req.params.id!, parsed.data);
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.message });
      return;
    }

    res.status(200).json({ message: 'Especialidad actualizada correctamente.', especialidad: result.value });
  });

  router.delete('/:id', requireAuth(services), requireRole(services, 'ADMIN'), async (req, res) => {
    const result = await services.especialidades.remove(req.params.id!);
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.message });
      return;
    }

    res.status(200).json({ message: 'Especialidad eliminada correctamente.' });
  });

  return router;
}
