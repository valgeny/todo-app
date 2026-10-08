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

const todoIdParams = Joi.object().keys({
  todoId: todoIdSchema.required()
});

export const getTodoBulk = {
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

export const getTodo = {
  validation: {
    params: todoIdParams
  },
  handler: async (request: ValidatedRequest, response: Response): Promise<void> => {
    const { todoId } = request.validated.params as { todoId: string };
    const todo = await getTodoById(todoId);
    response.status(status.OK).send(toTodoResponse(todo));
  }
};

export const postTodo = {
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

export const putTodo = {
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

export const patchTodo = {
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

export const deleteTodo = {
  validation: {
    params: todoIdParams
  },
  handler: async (request: ValidatedRequest, response: Response): Promise<void> => {
    const { todoId } = request.validated.params as { todoId: string };
    await removeTodo(todoId);
    response.status(status.NO_CONTENT).end();
  }
};
