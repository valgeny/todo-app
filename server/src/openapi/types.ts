import type { Schema } from 'joi';
import type { ValidationSchemas } from '@/utils/validate';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export type OpenApiResponseMeta = {
  description: string;
  /** Optional Joi schema for the JSON response body. */
  schema?: Schema;
  /** When true, document as an array of `schema`. */
  isArray?: boolean;
};

export type OpenApiOperationMeta = {
  method: HttpMethod;
  path: string;
  summary: string;
  description?: string;
  tags?: string[];
  operationId?: string;
  responses: Record<string, OpenApiResponseMeta>;
};

export type DocumentedOperation = {
  openapi: OpenApiOperationMeta;
  validation: ValidationSchemas;
};
