import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middlewares/auth';
import type { AppServices } from '../services/appServices';

const fechaSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha no es válida.');

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
    const desdeRaw = typeof req.query.desde === 'string' ? req.query.desde : undefined;
    const hastaRaw = typeof req.query.hasta === 'string' ? req.query.hasta : undefined;

    const desdeParsed = desdeRaw ? fechaSchema.safeParse(desdeRaw) : undefined;
    if (desdeParsed && !desdeParsed.success) {
      res.status(400).json({ error: 'El parámetro "desde" no es una fecha válida.' });
      return;
    }
    const hastaParsed = hastaRaw ? fechaSchema.safeParse(hastaRaw) : undefined;
    if (hastaParsed && !hastaParsed.success) {
      res.status(400).json({ error: 'El parámetro "hasta" no es una fecha válida.' });
      return;
    }
    if (desdeRaw && hastaRaw && hastaRaw < desdeRaw) {
      res.status(400).json({ error: 'La fecha "hasta" no puede ser anterior a "desde".' });
      return;
    }

    const items = await services.reportes.citas({ medicoId, desde: desdeRaw, hasta: hastaRaw });
    res.status(200).json({ items });
  });

  return router;
}
