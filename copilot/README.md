# copilot (CopilotKit)

Next.js app (chat page + CopilotKit runtime BFF) over our **self-hosted** LangGraph Agent Server (`todo_agent` graph on Cloud Run / local).

This is **not** LangGraph Platform (no LangSmith Deployment / hosted “dev” or “prod” deployments). CopilotKit talks to our Agent Server URL; auth in cloud is Cloud Run IAM (ID token), not a LangSmith API key.

## Local

```bash
# Terminal 1 — self-hosted Agent Server (from agent/)
uv run langgraph dev

# Terminal 2 — copilot
yarn dev:copilot
# http://localhost:3001
```

`copilot/.env.local`:

```bash
LANGGRAPH_URL=http://127.0.0.1:2024
LANGGRAPH_GRAPH_ID=todo_agent
```

Browser → `/api/copilotkit` (same origin). Next.js runtime → `LANGGRAPH_URL` (server-side).

## Cloud Run + IAP

Public: `https://copilot.valeriangeny.dev` (IAP). Runtime calls the Agent Server Cloud Run URL (`LANGGRAPH_URL=https://…run.app`) with a Google ID token from the metadata server. The copilot service account has `roles/run.invoker` on the agent.

`LANGSMITH_API_KEY` may exist on the **agent** for tracing only; copilot must not use it as LangGraph Platform credentials.
