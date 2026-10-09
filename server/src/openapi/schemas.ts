import Joi from 'joi';
import { descriptionSchema, dueDateSchema, titleSchema, todoIdSchema } from '@/models/todo';

/** Response body returned by todo handlers (`toTodoResponse`). */
export const todoResponseSchema = Joi.object({
  todoId: todoIdSchema.required(),
  title: titleSchema.required(),
  description: descriptionSchema.required(),
  dueDate: dueDateSchema.allow(null).required(),
  isCompleted: Joi.boolean().required(),
  createdAt: Joi.string().isoDate().required()
}).unknown(false);

/** Error JSON produced by `BaseError.toJson` / the HTTP error transformer. */
export const apiErrorSchema = Joi.object({
  errorId: Joi.string().required(),
  errorText: Joi.string().required(),
  loggingId: Joi.string().allow(null).required(),
  originalError: Joi.object().unknown(true).allow(null).optional(),
  data: Joi.any().optional()
});
