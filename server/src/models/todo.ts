import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { z } from 'zod';

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

  @Column({ name: 'is_completed', default: false })
  isCompleted!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

export const todoIdSchema = z.uuid();
export const titleSchema = z.string().trim().min(1).max(200);
export const descriptionSchema = z.string().trim().max(4000).nullable();
export const dueDateSchema = z.iso.date().refine(value => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'valid calendar date');

/** Wire shape of `toTodoResponse`. */
export const todoResponseSchema = z
  .object({
    todoId: todoIdSchema,
    title: titleSchema,
    description: descriptionSchema,
    dueDate: dueDateSchema.nullable(),
    isCompleted: z.boolean(),
    createdAt: z.iso.datetime()
  })
  .strict();

export type TodoResponse = z.infer<typeof todoResponseSchema>;

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
  return todoResponseSchema.parse({
    todoId: todo.todoId,
    title: todo.title,
    description: todo.description ?? null,
    dueDate: formatDueDate(todo.dueDate),
    isCompleted: Boolean(todo.isCompleted),
    createdAt:
      todo.createdAt instanceof Date ? todo.createdAt.toISOString() : String(todo.createdAt)
  });
};
