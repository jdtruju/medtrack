import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../middlewares/auth';
import type { AppServices } from '../services/appServices';

const createMedicoSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es un campo obligatorio.'),
  apellido: z.string().trim().min(1, 'El apellido es un campo obligatorio.'),
  email: z.string().trim().email('El correo electrónico no es válido.'),
  telefono: z.string().trim().optional(),
  licencia: z.string().trim().min(1, 'La licencia es un campo obligatorio.'),
  especialidadId: z.string().trim().min(1, 'La especialidad es obligatoria.'),
});

export function createMedicosRouter(services: AppServices) {
  const router = Router();

  router.get('/', requireAuth(services), async (_req, res) => {
    const medicos = await services.medicos.list();
    res.status(200).json({ medicos });
  });

  router.post('/', requireAuth(services), requireRole(services, 'ADMIN'), async (req, res) => {
    const parsed = createMedicoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]!.message });
      return;
    }

    const result = await services.medicos.create(parsed.data);
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.message });
      return;
    }

    res.status(201).json({ message: 'Médico registrado correctamente.', medico: result.value });
  });

  return router;
}
