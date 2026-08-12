import type { NextFunction, Request, Response } from 'express';
import type { RolUsuario } from '@medtrack/shared';
import { HttpError } from '../lib/httpError';
import { verifySessionToken, type JwtUserPayload } from '../services/tokens';

export interface AuthenticatedRequest extends Request {
  user?: JwtUserPayload;
}

export function requireAuth(allowedRoles?: RolUsuario[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const header = req.header('authorization');
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;

    if (!token) {
      next(new HttpError(401, 'Se requiere autenticacion.'));
      return;
    }

    try {
      const payload = verifySessionToken(token);
      if (allowedRoles?.length && !allowedRoles.includes(payload.rol)) {
        next(new HttpError(403, 'No tiene permisos para realizar esta accion.'));
        return;
      }
      req.user = payload;
      next();
    } catch {
      next(new HttpError(401, 'Token invalido o expirado.'));
    }
  };
}
