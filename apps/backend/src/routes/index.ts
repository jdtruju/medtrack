import { Router } from 'express';
import type { AppServices } from '../services/appServices';
import { createAuthRouter } from './auth';
import { createDoctorsRouter } from './doctors';
import { healthRouter } from './health';

export function apiRouter(services: AppServices) {
  const router = Router();

  router.use(healthRouter);
  router.use(createAuthRouter(services));
  router.use(createDoctorsRouter(services));

  return router;
}
