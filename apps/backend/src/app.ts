import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { notFound } from './middlewares/notFound';
import { createApiRouter } from './routes';
import type { AppServices } from './services/appServices';

export function createApp(services: AppServices) {
  const app = express();

  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());
  app.use(createApiRouter(services));
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
