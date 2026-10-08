import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'mocha';
import { NotFoundError } from '@/errors';
import { closeDb, createDataSource, initDb } from '@/providers/db';
import {
  createTodo,
  deleteTodo,
  getTodoById,
  listTodos,
  setTodoCompleted,
  updateTodo
} from '@/services/todoService';

describe('todoService', () => {
  after(async () => {
    await closeDb();
  });

  beforeEach(async () => {
    await closeDb();
    await initDb(createDataSource({ logging: false }));
  });

  it('creates a todo with defaults', async () => {
    const todo = await createTodo({ title: 'Buy milk' });
    assert.equal(todo.title, 'Buy milk');
    assert.equal(todo.description, null);
    assert.equal(todo.dueDate, null);
    assert.equal(todo.isCompleted, false);
    assert.ok(todo.todoId);
    assert.ok(todo.createdAt);
  });

  it('lists, filters, and sorts todos', async () => {
    await createTodo({ title: 'B task', dueDate: '2000-01-01' });
    await createTodo({ title: 'A task', dueDate: '2099-01-01' });
    const completed = await createTodo({ title: 'C task' });
    await setTodoCompleted(completed.todoId, true);

    const all = await listTodos({
      status: 'all',
      sortField: 'title',
      sortOrder: 'ASC',
      limit: 20,
      offset: 0
    });
    assert.equal(all.count, 3);
    assert.deepEqual(
      all.items.map(item => item.title),
      ['A task', 'B task', 'C task']
    );

    const incomplete = await listTodos({
      status: 'incomplete',
      sortField: 'title',
      sortOrder: 'ASC',
      limit: 20,
      offset: 0
    });
    assert.equal(incomplete.count, 2);

    const overdue = await listTodos({
      status: 'overdue',
      sortField: 'dueDate',
      sortOrder: 'ASC',
      limit: 20,
      offset: 0
    });
    assert.equal(overdue.count, 1);
    assert.equal(overdue.items[0].title, 'B task');
  });

  it('updates, completes, and deletes a todo', async () => {
    const created = await createTodo({ title: 'Draft' });
    const updated = await updateTodo(created.todoId, {
      title: 'Ready',
      description: 'Details',
      dueDate: '2026-12-01'
    });
    assert.equal(updated.title, 'Ready');
    assert.equal(updated.description, 'Details');

    const completed = await setTodoCompleted(created.todoId, true);
    assert.equal(completed.isCompleted, true);

    const incomplete = await setTodoCompleted(created.todoId, false);
    assert.equal(incomplete.isCompleted, false);

    await deleteTodo(created.todoId);
    await assert.rejects(() => getTodoById(created.todoId), NotFoundError);
  });

  it('throws NotFoundError for unknown ids', async () => {
    const missingId = '11111111-1111-1111-1111-111111111111';
    await assert.rejects(() => getTodoById(missingId), NotFoundError);
    await assert.rejects(() => updateTodo(missingId, { title: 'Nope' }), NotFoundError);
    await assert.rejects(() => setTodoCompleted(missingId, true), NotFoundError);
    await assert.rejects(() => deleteTodo(missingId), NotFoundError);
  });
});
