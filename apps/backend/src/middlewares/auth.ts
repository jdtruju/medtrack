import type { NextFunction, Request, Response } from 'express';
import type { AppServices } from '../services/appServices';

export function requireAuth(services: AppServices) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      res.status(401).json({ error: 'No autenticado.' });
      return;
    }

    const user = await services.auth.getUserFromToken(token);
    if (!user) {
      res.status(401).json({ error: 'No autenticado.' });
      return;
    }

    req.user = user;
    next();
  };
}

export function requireRole(services: AppServices, role: 'ADMIN') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const rol = await services.auth.getRole(req.user!.id);
    if (rol !== role) {
      res.status(403).json({ error: 'No tienes permisos para acceder a esta sección.' });
      return;
    }
    next();
  };
}