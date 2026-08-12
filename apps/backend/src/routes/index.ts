import { Router } from 'express';
import type { AppServices } from '../services/appServices';
import { healthRouter } from './health';

export function apiRouter(_services: AppServices) {
  const router = Router();
  router.use(healthRouter);
  return router;
}