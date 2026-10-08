import type { NextFunction, Request, Response } from 'express';
import type { ObjectSchema } from 'joi';

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
  body?: ObjectSchema;
  query?: ObjectSchema;
  params?: ObjectSchema;
};

export type ValidatedRequest = Request;

const joiOptions = { abortEarly: false, convert: true, stripUnknown: false };

export const validate = (schemas: ValidationSchemas) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const validated: Request['validated'] = {
      query: req.query as Record<string, unknown>,
      body: (req.body || {}) as Record<string, unknown>,
      params: req.params as Record<string, unknown>
    };

    if (schemas.params) {
      const { error, value } = schemas.params.validate(req.params, joiOptions);
      if (error) {
        next(error);
        return;
      }
      validated.params = value;
    }

    if (schemas.query) {
      const { error, value } = schemas.query.validate(req.query, joiOptions);
      if (error) {
        next(error);
        return;
      }
      validated.query = value;
    }

    if (schemas.body) {
      const { error, value } = schemas.body.validate(req.body, joiOptions);
      if (error) {
        next(error);
        return;
      }
      validated.body = value;
    }

    req.validated = validated;
    next();
  };
};
