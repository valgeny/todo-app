import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import status from 'http-status';

export class BaseError extends Error {
  errorId: string;
  errorText: string;
  originalError: Error | null;
  data: unknown | null;
  constructor(
    errorId: string,
    errorText: string,
    originalError: Error | null,
    data: unknown | null
  ) {
    super();
    this.errorId = errorId;
    this.errorText = errorText;
    this.originalError = originalError;
    this.data = data;
  }

  toJson(loggingId: string | null, redactErrors: boolean = false): object {
    const oErr = this.originalError
      ? { name: this.originalError.name, desc: this.originalError.toString() }
      : null;

    const errorObject = Object.assign(
      {
        errorId: this.errorId,
        errorText: this.errorText,
        loggingId: loggingId
      },
      !redactErrors && { originalError: oErr },
      !redactErrors && { data: this.data }
    );

    return JSON.parse(JSON.stringify(errorObject));
  }
}

export class HttpError extends BaseError {
  constructor(errorText: string, originalError: Error | null = null, data: unknown | null = null) {
    super('http-error', errorText || 'Http Error', originalError || null, data || null);
  }
}

export class ValidationError extends BaseError {
  constructor(errorText: string, originalError: Error | null = null, data: unknown | null = null) {
    super('validation-error', errorText || 'Validation Error', originalError || null, data || null);
  }
}

export class AuthError extends BaseError {
  constructor(errorText: string, originalError: Error | null = null, data: unknown | null = null) {
    super('auth-error', errorText || 'Authentication Error', originalError || null, data || null);
  }
}

export class ServiceError extends BaseError {
  constructor(
    errorText: string,
    originalError: Error | null = null,
    data: { req?: unknown; resp?: unknown; time?: unknown } | null = null
  ) {
    super('service-error', errorText || 'Service Error', originalError || null, data || null);
  }
}

export class NotFoundError extends BaseError {
  constructor(
    errorText: string | null = null,
    originalError: Error | null = null,
    data: unknown | null = null
  ) {
    super('not-found-error', errorText || 'Entity not found', originalError || null, data || null);
  }
}

export class EntityError extends BaseError {
  constructor(
    errorText: string | null = null,
    originalError: Error | null = null,
    data: unknown | null = null
  ) {
    super('no-entity-error', errorText || 'Entity error', originalError || null, data || null);
  }
}

export const globalErrorHandler = (
  err: Error | BaseError,
  _req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (err instanceof BaseError) {
    next(err);
  } else if (err.name === 'ValidationError') {
    next(new ValidationError('Bad formatting', err, 'details' in err ? err.details : null));
  } else if (err.name === 'SyntaxError') {
    next(new ValidationError('Invalid JSON formatting', err));
  } else if (err instanceof URIError) {
    next(new ValidationError('Invalid url', err));
  } else {
    next(new BaseError('undefined-error', 'Server has encountered an Error', err, null));
  }
};

export const httpErrorTransformer = (
  err: BaseError,
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (res.headersSent) {
    console.warn('Streaming is not supported');
    next(err);
    return;
  }

  let errorCode: number;
  if (err instanceof ValidationError) {
    errorCode = status.BAD_REQUEST;
  } else if (err instanceof HttpError) {
    errorCode = status.NOT_FOUND;
  } else if (err instanceof AuthError) {
    errorCode = status.UNAUTHORIZED;
  } else if (err instanceof EntityError) {
    errorCode = status.FORBIDDEN;
  } else if (err instanceof NotFoundError) {
    errorCode = status.NOT_FOUND;
  } else if (err instanceof ServiceError) {
    errorCode = status.SERVICE_UNAVAILABLE;
  } else {
    errorCode = status.INTERNAL_SERVER_ERROR;
  }

  if (process.env.NODE_ENV !== 'test') {
    if (errorCode >= status.INTERNAL_SERVER_ERROR) {
      console.error(err.toJson(randomUUID(), false));
    } else if (errorCode === status.NOT_FOUND) {
      // skip noisy 404 logs
    } else if (errorCode >= status.BAD_REQUEST) {
      console.warn(err.toJson(randomUUID(), false));
    }
  }

  res.status(errorCode).send(err.toJson(randomUUID(), false));
};
