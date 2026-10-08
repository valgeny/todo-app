import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { createApi } from '@test/helpers/apiClient';
import { baseUrl, endpoint, loopbackUrl, startTestApp, stopTestApp } from '@test/helpers/testApp';
import type { Application } from 'express';

const negative = { tags: ['negative'] };

describe('CORS', () => {
  let app: Application;

  beforeEach(async () => {
    ({ app } = await startTestApp());
  });

  afterEach(async () => {
    await stopTestApp();
  });

  it('allows CORS only for localhost and Codespaces origins', negative, async t => {
    const api = createApi(app, t);

    const allowed = await api.get(endpoint('/health')).set('Origin', baseUrl).expect(204);
    assert.equal(allowed.headers['access-control-allow-origin'], baseUrl);

    const loopback = await api
      .options(endpoint('/api/v0/todos'))
      .set('Origin', loopbackUrl)
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);
    assert.equal(loopback.headers['access-control-allow-origin'], loopbackUrl);

    const codespaceOrigin = 'https://todo-app-3000.app.github.dev';
    const codespace = await api.get(endpoint('/health')).set('Origin', codespaceOrigin).expect(204);
    assert.equal(codespace.headers['access-control-allow-origin'], codespaceOrigin);

    const blocked = await api
      .get(endpoint('/health'))
      .set('Origin', 'https://example.com')
      .expect(204);
    assert.equal(blocked.headers['access-control-allow-origin'], undefined);
  });
});
