import path from 'path';
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

  // En producción, este mismo servidor sirve el frontend ya compilado
  // (apps/frontend/dist) para que todo quede en un solo origen, sin CORS
  // entre dos deploys distintos. En desarrollo el frontend corre aparte
  // via Vite, así que esto no aplica.
  if (env.nodeEnv === 'production') {
    const frontendDist = path.join(__dirname, '../../frontend/dist');
    app.use(express.static(frontendDist));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  app.use(notFound);
  app.use(errorHandler);

  return app;
}