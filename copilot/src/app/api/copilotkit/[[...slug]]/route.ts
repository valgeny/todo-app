import { LangGraphAgent } from '@copilotkit/runtime/langgraph';
import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
  InMemoryAgentRunner
} from '@copilotkit/runtime/v2';

import { langGraphHeaders } from '@/lib/langgraph-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function deploymentUrl(): string {
  const url = process.env.LANGGRAPH_URL?.trim();
  if (!url) {
    throw new Error('LANGGRAPH_URL is required (Agent Server base URL)');
  }
  return url.replace(/\/$/, '');
}

function graphId(): string {
  return process.env.LANGGRAPH_GRAPH_ID?.trim() || 'todo_agent';
}

async function buildHandler() {
  const url = deploymentUrl();
  const authHeaders = await langGraphHeaders(url);

  // Self-hosted Agent Server only (Cloud Run / local langgraph) — not LangGraph
  // Platform. Do not pass a LangSmith key: the SDK would send it as x-api-key and
  // may also pick LANGSMITH_API_KEY from the environment if this is left undefined.
  const runtimeInstance = new CopilotRuntime({
    agents: {
      todo_agent: new LangGraphAgent({
        deploymentUrl: url,
        graphId: graphId(),
        langsmithApiKey: null as unknown as string | undefined,
        // Static headers only: the SDK lowercases them into defaultHeaders, and also
        // passing headerFactory would send `authorization` twice ("Bearer a, Bearer a"),
        // which Cloud Run rejects as an unverifiable token.
        ...(Object.keys(authHeaders).length > 0 ? { propertyHeaders: authHeaders } : {})
      })
    },
    runner: new InMemoryAgentRunner(),
    // The runtime forwards inbound `authorization` / `x-*` onto agent calls. Behind
    // IAP those carry IAP's own tokens (Cloud Run prefers x-serverless-authorization),
    // which would replace the copilot SA ID token and 401 at the agent.
    forwardHeaders: {
      deny: ['authorization', 'x-serverless-authorization'],
      denyPrefixes: ['x-goog-']
    }
  });

  return createCopilotRuntimeHandler({
    runtime: runtimeInstance,
    basePath: '/api/copilotkit'
  });
}

async function handle(req: Request): Promise<Response> {
  const handler = await buildHandler();
  return handler(req);
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
