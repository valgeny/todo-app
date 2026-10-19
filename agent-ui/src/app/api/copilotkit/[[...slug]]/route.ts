import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
  InMemoryAgentRunner
} from '@copilotkit/runtime/v2';
import { LangGraphAgent } from '@copilotkit/runtime/langgraph';

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
  const propertyHeaders = await langGraphHeaders(url);

  const runtimeInstance = new CopilotRuntime({
    agents: {
      todo_agent: new LangGraphAgent({
        deploymentUrl: url,
        graphId: graphId(),
        langsmithApiKey: process.env.LANGSMITH_API_KEY,
        ...(Object.keys(propertyHeaders).length > 0 ? { propertyHeaders } : {})
      })
    },
    runner: new InMemoryAgentRunner()
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
