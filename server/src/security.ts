import cors from 'cors';
import type { RequestHandler } from 'express';
import helmet from 'helmet';
import { config } from './config';

const originAllowed = (origin: string | undefined): boolean => {
  if (!origin) {
    return true;
  }
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  return config.allowedOrigins.some(pattern => {
    if (pattern.startsWith('*.')) {
      return url.protocol === 'https:' && url.hostname.endsWith(`.${pattern.slice(2)}`);
    }
    return url.hostname === pattern;
  });
};

export const security: RequestHandler[] = [
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }),
  cors({
    origin: (origin, callback) => {
      callback(null, originAllowed(origin));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    exposedHeaders: ['X-total-count']
  })
];
