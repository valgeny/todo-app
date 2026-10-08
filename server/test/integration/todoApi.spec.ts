import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createApi } from '@test/helpers/apiClient';
import { endpoint, startTestApp, stopTestApp } from '@test/helpers/testApp';
import type { Application } from 'express';

const positive = { tags: ['positive'] };
const negative = { tags: ['negative'] };

describe('todo API', () => {
  let app: Application;

  beforeEach(async () => {
    ({ app } = await startTestApp());
  });

  afterEach(async () => {
    await stopTestApp();
  });

  it('returns 204 on health', positive, async (t) => {
    const api = createApi(app, t);
    await api.get(endpoint('/health')).expect(204);
  });

  it('creates, lists, and views a todo', positive, async (t) => {
    const api = createApi(app, t);
    const created = await api
      .post(endpoint('/api/v0/todos'))
      .send({ title: 'Write tests', description: 'Cover CRUD', dueDate: '2026-10-09' })
      .expect(201);

    assert.equal(created.body.title, 'Write tests');
    assert.equal(created.body.isCompleted, false);
    assert.equal(created.body.dueDate, '2026-10-09');
    assert.match(created.body.todoId, /^[0-9a-f-]{36}$/);

    const listed = await api.get(endpoint('/api/v0/todos')).expect(200);
    assert.equal(listed.body.length, 1);
    assert.equal(listed.headers['x-total-count'], '1');

    const viewed = await api.get(endpoint(`/api/v0/todos/${created.body.todoId}`)).expect(200);
    assert.equal(viewed.body.title, 'Write tests');
  });

  it('updates fields, toggles completion, and deletes', positive, async (t) => {
    const api = createApi(app, t);
    const created = await api.post(endpoint('/api/v0/todos')).send({ title: 'Ship it' }).expect(201);
    const id = created.body.todoId as string;

    const updated = await api
      .put(endpoint(`/api/v0/todos/${id}`))
      .send({ title: 'Shipped', description: 'Done-ish' })
      .expect(200);
    assert.equal(updated.body.title, 'Shipped');
    assert.equal(updated.body.isCompleted, false);

    const completed = await api
      .patch(endpoint(`/api/v0/todos/${id}`))
      .send({ isCompleted: true })
      .expect(200);
    assert.equal(completed.body.isCompleted, true);

    const incomplete = await api
      .patch(endpoint(`/api/v0/todos/${id}`))
      .send({ isCompleted: false })
      .expect(200);
    assert.equal(incomplete.body.isCompleted, false);

    await api.delete(endpoint(`/api/v0/todos/${id}`)).expect(204);
    await api.get(endpoint(`/api/v0/todos/${id}`)).expect(404);
  });

  it('filters overdue items', positive, async (t) => {
    const api = createApi(app, t);
    await api.post(endpoint('/api/v0/todos')).send({ title: 'Late', dueDate: '2001-01-01' }).expect(201);
    await api.post(endpoint('/api/v0/todos')).send({ title: 'Later', dueDate: '2099-01-01' }).expect(201);

    const overdue = await api.get(endpoint('/api/v0/todos?status=overdue')).expect(200);
    assert.equal(overdue.body.length, 1);
    assert.equal(overdue.body[0].title, 'Late');
  });

  it('rejects missing required fields with 400', negative, async (t) => {
    const api = createApi(app, t);

    const emptyCreate = await api.post(endpoint('/api/v0/todos')).send({}).expect(400);
    assert.equal(emptyCreate.body.errorId, 'validation-error');

    await api.post(endpoint('/api/v0/todos')).send({ description: 'no title' }).expect(400);
    await api.post(endpoint('/api/v0/todos')).send({ title: '' }).expect(400);
    await api.post(endpoint('/api/v0/todos')).send({ title: '   ' }).expect(400);

    const created = await api.post(endpoint('/api/v0/todos')).send({ title: 'Valid' }).expect(201);
    const id = created.body.todoId as string;

    await api.put(endpoint(`/api/v0/todos/${id}`)).send({}).expect(400);
    await api.patch(endpoint(`/api/v0/todos/${id}`)).send({}).expect(400);
    await api.patch(endpoint(`/api/v0/todos/${id}`)).send({ title: 'nope' }).expect(400);
  });

  it('rejects invalid formatting with 400', negative, async (t) => {
    const api = createApi(app, t);

    await api.post(endpoint('/api/v0/todos')).send({ title: 'x', dueDate: '10-09-2026' }).expect(400);
    await api.post(endpoint('/api/v0/todos')).send({ title: 'x', dueDate: '2026-13-01' }).expect(400);
    await api.post(endpoint('/api/v0/todos')).send({ title: 'x', dueDate: '2026-02-30' }).expect(400);
    await api.post(endpoint('/api/v0/todos')).send({ title: 'x', dueDate: 20261009 }).expect(400);
    await api.post(endpoint('/api/v0/todos')).send({ title: 'x', isCompleted: true }).expect(400);

    const created = await api.post(endpoint('/api/v0/todos')).send({ title: 'Valid' }).expect(201);
    const id = created.body.todoId as string;

    await api.put(endpoint(`/api/v0/todos/${id}`)).send({ dueDate: '10-09-2026' }).expect(400);
    await api.put(endpoint(`/api/v0/todos/${id}`)).send({ dueDate: '2026-02-30' }).expect(400);

    await api.patch(endpoint(`/api/v0/todos/${id}`)).send({ isCompleted: 'yes' }).expect(400);
    await api.patch(endpoint(`/api/v0/todos/${id}`)).send({ isCompleted: 1 }).expect(400);
    await api.patch(endpoint(`/api/v0/todos/${id}`)).send({ isCompleted: '1' }).expect(400);
    await api.patch(endpoint(`/api/v0/todos/${id}`)).send({ isCompleted: null }).expect(400);

    await api.get(endpoint('/api/v0/todos?status=open')).expect(400);
    await api.get(endpoint('/api/v0/todos?status=true')).expect(400);

    const badId = await api.get(endpoint('/api/v0/todos/not-a-uuid')).expect(400);
    assert.equal(badId.body.errorId, 'validation-error');
  });

  it('returns 404 for unknown routes and ids', negative, async (t) => {
    const api = createApi(app, t);
    await api.get(endpoint('/api/v0/nope')).expect(404);
    await api.get(endpoint('/api/v0/todos/11111111-1111-1111-1111-111111111111')).expect(404);
  });
});
