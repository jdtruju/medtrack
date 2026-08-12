import { Router } from 'express';
import { z } from 'zod';
import type { AppServices } from '../services/appServices';

const registerSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es un campo obligatorio.'),
  apellido: z.string().trim().min(1, 'El apellido es un campo obligatorio.'),
  email: z.string().trim().email('El correo electrónico no es válido.'),
  telefono: z.string().trim().optional(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
});

const loginSchema = z.object({
  email: z.string().trim().min(1, 'El correo es obligatorio.'),
  password: z.string().min(1, 'La contraseña es obligatoria.'),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email('El correo electrónico no es válido.'),
});

const resetPasswordSchema = z.object({
  accessToken: z.string().min(1, 'El enlace no es válido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
});

export function createAuthRouter(services: AppServices) {
  const router = Router();

  router.post('/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]!.message });
      return;
    }

    const result = await services.auth.register(parsed.data);
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.message });
      return;
    }

    res.status(201).json({ message: 'Cuenta creada exitosamente. Bienvenido a MedTrack.' });
  });

  router.post('/login', async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]!.message });
      return;
    }

    const result = await services.auth.login(parsed.data.email, parsed.data.password);
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.message });
      return;
    }

    res.status(200).json({ token: result.value.token, usuario: result.value.usuario });
  });

  router.post('/forgot-password', async (req, res) => {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]!.message });
      return;
    }

    await services.auth.forgotPassword(parsed.data.email);
    res.status(200).json({ message: 'Si el correo existe, recibirás un enlace de recuperación.' });
  });

  router.post('/reset-password', async (req, res) => {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]!.message });
      return;
    }

    const result = await services.auth.resetPassword(parsed.data.accessToken, parsed.data.password);
    if (!result.ok) {
      res.status(result.error.status).json({ error: result.error.message });
      return;
    }

    res.status(200).json({ message: 'Contraseña actualizada correctamente.' });
  });

  return router;
}
