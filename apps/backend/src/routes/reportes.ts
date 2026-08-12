import { Router } from 'express';
import { requireAuth, requireRole } from '../middlewares/auth';
import type { AppServices } from '../services/appServices';

function hoyISO(): string {
  const ahora = new Date();
  const y = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  const d = String(ahora.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function createReportesRouter(services: AppServices) {
  const router = Router();
  router.use(requireAuth(services), requireRole(services, 'ADMIN'));

  router.get('/dashboard', async (_req, res) => {
    const stats = await services.reportes.dashboard(hoyISO());
    res.status(200).json({ stats });
  });

  router.get('/disponibilidad', async (req, res) => {
    const medicoId = typeof req.query.medicoId === 'string' ? req.query.medicoId : undefined;
    const items = await services.reportes.disponibilidad(hoyISO(), medicoId);
    res.status(200).json({ items });
  });

  router.get('/citas', async (req, res) => {
    const medicoId = typeof req.query.medicoId === 'string' ? req.query.medicoId : undefined;
    const desde = typeof req.query.desde === 'string' ? req.query.desde : undefined;
    const hasta = typeof req.query.hasta === 'string' ? req.query.hasta : undefined;
    const items = await services.reportes.citas({ medicoId, desde, hasta });
    res.status(200).json({ items });
  });

  return router;
}
