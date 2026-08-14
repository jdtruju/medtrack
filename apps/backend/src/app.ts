import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { notFound } from './middlewares/notFound';
import { apiRouter } from './routes';
import type { AppServices } from './services/appServices';

export function createApp(services: AppServices) {
  const app = express();

  app.use(cors({ origin: env.corsOrigins }));
  app.use(express.json());
  app.use(apiRouter(services));
  app.use(notFound);
  app.use(errorHandler);

  return app;
}