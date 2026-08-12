import { Router } from 'express';
import type { AppServices } from '../services/appServices';
import { createAuthRouter } from './auth';
import { createEspecialidadesRouter } from './especialidades';
import { healthRouter } from './health';
import { createHorariosRouter } from './horarios';
import { createMedicosRouter } from './medicos';

export function createApiRouter(services: AppServices) {
  const router = Router();

  router.use(healthRouter);
  router.use('/api/auth', createAuthRouter(services));
  router.use('/api/especialidades', createEspecialidadesRouter(services));
  router.use('/api/medicos', createMedicosRouter(services));
  router.use('/api/horarios', createHorariosRouter(services));

  return router;
}
