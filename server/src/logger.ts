import type { RequestHandler } from 'express';
import morgan from 'morgan';

const silent: RequestHandler = (_req, _res, next) => {
  next();
};

export const logger: RequestHandler = process.env.NODE_ENV === 'test' ? silent : morgan('dev');
