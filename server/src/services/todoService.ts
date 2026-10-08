import { type FindOptionsWhere, LessThan } from 'typeorm';
import { NotFoundError } from '../errors';
import { Todo } from '../models/todo';

export type ListStatus = 'all' | 'completed' | 'incomplete' | 'overdue';
export type SortField = 'dueDate' | 'createdAt' | 'title';

export type ListTodosQuery = {
  status: ListStatus;
  sortField: SortField;
  sortOrder: 'ASC' | 'DESC';
  limit: number;
  offset: number;
};

export type CreateTodoInput = {
  title: string;
  description?: string | null;
  dueDate?: string | null;
};

export type UpdateTodoInput = {
  title?: string;
  description?: string | null;
  dueDate?: string | null;
};

const todayYmd = (): string => new Date().toISOString().slice(0, 10);

const normalizeOptionalText = (value: string | null | undefined): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }
  return value;
};

export const createTodo = async (input: CreateTodoInput): Promise<Todo> => {
  const todo = Todo.create({
    title: input.title,
    description: normalizeOptionalText(input.description) ?? null,
    dueDate: input.dueDate ?? null,
    isCompleted: false
  });
  return todo.save();
};

export const listTodos = async (
  query: ListTodosQuery
): Promise<{ items: Todo[]; count: number }> => {
  const where: FindOptionsWhere<Todo> = {};

  if (query.status === 'completed') {
    where.isCompleted = true;
  } else if (query.status === 'incomplete') {
    where.isCompleted = false;
  } else if (query.status === 'overdue') {
    where.isCompleted = false;
    where.dueDate = LessThan(todayYmd());
  }

  const [items, count] = await Todo.findAndCount({
    where,
    order: { [query.sortField]: query.sortOrder },
    skip: query.offset,
    take: query.limit
  });

  return { items, count };
};

export const getTodoById = async (todoId: string): Promise<Todo> => {
  const todo = await Todo.findOneBy({ todoId });
  if (!todo) {
    throw new NotFoundError('To-do item not found', null, { todoId });
  }
  return todo;
};

export const updateTodo = async (todoId: string, input: UpdateTodoInput): Promise<Todo> => {
  const todo = await getTodoById(todoId);

  if (input.title !== undefined) {
    todo.title = input.title;
  }
  if (input.description !== undefined) {
    todo.description = normalizeOptionalText(input.description) ?? null;
  }
  if (input.dueDate !== undefined) {
    todo.dueDate = input.dueDate;
  }

  return todo.save();
};

export const setTodoCompleted = async (todoId: string, isCompleted: boolean): Promise<Todo> => {
  const todo = await getTodoById(todoId);
  todo.isCompleted = isCompleted;
  return todo.save();
};

export const deleteTodo = async (todoId: string): Promise<void> => {
  const todo = await getTodoById(todoId);
  await todo.remove();
};
