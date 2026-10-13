# Todo agent (LangGraph + Gemini)

Programmatic agent over the To-Do List **REST API** (same contract as [MCP](../docs/mcp.md)). No chatbot UI — CLI + [LangSmith](https://smith.langchain.com) evals.

## Stack

| Piece | Choice |
| --- | --- |
| Orchestration | LangGraph (`create_react_agent`) |
| LLM | Gemini via `langchain-google-genai` (`GOOGLE_API_KEY`) |
| Tools | HTTP (`httpx`) → `TODO_API_ORIGIN` |
| Evals | LangSmith datasets + trajectory / final-response evaluators |

## Setup

Requires [uv](https://docs.astral.sh/uv/) (installs Python 3.12+ for this package).

```bash
# Terminal 1 — API (repo root)
cp server/config/.env.example server/config/.env.local   # once; SQLite
yarn install
yarn dev:server

# Terminal 2 — agent
cd agent
cp .env.example .env   # set GOOGLE_API_KEY, LANGSMITH_API_KEY
uv sync                # creates .venv from pyproject.toml / uv.lock
```

## CLI

```bash
cd agent
uv run todo-agent
# or: uv run python -m todo_agent.cli
```

## Evals

Seed goldens live in [`evals/dataset_seed.json`](evals/dataset_seed.json). Requires API up + LangSmith key:

```bash
cd agent
uv run python evals/run_eval.py
```

This creates/uses dataset `todo-agent-v1` and runs an experiment with:

- `trajectory_subsequence` — expected tool names (and known args) in order
- `final_response_judge` — Gemini PASS/FAIL vs reference intent

## Layout

```
agent/
  src/todo_agent/   # graph, tools, CLI
  evals/            # seed dataset + LangSmith runner
```
