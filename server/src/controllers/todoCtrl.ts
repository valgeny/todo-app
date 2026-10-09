import type { Response } from 'express';
import status from 'http-status';
import Joi from 'joi';
import {
  descriptionSchema,
  dueDateSchema,
  titleSchema,
  todoIdSchema,
  toTodoResponse
} from '@/models/todo';
import { apiErrorSchema, todoResponseSchema } from '@/openapi/schemas';
import type { DocumentedOperation } from '@/openapi/types';
import {
  createTodo,
  getTodoById,
  type ListStatus,
  listTodos,
  deleteTodo as removeTodo,
  type SortField,
  setTodoCompleted,
  updateTodo
} from '@/services/todoService';
import { pagination, sort } from '@/utils/restUtils';
import type { ValidatedRequest } from '@/utils/validate';

const todoIdParams = Joi.object()
  .keys({
    todoId: todoIdSchema.required()
  })
  .required();

const todosPath = '/api/v0/todos';
const todoItemPath = '/api/v0/todos/{todoId}';

export const getTodoBulk: DocumentedOperation & {
  handler: (request: ValidatedRequest, response: Response) => Promise<void>;
} = {
  openapi: {
    method: 'get',
    path: todosPath,
    operationId: 'listTodos',
    summary: 'List todos',
    description: 'Returns a paginated list of todos. Total count is in the `X-total-count` header.',
    tags: ['todos'],
    responses: {
      '200': {
        description: 'Todo list',
        schema: todoResponseSchema,
        isArray: true
      }
    }
  },
  validation: {
    query: Joi.object().keys({
      status: Joi.string().valid('all', 'completed', 'incomplete', 'overdue').default('all'),
      ...sort.validate(['dueDate', 'createdAt', 'title'], 'createdAt', 'DESC'),
      limit: pagination.schema.limit,
      offset: pagination.schema.offset
    })
  },
  handler: async (request: ValidatedRequest, response: Response): Promise<void> => {
    const {
      status: listStatus,
      sortField,
      sortOrder,
      limit,
      offset
    } = request.validated.query as {
      status: ListStatus;
      sortField: SortField;
      sortOrder: 'ASC' | 'DESC';
      limit: number;
      offset: number;
    };

    const { items, count } = await listTodos({
      status: listStatus,
      sortField,
      sortOrder,
      limit,
      offset
    });

    response
      .status(status.OK)
      .set(pagination.addPaginationHeaders({}, count, limit, offset) as Record<string, string>)
      .send(items.map(toTodoResponse));
  }
};

export const getTodo: DocumentedOperation & {
  handler: (request: ValidatedRequest, response: Response) => Promise<void>;
} = {
  openapi: {
    method: 'get',
    path: todoItemPath,
    operationId: 'getTodo',
    summary: 'Get a todo by id',
    tags: ['todos'],
    responses: {
      '200': { description: 'Todo', schema: todoResponseSchema },
      '400': { description: 'Validation error', schema: apiErrorSchema },
      '404': { description: 'Todo not found', schema: apiErrorSchema }
    }
  },
  validation: {
    params: todoIdParams
  },
  handler: async (request: ValidatedRequest, response: Response): Promise<void> => {
    const { todoId } = request.validated.params as { todoId: string };
    const todo = await getTodoById(todoId);
    response.status(status.OK).send(toTodoResponse(todo));
  }
};

export const postTodo: DocumentedOperation & {
  handler: (request: ValidatedRequest, response: Response) => Promise<void>;
} = {
  openapi: {
    method: 'post',
    path: todosPath,
    operationId: 'createTodo',
    summary: 'Create a todo',
    tags: ['todos'],
    responses: {
      '201': { description: 'Created', schema: todoResponseSchema },
      '400': { description: 'Validation error', schema: apiErrorSchema }
    }
  },
  validation: {
    body: Joi.object()
      .keys({
        title: titleSchema.required(),
        description: descriptionSchema.optional(),
        dueDate: dueDateSchema.optional()
      })
      .unknown(false)
  },
  handler: async (request: ValidatedRequest, response: Response): Promise<void> => {
    const body = request.validated.body as {
      title: string;
      description?: string | null;
      dueDate?: string;
    };
    const todo = await createTodo(body);
    response.status(status.CREATED).send(toTodoResponse(todo));
  }
};

export const putTodo: DocumentedOperation & {
  handler: (request: ValidatedRequest, response: Response) => Promise<void>;
} = {
  openapi: {
    method: 'put',
    path: todoItemPath,
    operationId: 'updateTodo',
    summary: 'Update todo fields',
    description: 'Updates title, description, and/or due date. Completion is changed via PATCH.',
    tags: ['todos'],
    responses: {
      '200': { description: 'Updated todo', schema: todoResponseSchema },
      '400': { description: 'Validation error', schema: apiErrorSchema },
      '404': { description: 'Todo not found', schema: apiErrorSchema }
    }
  },
  validation: {
    params: todoIdParams,
    body: Joi.object()
      .keys({
        title: titleSchema.optional(),
        description: descriptionSchema.optional(),
        dueDate: dueDateSchema.allow(null).optional()
      })
      .or('title', 'description', 'dueDate')
      .unknown(false)
  },
  handler: async (request: ValidatedRequest, response: Response): Promise<void> => {
    const { todoId } = request.validated.params as { todoId: string };
    const body = request.validated.body as {
      title?: string;
      description?: string | null;
      dueDate?: string | null;
    };
    const todo = await updateTodo(todoId, body);
    response.status(status.OK).send(toTodoResponse(todo));
  }
};

export const patchTodo: DocumentedOperation & {
  handler: (request: ValidatedRequest, response: Response) => Promise<void>;
} = {
  openapi: {
    method: 'patch',
    path: todoItemPath,
    operationId: 'setTodoCompleted',
    summary: 'Set todo completion',
    tags: ['todos'],
    responses: {
      '200': { description: 'Updated todo', schema: todoResponseSchema },
      '400': { description: 'Validation error', schema: apiErrorSchema },
      '404': { description: 'Todo not found', schema: apiErrorSchema }
    }
  },
  validation: {
    params: todoIdParams,
    body: Joi.object()
      .keys({
        isCompleted: Joi.boolean().required()
      })
      .unknown(false)
  },
  handler: async (request: ValidatedRequest, response: Response): Promise<void> => {
    const { todoId } = request.validated.params as { todoId: string };
    const { isCompleted } = request.validated.body as { isCompleted: boolean };
    const todo = await setTodoCompleted(todoId, isCompleted);
    response.status(status.OK).send(toTodoResponse(todo));
  }
};

export const deleteTodo: DocumentedOperation & {
  handler: (request: ValidatedRequest, response: Response) => Promise<void>;
} = {
  openapi: {
    method: 'delete',
    path: todoItemPath,
    operationId: 'deleteTodo',
    summary: 'Delete a todo',
    tags: ['todos'],
    responses: {
      '204': { description: 'Deleted' },
      '400': { description: 'Validation error', schema: apiErrorSchema },
      '404': { description: 'Todo not found', schema: apiErrorSchema }
    }
  },
  validation: {
    params: todoIdParams
  },
  handler: async (request: ValidatedRequest, response: Response): Promise<void> => {
    const { todoId } = request.validated.params as { todoId: string };
    await removeTodo(todoId);
    response.status(status.NO_CONTENT).end();
  }
};
