import type { TokenUser } from '../services/appServices';

declare global {
  namespace Express {
    interface Request {
      user?: TokenUser;
    }
  }
}

export {};