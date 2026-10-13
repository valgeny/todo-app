/**
 * Streamable HTTP MCP entry for Cloud Run (and local `yarn mcp:http`).
 * Stdio remains in index.ts for Cursor / local hosts.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import {
  hostHeaderValidation,
  localhostHostValidation,
  localhostOriginValidation,
  NodeStreamableHTTPServerTransport,
  originValidation
} from '@modelcontextprotocol/node';
import { McpServer } from '@modelcontextprotocol/server';
import { createTodoApiClient, getApiOrigin } from './client.js';
import { registerTodoTools } from './tools.js';

function createTodoMcpServer(): McpServer {
  const server = new McpServer({
    name: 'todo-app',
    version: '1.0.0'
  });
  registerTodoTools(server, createTodoApiClient());
  return server;
}

function parseHostList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Localhost guards for local dev; on Cloud Run allow *.run.app plus MCP_ALLOWED_HOSTS.
 */
function buildHostGuards(): Array<(req: IncomingMessage, res: ServerResponse) => boolean> {
  const extra = parseHostList(process.env.MCP_ALLOWED_HOSTS);
  const isCloudRun = Boolean(process.env.K_SERVICE) || process.env.APP_ENV === 'cloudrun';

  if (!isCloudRun) {
    return [localhostHostValidation(), localhostOriginValidation()];
  }

  const validateExtraHost = extra.length > 0 ? hostHeaderValidation(extra) : null;
  const validateExtraOrigin = extra.length > 0 ? originValidation(extra) : null;

  const allowCloudRunHost = (req: IncomingMessage, res: ServerResponse): boolean => {
    const hostname = (req.headers.host ?? '').split(':')[0]?.toLowerCase() ?? '';
    if (hostname.endsWith('.run.app') || (extra.length > 0 && extra.includes(hostname))) {
      return true;
    }
    if (validateExtraHost) {
      return validateExtraHost(req, res);
    }
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden host' }));
    return false;
  };

  const allowCloudRunOrigin = (req: IncomingMessage, res: ServerResponse): boolean => {
    const origin = req.headers.origin;
    if (!origin) {
      return true; // non-browser MCP clients omit Origin
    }
    try {
      const hostname = new URL(origin).hostname.toLowerCase();
      if (
        hostname.endsWith('.run.app') ||
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        (extra.length > 0 && extra.includes(hostname))
      ) {
        return true;
      }
    } catch {
      // fall through
    }
    if (validateExtraOrigin) {
      return validateExtraOrigin(req, res);
    }
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden origin' }));
    return false;
  };

  return [allowCloudRunHost, allowCloudRunOrigin];
}

const port = Number(process.env.PORT ?? '8080');
const hostGuards = buildHostGuards();

const httpServer = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'GET' && (url.pathname === '/health' || url.pathname === '/')) {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname !== '/mcp') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
    return;
  }

  for (const guard of hostGuards) {
    if (!guard(req, res)) {
      return;
    }
  }

  // Stateless: one server + transport per request (Cloud Run–friendly).
  const server = createTodoMcpServer();
  const transport = new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });
  await server.connect(transport);
  await transport.handleRequest(req, res);
});

httpServer.listen(port, () => {
  console.error(`todo-app MCP HTTP on :${port}/mcp (API ${getApiOrigin()})`);
});
