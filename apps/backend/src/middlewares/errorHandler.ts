import type { NextFunction, Request, Response } from 'express';

interface HttpError extends Error {
  statusCode?: number;
}

export function errorHandler(
  err: HttpError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  console.error(err.message);
  res.status(statusCode).json({
    error: statusCode === 500 ? 'Error interno del servidor.' : err.message,
  });
}
