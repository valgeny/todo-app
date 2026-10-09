import type { NextFunction, Request, Response } from 'express';
import type { z } from 'zod';

declare module 'express-serve-static-core' {
  interface Request {
    validated: {
      query: Record<string, unknown>;
      body: Record<string, unknown>;
      params: Record<string, unknown>;
    };
  }
}

export type ValidationSchemas = {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
};

export type ValidatedRequest = Request;

export const validate = (schemas: ValidationSchemas) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const validated: Request['validated'] = {
      query: req.query as Record<string, unknown>,
      body: (req.body || {}) as Record<string, unknown>,
      params: req.params as Record<string, unknown>
    };

    try {
      if (schemas.params) {
        validated.params = schemas.params.parse(req.params) as Record<string, unknown>;
      }
      if (schemas.query) {
        validated.query = schemas.query.parse(req.query) as Record<string, unknown>;
      }
      if (schemas.body) {
        validated.body = schemas.body.parse(req.body ?? {}) as Record<string, unknown>;
      }
    } catch (error) {
      next(error);
      return;
    }

    req.validated = validated;
    next();
  };
};
