import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { notFound } from './middlewares/notFound';
import { createInMemoryServices } from './repositories/inMemoryRepositories';
import { createPrismaServices } from './repositories/prismaRepositories';
import { apiRouter } from './routes';
import type { AppServices } from './services/appServices';
import { createDefaultSupportServices } from './services/appServices';

export function createApp(overrides?: Partial<AppServices>) {
  const app = express();
  const dataServices: Partial<AppServices> =
    overrides?.users && overrides.passwordResets && overrides.doctors
      ? {}
      : env.useInMemoryDb
        ? createInMemoryServices()
        : createPrismaServices();
  const supportServices = createDefaultSupportServices();
  const services = { ...dataServices, ...supportServices, ...overrides } as AppServices;

  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json());
  app.use(apiRouter(services));
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
