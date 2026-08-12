import bcrypt from 'bcrypt';
import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { HttpError } from '../lib/httpError';
import type { AppServices } from '../services/appServices';
import { createPasswordResetToken, createSessionToken } from '../services/tokens';

const MAX_FAILED_ATTEMPTS = 3;
const LOCK_MINUTES = 15;
const RESET_EXPIRATION_MINUTES = 30;

const registerSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre es obligatorio.'),
  apellido: z.string().trim().min(2, 'El apellido es obligatorio.'),
  email: z.string().trim().email('El correo no es valido.').transform((value) => value.toLowerCase()),
  telefono: z.string().trim().optional(),
  password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres.'),
});

const loginSchema = z.object({
  email: z.string().trim().email('El correo no es valido.').transform((value) => value.toLowerCase()),
  password: z.string().min(1, 'La contrasena es obligatoria.'),
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().email('El correo no es valido.').transform((value) => value.toLowerCase()),
});

const resetPasswordSchema = z.object({
  token: z.string().min(20, 'El token no es valido.'),
  password: z.string().min(8, 'La contrasena debe tener al menos 8 caracteres.'),
});

function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HttpError(400, result.error.errors[0]?.message ?? 'Solicitud invalida.');
  }
  return result.data;
}

export function createAuthRouter(services: AppServices) {
  const router = Router();

  router.post('/auth/register', async (req, res, next) => {
    try {
      const data = parseBody(registerSchema, req.body);
      const existingUser = await services.users.findByEmail(data.email);
      if (existingUser) {
        throw new HttpError(409, 'Ya existe una cuenta con este correo.');
      }

      const passwordHash = await bcrypt.hash(data.password, 10);
      const user = await services.users.createPatient({ ...data, passwordHash });

      res.status(201).json({
        message: 'Registro completado. Ya puede iniciar sesion.',
        user: {
          id: user.id,
          email: user.email,
          nombre: user.nombre,
          apellido: user.apellido,
          rol: user.rol,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/auth/login', async (req, res, next) => {
    try {
      const data = parseBody(loginSchema, req.body);
      const user = await services.users.findByEmail(data.email);
      if (!user || !user.activo) {
        throw new HttpError(401, 'Credenciales incorrectas.');
      }

      const now = new Date();
      if (user.bloqueadoHasta && user.bloqueadoHasta > now) {
        throw new HttpError(423, 'La cuenta esta bloqueada temporalmente.');
      }

      const isValidPassword = await bcrypt.compare(data.password, user.passwordHash);
      if (!isValidPassword) {
        const failedAttempts = user.intentosFallidos + 1;
        const bloqueadoHasta =
          failedAttempts >= MAX_FAILED_ATTEMPTS
            ? new Date(now.getTime() + LOCK_MINUTES * 60 * 1000)
            : null;

        await services.users.updateLoginState(user.id, {
          intentosFallidos: failedAttempts,
          bloqueadoHasta,
        });

        throw new HttpError(
          bloqueadoHasta ? 423 : 401,
          bloqueadoHasta
            ? 'La cuenta fue bloqueada temporalmente por intentos fallidos.'
            : 'Credenciales incorrectas.'
        );
      }

      await services.users.updateLoginState(user.id, { intentosFallidos: 0, bloqueadoHasta: null });
      const token = createSessionToken({ sub: user.id, email: user.email, rol: user.rol });

      res.json({
        message: 'Inicio de sesion exitoso.',
        token,
        user: {
          id: user.id,
          email: user.email,
          nombre: user.nombre,
          apellido: user.apellido,
          rol: user.rol,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/auth/forgot-password', async (req, res, next) => {
    try {
      const data = parseBody(forgotPasswordSchema, req.body);
      const user = await services.users.findByEmail(data.email);

      if (user) {
        const token = createPasswordResetToken();
        const expiraEn = new Date(Date.now() + RESET_EXPIRATION_MINUTES * 60 * 1000);
        await services.passwordResets.create({ usuarioId: user.id, token, expiraEn });
        const resetLink = `${env.corsOrigin}/reset-password?token=${token}`;
        await services.mail.sendPasswordResetEmail(user.email, resetLink, token);
      }

      res.json({
        message: 'Si el correo existe, se envio un enlace de recuperacion.',
        mockEmail:
          env.nodeEnv === 'production'
            ? undefined
            : 'El envio de correo esta simulado y queda registrado en MockMailService/logs.',
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/auth/reset-password', async (req, res, next) => {
    try {
      const data = parseBody(resetPasswordSchema, req.body);
      const reset = await services.passwordResets.findValidByToken(data.token, new Date());
      if (!reset) {
        throw new HttpError(400, 'El enlace de recuperacion expiro o no es valido.');
      }

      const passwordHash = await bcrypt.hash(data.password, 10);
      await services.users.updatePassword(reset.usuarioId, passwordHash);
      await services.passwordResets.markUsed(reset.id, new Date());

      res.json({ message: 'Contrasena actualizada correctamente.' });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
