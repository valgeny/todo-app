import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createTodoApiClient, TodoApiError } from './client.js';

describe('createTodoApiClient', () => {
  it('GETs the path under the origin', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify([{ todoId: '1' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    };

    const api = createTodoApiClient('http://127.0.0.1:8000', fetchImpl);
    const result = await api.request('GET', '/api/v0/todos?status=all');

    assert.deepEqual(result, [{ todoId: '1' }]);
    assert.equal(calls[0]?.url, 'http://127.0.0.1:8000/api/v0/todos?status=all');
    assert.equal(calls[0]?.init?.method, 'GET');
  });

  it('POSTs JSON bodies', async () => {
    let body: string | undefined;
    const fetchImpl: typeof fetch = async (_input, init) => {
      body = init?.body as string;
      return new Response(JSON.stringify({ todoId: 'abc', title: 'Buy milk' }), { status: 201 });
    };

    const api = createTodoApiClient('http://example.test', fetchImpl);
    await api.request('POST', '/api/v0/todos', { title: 'Buy milk' });

    assert.equal(body, JSON.stringify({ title: 'Buy milk' }));
  });

  it('maps non-2xx to TodoApiError', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ message: 'missing' }), { status: 404 });

    const api = createTodoApiClient('http://example.test', fetchImpl);
    await assert.rejects(
      () => api.request('GET', '/api/v0/todos/nope'),
      (error: unknown) => {
        assert.ok(error instanceof TodoApiError);
        assert.equal(error.status, 404);
        assert.match(error.message, /404/);
        return true;
      }
    );
  });

  it('treats 204 as empty success', async () => {
    const fetchImpl: typeof fetch = async () => new Response(null, { status: 204 });
    const api = createTodoApiClient('http://example.test', fetchImpl);
    const result = await api.request('DELETE', '/api/v0/todos/x');
    assert.equal(result, undefined);
  });
});
