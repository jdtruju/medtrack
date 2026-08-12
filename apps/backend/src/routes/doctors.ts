import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../lib/httpError';
import { requireAuth } from '../middlewares/auth';
import type { AppServices } from '../services/appServices';

const doctorSchema = z
  .object({
    nombre: z.string().trim().min(2, 'El nombre del medico es obligatorio.'),
    apellido: z.string().trim().min(2, 'El apellido del medico es obligatorio.'),
    email: z.string().trim().email('El correo no es valido.').transform((value) => value.toLowerCase()),
    telefono: z.string().trim().optional(),
    licencia: z.string().trim().min(3, 'La licencia es obligatoria.'),
    especialidadId: z.string().uuid().optional(),
    especialidadNombre: z.string().trim().min(2).optional(),
  })
  .refine((data) => data.especialidadId || data.especialidadNombre, {
    message: 'Debe asignar una especialidad.',
    path: ['especialidadNombre'],
  });

function parseBody(body: unknown) {
  const result = doctorSchema.safeParse(body);
  if (!result.success) {
    throw new HttpError(400, result.error.errors[0]?.message ?? 'Solicitud invalida.');
  }
  return result.data;
}

export function createDoctorsRouter(services: AppServices) {
  const router = Router();

  router.get('/specialties', async (_req, res, next) => {
    try {
      const specialties = await services.doctors.listSpecialties();
      res.json({ specialties });
    } catch (error) {
      next(error);
    }
  });

  router.post('/doctors', requireAuth(['ADMIN']), async (req, res, next) => {
    try {
      const data = parseBody(req.body);
      const duplicate = await services.doctors.findDuplicate(data.email, data.licencia);
      if (duplicate) {
        throw new HttpError(409, 'Ya existe un medico con ese correo o licencia.');
      }

      const doctor = await services.doctors.createWithSpecialty(data);

      res.status(201).json({
        message: 'Medico registrado correctamente.',
        doctor,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
