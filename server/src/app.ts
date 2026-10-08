import type { Server } from 'node:http';
import express, { type Application, type Request, type Response, Router } from 'express';
import status from 'http-status';
import morgan from 'morgan';
import type { DataSource } from 'typeorm';
import { port } from './config';
import { globalErrorHandler, HttpError, httpErrorTransformer } from './errors';
import { initDb } from './providers/db';
import todoRouter from './routers/todoRouter';

export async function createApp(dataSource?: DataSource): Promise<Application> {
  await initDb(dataSource);

  const app: Application = express();

  app.use(express.json());
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev'));
  }

  app.get('/', (_req: Request, res: Response) => {
    res.send('To-Do List API');
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.status(status.NO_CONTENT).end();
  });

  app.use('/api', Router({ mergeParams: true }).use('/v0/todos', todoRouter));

  app.use((req: Request, _res: Response, next: express.NextFunction) => {
    next(
      new HttpError('Route not found', null, {
        protocol: req.protocol,
        host: req.get('host'),
        originalUrl: req.originalUrl
      })
    );
  });

  app.use(globalErrorHandler);
  app.use(httpErrorTransformer);

  return app;
}

export async function startApp(): Promise<Server> {
  const app = await createApp();
  const server = app.listen(port);
  console.info(`Service started. Waiting for requests on port ${port}.`);
  return server;
}
