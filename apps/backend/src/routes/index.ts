import { Router } from 'express';
import type { AppServices } from '../services/appServices';
import { createAuthRouter } from './auth';
import { healthRouter } from './health';

export function apiRouter(services: AppServices) {
  const router = Router();
  router.use(healthRouter);
  router.use('/api/auth', createAuthRouter(services));
  return router;
}
