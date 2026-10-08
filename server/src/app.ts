import type { Server } from 'node:http';
import express, { type Application, type Request, type Response, Router } from 'express';
import status from 'http-status';
import type { DataSource } from 'typeorm';
import { config } from './config';
import { globalErrorHandler, HttpError, httpErrorTransformer } from './errors';
import { logger } from './logger';
import { initDb } from './providers/db';
import todoRouter from './routers/todoRouter';
import { security } from './security';

export async function createApp(dataSource?: DataSource): Promise<Application> {
  await initDb(dataSource);

  const app = express()
    .use(security)
    .use(express.json())
    .use(logger)
    .get('/', (_req: Request, res: Response) => {
      res.send('To-Do List API');
    })
    .get('/health', (_req: Request, res: Response) => {
      res.status(status.NO_CONTENT).end();
    })
    .use('/api', Router({ mergeParams: true }).use('/v0/todos', todoRouter))
    .use((req: Request, _res: Response, next: express.NextFunction) => {
      next(
        new HttpError('Route not found', null, {
          protocol: req.protocol,
          host: req.get('host'),
          originalUrl: req.originalUrl
        })
      );
    })
    .use(globalErrorHandler)
    .use(httpErrorTransformer);

  return app;
}

export async function startApp(): Promise<Server> {
  const app = await createApp();
  const server = app.listen(config.port, config.host);
  console.info(`Service started. Waiting for requests on port ${config.port}.`);
  return server;
}
