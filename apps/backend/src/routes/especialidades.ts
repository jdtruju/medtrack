import { Router } from 'express';
import { requireAuth } from '../middlewares/auth';
import type { AppServices } from '../services/appServices';

export function createEspecialidadesRouter(services: AppServices) {
  const router = Router();

  router.get('/', requireAuth(services), async (_req, res) => {
    const especialidades = await services.especialidades.list();
    res.status(200).json({ especialidades });
  });

  return router;
}
