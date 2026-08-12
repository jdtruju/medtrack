import { Router } from 'express';
import type { AppServices } from '../services/appServices';

export function createEspecialidadesRouter(services: AppServices) {
  const router = Router();

  router.get('/', async (_req, res) => {
    const especialidades = await services.especialidades.list();
    res.status(200).json({ especialidades });
  });

  return router;
}
