import cors from 'cors';
import type { RequestHandler } from 'express';
import helmet from 'helmet';

const localhostOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export const security: RequestHandler[] = [
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }),
  cors({
    origin: localhostOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    exposedHeaders: ['X-total-count']
  })
];
