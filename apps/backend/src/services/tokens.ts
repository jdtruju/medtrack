import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { env } from '../config/env';

export interface JwtUserPayload {
  sub: string;
  email: string;
  rol: 'PACIENTE' | 'ADMIN';
}

export function createSessionToken(payload: JwtUserPayload): string {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifySessionToken(token: string): JwtUserPayload {
  return jwt.verify(token, env.jwtSecret) as JwtUserPayload;
}

export function createPasswordResetToken(): string {
  return randomBytes(32).toString('hex');
}
