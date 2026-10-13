# MCP server

Curated [Model Context Protocol](https://modelcontextprotocol.io/) tools that call the To-Do List **REST API**. The MCP process does not open the database; start the API first.

## Tools

| Tool | Action |
| --- | --- |
| `list_todos` | List with status / sort / pagination |
| `get_todo` | Get by UUID |
| `create_todo` | Create (title required) |
| `update_todo` | Update title / description / dueDate |
| `complete_todo` / `incomplete_todo` | Set completion |
| `delete_todo` | Delete |

Input shapes follow the same Zod rules as the API (see OpenAPI / [API docs](api.md)). Resources (`todo://…`) are not implemented yet.

## Run

```bash
# Terminal 1 — API (SQLite local)
yarn install
cp server/config/.env.example server/config/.env.local   # once
yarn dev:server

# Terminal 2 — MCP over stdio (for hosts / Inspector)
yarn --silent mcp
```

Optional: `TODO_API_ORIGIN=http://127.0.0.1:8080 yarn --silent mcp` when the API is on Docker port 8080. Use `--silent` (or the `node` host config below) so Yarn does not write banners to stdout.

## MCP Inspector (manual test)

```bash
yarn mcp:inspect
```

With the API running, open the Inspector UI, connect, and call `list_todos` / `create_todo`.

## Host config (Cursor / Claude Desktop)

Start with **`node`** (not `yarn`) so package-manager banners do not corrupt the stdio MCP stream. Point `cwd` at the repo root (needs `yarn install` so `tsx` resolves):

```json
{
  "mcpServers": {
    "todo-app": {
      "command": "node",
      "args": ["--import", "tsx", "mcp/src/index.ts"],
      "cwd": "/absolute/path/to/todo-app",
      "env": {
        "TODO_API_ORIGIN": "http://127.0.0.1:8000"
      }
    }
  }
}
```

Prefer the `node` config above in hosts. From a shell, `yarn --silent mcp` keeps stdout clean for the protocol.

## Automated tests

```bash
yarn test:mcp
```

Unit tests mock `fetch` (no API process). They do not cover the stdio wire protocol; use Inspector for that.

## Layout

```
mcp/
  src/index.ts    # stdio entry
  src/client.ts   # HTTP client → TODO_API_ORIGIN
  src/schemas.ts  # Zod inputs (aligned with OpenAPI)
  src/tools.ts    # registerTool handlers
```
