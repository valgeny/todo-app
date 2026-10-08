import Joi from 'joi';
import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('todo')
export class Todo extends BaseEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'todo_id' })
  todoId!: string;

  @Column({ name: 'title', type: 'varchar' })
  title!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate!: string | Date | null;

  @Column({ name: 'is_completed', type: 'boolean', default: false })
  isCompleted!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

export type TodoResponse = {
  todoId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  isCompleted: boolean;
  createdAt: string;
};

const dueDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export const todoIdSchema = Joi.string().uuid({ separator: '-' });
export const titleSchema = Joi.string().trim().min(1).max(200);
export const descriptionSchema = Joi.string().trim().max(4000).allow(null, '');
export const dueDateSchema = Joi.string()
  .pattern(dueDatePattern)
  .custom((value: string, helpers) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      return helpers.error('any.invalid');
    }
    return value;
  }, 'valid calendar date');

export const formatDueDate = (value: string | Date | null): string | null => {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
};

export const toTodoResponse = (todo: Todo): TodoResponse => {
  return {
    todoId: todo.todoId,
    title: todo.title,
    description: todo.description ?? null,
    dueDate: formatDueDate(todo.dueDate),
    isCompleted: Boolean(todo.isCompleted),
    createdAt:
      todo.createdAt instanceof Date ? todo.createdAt.toISOString() : String(todo.createdAt)
  };
};
