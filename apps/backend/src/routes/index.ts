import { Router } from 'express';
import type { AppServices } from '../services/appServices';
import { createAuthRouter } from './auth';
import { createCitasRouter } from './citas';
import { createEspecialidadesRouter } from './especialidades';
import { createHorariosRouter } from './horarios';
import { createMedicosRouter } from './medicos';
import { createReportesRouter } from './reportes';
import { healthRouter } from './health';

export function apiRouter(services: AppServices) {
  const router = Router();
  router.use(healthRouter);
  router.use('/api/auth', createAuthRouter(services));
  router.use('/api/especialidades', createEspecialidadesRouter(services));
  router.use('/api/medicos', createMedicosRouter(services));
  router.use('/api/horarios', createHorariosRouter(services));
  router.use('/api/citas', createCitasRouter(services));
  router.use('/api/reportes', createReportesRouter(services));
  return router;
}
