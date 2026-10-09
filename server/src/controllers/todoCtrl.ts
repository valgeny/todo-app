import type { Response } from 'express';
import status from 'http-status';
import { z } from 'zod';
import { apiErrorSchema } from '@/errors';
import {
  descriptionSchema,
  dueDateSchema,
  titleSchema,
  todoIdSchema,
  todoResponseSchema,
  toTodoResponse
} from '@/models/todo';
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

const todoIdParams = z.object({
  todoId: todoIdSchema
});

const createTodoBody = z
  .object({
    title: titleSchema,
    description: descriptionSchema.optional(),
    dueDate: dueDateSchema.optional()
  })
  .strict();

const updateTodoBody = z
  .object({
    title: titleSchema.optional(),
    description: descriptionSchema.optional(),
    dueDate: dueDateSchema.nullable().optional()
  })
  .strict()
  .refine(
    value =>
      value.title !== undefined || value.description !== undefined || value.dueDate !== undefined,
    { message: 'At least one of title, description, or dueDate is required' }
  );

const patchTodoBody = z
  .object({
    isCompleted: z.boolean()
  })
  .strict();

const listTodosQuery = z.object({
  status: z.enum(['all', 'completed', 'incomplete', 'overdue']).default('all'),
  ...sort.fields(['dueDate', 'createdAt', 'title'], 'createdAt', 'DESC'),
  limit: pagination.schema.limit,
  offset: pagination.schema.offset
});

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
    query: listTodosQuery
  },
  handler: async (request: ValidatedRequest, response: Response): Promise<void> => {
    const {
      status: listStatus,
      sortField,
      sortOrder,
      limit,
      offset
    } = request.validated.query as z.infer<typeof listTodosQuery>;

    const { items, count } = await listTodos({
      status: listStatus as ListStatus,
      sortField: sortField as SortField,
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
    const { todoId } = request.validated.params as z.infer<typeof todoIdParams>;
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
    body: createTodoBody
  },
  handler: async (request: ValidatedRequest, response: Response): Promise<void> => {
    const body = request.validated.body as z.infer<typeof createTodoBody>;
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
    body: updateTodoBody
  },
  handler: async (request: ValidatedRequest, response: Response): Promise<void> => {
    const { todoId } = request.validated.params as z.infer<typeof todoIdParams>;
    const body = request.validated.body as z.infer<typeof updateTodoBody>;
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
    body: patchTodoBody
  },
  handler: async (request: ValidatedRequest, response: Response): Promise<void> => {
    const { todoId } = request.validated.params as z.infer<typeof todoIdParams>;
    const { isCompleted } = request.validated.body as z.infer<typeof patchTodoBody>;
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
    const { todoId } = request.validated.params as z.infer<typeof todoIdParams>;
    await removeTodo(todoId);
    response.status(status.NO_CONTENT).end();
  }
};
