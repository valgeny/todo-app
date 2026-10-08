import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { TestContext } from 'node:test';
import type { Application } from 'express';
import request, { type Response, type Test } from 'supertest';

const RUN_DIR_ENV = 'ALLURE_NODE_TEST_RUN_DIR';

type HttpExchange = {
  request: {
    method: string;
    url: string;
    headers: Record<string, unknown>;
    body: unknown;
  };
  response: {
    status: number;
    headers: Record<string, unknown>;
    body: unknown;
    text: string;
  };
};

const readRequestBody = (req: Test): unknown => {
  const data = (req as Test & { _data?: unknown })._data;
  return data === undefined ? null : data;
};

const formatExchange = (req: Test, res: Response): HttpExchange => ({
  request: {
    method: req.method,
    url: req.url,
    headers: req.header,
    body: readRequestBody(req)
  },
  response: {
    status: res.status,
    headers: res.headers,
    body: res.body,
    text: res.text
  }
});

const attachHttpExchange = (t: TestContext, req: Test, res: Response): void => {
  const runDir = process.env[RUN_DIR_ENV];
  if (!runDir) {
    return;
  }

  const exchange = formatExchange(req, res);
  const attachmentName = `${req.method} ${req.url} → ${res.status}`;
  const content = `${JSON.stringify(exchange, null, 2)}\n`;

  mkdirSync(runDir, { recursive: true });
  appendFileSync(
    join(runDir, `runtime-${process.pid}.jsonl`),
    `${JSON.stringify({
      version: 1,
      pid: process.pid,
      file: t.filePath,
      name: t.name,
      nodeFullName: t.fullName,
      type: 'test',
      timestamp: Date.now(),
      message: {
        type: 'attachment_content',
        data: {
          name: attachmentName,
          content: Buffer.from(content, 'utf8').toString('base64'),
          encoding: 'base64',
          contentType: 'application/json',
          fileExtension: 'json',
          wrapInStep: true,
          timestamp: Date.now()
        }
      }
    })}\n`,
    'utf8'
  );
};

const instrument = (t: TestContext, req: Test): Test => {
  const originalThen = req.then.bind(req);
  (req as Test & { then: typeof req.then }).then = ((onFulfilled, onRejected) =>
    originalThen(async (res: Response) => {
      attachHttpExchange(t, req, res);
      return res;
    }).then(onFulfilled, onRejected)) as typeof req.then;
  return req;
};

export type ApiClient = {
  get: (url: string) => Test;
  post: (url: string) => Test;
  put: (url: string) => Test;
  patch: (url: string) => Test;
  delete: (url: string) => Test;
  options: (url: string) => Test;
};

export const createApi = (app: Application, t: TestContext): ApiClient => {
  const agent = request(app);
  return {
    get: (url) => instrument(t, agent.get(url)),
    post: (url) => instrument(t, agent.post(url)),
    put: (url) => instrument(t, agent.put(url)),
    patch: (url) => instrument(t, agent.patch(url)),
    delete: (url) => instrument(t, agent.delete(url)),
    options: (url) => instrument(t, agent.options(url))
  };
};
