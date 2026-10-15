# Todo agent (LangGraph + Gemini + MCP)

Programmatic agent over the To-Do List **MCP** server (Streamable HTTP). No chatbot UI — CLI + [LangSmith](https://smith.langchain.com) evals.

## Stack

| Piece | Choice |
| --- | --- |
| Orchestration | LangGraph (`create_react_agent`) |
| LLM | Gemini via `langchain-google-genai` (API key or Vertex ADC) |
| Tools | MCP `tools/list` via `langchain-mcp-adapters` → `TODO_MCP_URL` |
| Evals | LangSmith datasets + trajectory / final-response evaluators |

## Setup

Requires [uv](https://docs.astral.sh/uv/) and a reachable MCP endpoint.

```bash
cd agent
uv sync
cp config/.env.example config/.env.local   # set TODO_MCP_URL + auth
```

Env files live under `config/` (same layout as `server/config` and `web/config`).

Sandbox MCP (deployed Cloud Run):

```bash
uv run todo-agent --env .env.local2sandbox --list-tools
uv run todo-agent --env .env.local2sandbox
```

## CLI

```bash
uv run todo-agent --env .env.local2sandbox
uv run todo-agent --list-tools
```

Gemini auth: set `GOOGLE_API_KEY` for AI Studio, or leave it empty and use Vertex ADC + `GOOGLE_CLOUD_PROJECT`.

Relative dates (“tomorrow”, …) use a dynamic system prompt with today’s date; set `AGENT_TZ` (IANA) if you don’t want the host timezone.

## LangSmith Studio (local)

Visual debugger for the graph (tool calls, state, replay). Needs a [LangSmith API key](https://smith.langchain.com) in `config/.env.local2sandbox`.

```bash
cd agent
uv sync --extra dev
# set LANGSMITH_API_KEY + LANGSMITH_PROJECT in config/.env.local2sandbox
uv run langgraph dev
```

`LANGSMITH_PROJECT` is the label in the LangSmith agent switcher. Use
`Todo Agent - <env>:<port>` (e.g. `Todo Agent - local2sandbox:2024` for this
file + default `langgraph dev` port). Change the port suffix if you pass
`--port`.

Opens Studio at `https://smith.langchain.com/studio/?baseUrl=http://127.0.0.1:2024` (use `--tunnel` on Safari).

This is separate from the CLI: Studio talks to a local Agent Server that still calls the **deployed** sandbox MCP via `TODO_MCP_URL`.

## Evals

Seed goldens: [`evals/dataset_seed.json`](evals/dataset_seed.json). Needs MCP up + LangSmith key:

```bash
uv run python evals/run_eval.py
```

## Layout

```
agent/
  config/             # .env.example, .env.local, .env.local2sandbox (gitignored except example)
  src/todo_agent/     # graph, MCP loader, CLI
  evals/              # seed dataset + LangSmith runner
```
