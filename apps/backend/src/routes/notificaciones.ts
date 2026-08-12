import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import type { AppServices } from '../services/appServices';

export function createNotificacionesRouter(services: AppServices) {
  const router = Router();

  router.get('/', requireAuth(services), requireRole(services, 'ADMIN'), async (_req, res) => {
    const notificaciones = await services.notificaciones.list();
    res.status(200).json({ notificaciones });
  });

  return router;
}
