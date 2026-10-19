# agent-ui (CopilotKit)

Next.js chat UI over the LangGraph Agent Server (`todo_agent` graph).

## Local

```bash
# Terminal 1 — Agent Server (from agent/)
uv run langgraph dev

# Terminal 2 — UI
yarn workspace agent-ui dev
# http://localhost:3001
```

`agent-ui/.env.local`:

```bash
LANGGRAPH_URL=http://127.0.0.1:2024
LANGGRAPH_GRAPH_ID=todo_agent
```

Browser → `/api/copilotkit` (same origin). Next.js runtime → `LANGGRAPH_URL` (server-side).

## Cloud Run + IAP

Public: `https://ui.valeriangeny.dev` (IAP). Runtime calls the agent Cloud Run URL with a Google ID token (`google-auth-library`); the UI service account needs `roles/run.invoker` on the agent.
