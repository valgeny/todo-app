import assert from 'node:assert/strict';
import { startTestApp, stopTestApp } from '@test/helpers/testApp';
import type { Application } from 'express';
import { afterEach, beforeEach, describe, it } from 'mocha';
import request from 'supertest';

describe('todo API', () => {
  let app: Application;

  beforeEach(async () => {
    ({ app } = await startTestApp());
  });

  afterEach(async () => {
    await stopTestApp();
  });

  it('returns 204 on health', async () => {
    await request(app).get('/health').expect(204);
  });

  it('creates, lists, and views a todo', async () => {
    const created = await request(app)
      .post('/api/v0/todos')
      .send({ title: 'Write tests', description: 'Cover CRUD', dueDate: '2026-10-09' })
      .expect(201);

    assert.equal(created.body.title, 'Write tests');
    assert.equal(created.body.isCompleted, false);
    assert.equal(created.body.dueDate, '2026-10-09');
    assert.match(created.body.todoId, /^[0-9a-f-]{36}$/);

    const listed = await request(app).get('/api/v0/todos').expect(200);
    assert.equal(listed.body.length, 1);
    assert.equal(listed.headers['x-total-count'], '1');

    const viewed = await request(app).get(`/api/v0/todos/${created.body.todoId}`).expect(200);
    assert.equal(viewed.body.title, 'Write tests');
  });

  it('updates fields, toggles completion, and deletes', async () => {
    const created = await request(app).post('/api/v0/todos').send({ title: 'Ship it' }).expect(201);
    const id = created.body.todoId as string;

    const updated = await request(app)
      .put(`/api/v0/todos/${id}`)
      .send({ title: 'Shipped', description: 'Done-ish' })
      .expect(200);
    assert.equal(updated.body.title, 'Shipped');
    assert.equal(updated.body.isCompleted, false);

    const completed = await request(app)
      .patch(`/api/v0/todos/${id}`)
      .send({ isCompleted: true })
      .expect(200);
    assert.equal(completed.body.isCompleted, true);

    const incomplete = await request(app)
      .patch(`/api/v0/todos/${id}`)
      .send({ isCompleted: false })
      .expect(200);
    assert.equal(incomplete.body.isCompleted, false);

    await request(app).delete(`/api/v0/todos/${id}`).expect(204);
    await request(app).get(`/api/v0/todos/${id}`).expect(404);
  });

  it('rejects invalid payloads with 400', async () => {
    await request(app).post('/api/v0/todos').send({}).expect(400);
    await request(app)
      .post('/api/v0/todos')
      .send({ title: 'x', dueDate: '10-09-2026' })
      .expect(400);
    await request(app).post('/api/v0/todos').send({ title: 'x', isCompleted: true }).expect(400);

    const created = await request(app).post('/api/v0/todos').send({ title: 'Valid' }).expect(201);
    await request(app).put(`/api/v0/todos/${created.body.todoId}`).send({}).expect(400);
    await request(app)
      .patch(`/api/v0/todos/${created.body.todoId}`)
      .send({ title: 'nope' })
      .expect(400);
  });

  it('filters overdue items', async () => {
    await request(app)
      .post('/api/v0/todos')
      .send({ title: 'Late', dueDate: '2001-01-01' })
      .expect(201);
    await request(app)
      .post('/api/v0/todos')
      .send({ title: 'Later', dueDate: '2099-01-01' })
      .expect(201);

    const overdue = await request(app).get('/api/v0/todos?status=overdue').expect(200);
    assert.equal(overdue.body.length, 1);
    assert.equal(overdue.body[0].title, 'Late');
  });

  it('allows CORS only for localhost origins', async () => {
    const allowed = await request(app)
      .get('/health')
      .set('Origin', 'http://localhost:5173')
      .expect(204);
    assert.equal(allowed.headers['access-control-allow-origin'], 'http://localhost:5173');

    const loopback = await request(app)
      .options('/api/v0/todos')
      .set('Origin', 'http://127.0.0.1:4173')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);
    assert.equal(loopback.headers['access-control-allow-origin'], 'http://127.0.0.1:4173');

    const blocked = await request(app)
      .get('/health')
      .set('Origin', 'https://example.com')
      .expect(204);
    assert.equal(blocked.headers['access-control-allow-origin'], undefined);
  });

  it('returns 404 for unknown routes and ids', async () => {
    await request(app).get('/api/v0/nope').expect(404);
    await request(app).get('/api/v0/todos/11111111-1111-1111-1111-111111111111').expect(404);
  });
});
