import { z } from 'zod';

/**
 * Tool input shapes aligned with server Zod / OpenAPI (todoCtrl + models/todo).
 * Kept local so the MCP process does not pull TypeORM.
 */

export const todoIdSchema = z.uuid();
export const titleSchema = z.string().trim().min(1).max(200);
export const descriptionSchema = z.string().trim().max(4000).optional();
export const dueDateSchema = z.iso.date();

export const listTodosInputSchema = z.object({
  status: z.enum(['all', 'completed', 'incomplete', 'overdue']).default('all'),
  sortField: z.enum(['createdAt', 'dueDate', 'title']).default('createdAt'),
  sortOrder: z.enum(['ASC', 'DESC']).default('DESC'),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0)
});

export const getTodoInputSchema = z.object({
  todoId: todoIdSchema
});

export const createTodoInputSchema = z.object({
  title: titleSchema,
  description: descriptionSchema,
  dueDate: dueDateSchema.optional()
});

export const updateTodoInputSchema = z
  .object({
    todoId: todoIdSchema,
    title: titleSchema.optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    dueDate: dueDateSchema.nullable().optional()
  })
  .refine(
    value =>
      value.title !== undefined || value.description !== undefined || value.dueDate !== undefined,
    { message: 'Provide at least one of title, description, or dueDate' }
  );

export const todoIdOnlySchema = z.object({
  todoId: todoIdSchema
});
