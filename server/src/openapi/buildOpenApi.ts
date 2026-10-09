import type { Schema } from 'joi';
import parse from 'joi-to-json';
import type { OpenAPIV3 } from 'openapi-types';
import {
  deleteTodo,
  getTodo,
  getTodoBulk,
  patchTodo,
  postTodo,
  putTodo
} from '@/controllers/todoCtrl';
import { apiErrorSchema, todoResponseSchema } from '@/openapi/schemas';
import type { DocumentedOperation } from '@/openapi/types';

const operations: DocumentedOperation[] = [
  getTodoBulk,
  getTodo,
  postTodo,
  putTodo,
  patchTodo,
  deleteTodo
];

function toOpenApiSchema(schema: Schema): OpenAPIV3.SchemaObject {
  return parse(schema, 'open-api') as OpenAPIV3.SchemaObject;
}

function objectSchemaToParameters(
  schema: Schema,
  location: 'query' | 'path'
): OpenAPIV3.ParameterObject[] {
  const json = toOpenApiSchema(schema);
  const properties = json.properties ?? {};
  const required = new Set(json.required ?? []);

  return Object.entries(properties).map(([name, propertySchema]) => ({
    name,
    in: location,
    required: location === 'path' ? true : required.has(name),
    schema: propertySchema as OpenAPIV3.SchemaObject
  }));
}

function mediaSchema(
  responseSchema: Schema | undefined,
  isArray?: boolean
): OpenAPIV3.MediaTypeObject | undefined {
  if (!responseSchema) return undefined;
  const schema = toOpenApiSchema(responseSchema);
  return {
    schema: isArray ? { type: 'array', items: schema } : schema
  };
}

export function buildOpenApiDocument(): OpenAPIV3.Document {
  const paths: OpenAPIV3.PathsObject = {};
  const errorSchema = toOpenApiSchema(apiErrorSchema);
  const todoSchema = toOpenApiSchema(todoResponseSchema);

  for (const operation of operations) {
    const { openapi, validation } = operation;
    if (!paths[openapi.path]) {
      paths[openapi.path] = {};
    }
    const pathItem = paths[openapi.path] as OpenAPIV3.PathItemObject;
    const parameters: OpenAPIV3.ParameterObject[] = [];

    if (validation.params) {
      parameters.push(...objectSchemaToParameters(validation.params, 'path'));
    }
    if (validation.query) {
      parameters.push(...objectSchemaToParameters(validation.query, 'query'));
    }

    const requestBody: OpenAPIV3.RequestBodyObject | undefined = validation.body
      ? {
          required: true,
          content: {
            'application/json': {
              schema: toOpenApiSchema(validation.body)
            }
          }
        }
      : undefined;

    const responses: OpenAPIV3.ResponsesObject = {};
    for (const [statusCode, meta] of Object.entries(openapi.responses)) {
      const content = mediaSchema(meta.schema, meta.isArray);
      const response: OpenAPIV3.ResponseObject = {
        description: meta.description,
        ...(content ? { content: { 'application/json': content } } : {})
      };

      if (statusCode === '200' && openapi.operationId === 'listTodos') {
        response.headers = {
          'X-total-count': {
            description: 'Total number of todos matching the filter.',
            schema: { type: 'integer', minimum: 0 }
          },
          link: {
            description: 'Pagination links (JSON string).',
            schema: { type: 'string' }
          }
        };
      }

      responses[statusCode] = response;
    }

    if (!responses['400']) {
      responses['400'] = {
        description: 'Validation error',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } }
      };
    }

    const isItemRoute = openapi.path.includes('{todoId}');
    if (isItemRoute && !responses['404'] && openapi.method !== 'post') {
      responses['404'] = {
        description: 'Todo not found',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } }
      };
    }

    pathItem[openapi.method] = {
      tags: openapi.tags ?? ['todos'],
      summary: openapi.summary,
      description: openapi.description,
      operationId: openapi.operationId,
      parameters: parameters.length ? parameters : undefined,
      requestBody,
      responses
    };
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'Todo App API',
      version: '1.0.0',
      description:
        'REST API for managing to-do items. Request schemas are generated from the Joi validators colocated with each controller.'
    },
    servers: [
      {
        url: 'http://localhost:8000',
        description: 'Local development'
      }
    ],
    tags: [{ name: 'todos', description: 'To-do item operations' }],
    paths,
    components: {
      schemas: {
        Todo: todoSchema,
        ApiError: errorSchema
      }
    }
  };
}
