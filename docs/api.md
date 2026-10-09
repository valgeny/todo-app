# API

Contract, validation strategy, OpenAPI/Redoc, and Postman.

## Latest docs

Published Redoc on GitHub Pages (from `main`):

**[https://valgeny.github.io/todo-app/redoc/latest/](https://valgeny.github.io/todo-app/redoc/latest/)**

Branch previews: `https://valgeny.github.io/todo-app/<branch>/redoc/latest/`.

## Strategy

- **Layers:** `main` → `createApp` → routers → controllers (`validation` + `handler`) → `todoService` → TypeORM `Todo` entity.
- **Validation:** Zod schemas live with the model and controllers. Types use `z.infer`. A small `validate` middleware binds schemas to each route.
- **OpenAPI:** The same Zod schemas drive the OpenAPI document via `z.toJSONSchema` / controller `openapi` metadata (`server/src/openapi/`). Schema is the source of truth; the Redoc site is generated from it.
- **Persistence:** TypeORM 1.x `DataSource`. `DB_DIALECT=mssql` or `sqlite` (`better-sqlite3`). Active Record (`Todo.create` / `find` / `save`). `synchronize: true` creates the `todo` table.
- **Errors:** Shared `BaseError` types → HTTP status (400 validation, 404 missing entity/route, 500 unexpected).

## Contract

Base path: `/api/v0/todos`

| Method | Path | Body | Success |
| --- | --- | --- | --- |
| `POST` | `/api/v0/todos` | `{ "title": string, "description"?: string, "dueDate"?: "YYYY-MM-DD" }` | 201 |
| `GET` | `/api/v0/todos` | — | 200 |
| `GET` | `/api/v0/todos/{todoId}` | — | 200 |
| `PUT` | `/api/v0/todos/{todoId}` | `{ "title"?, "description"?, "dueDate"? }` (at least one) | 200 |
| `PATCH` | `/api/v0/todos/{todoId}` | `{ "isCompleted": boolean }` | 200 |
| `DELETE` | `/api/v0/todos/{todoId}` | — | 204 |
| `GET` | `/health` | — | 204 |

List query parameters:

- `status`: `all` (default), `completed`, `incomplete`, `overdue`
- `sortField`: `createdAt` (default), `dueDate`, `title`
- `sortOrder`: `DESC` (default), `ASC`
- `limit` / `offset` pagination (`X-total-count` header)

`PUT` updates title, description, and due date only. Completion is a separate `PATCH` so status changes cannot be mixed into field edits.

Example:

```bash
curl -s -X POST http://localhost:8000/api/v0/todos \
  -H 'Content-Type: application/json' \
  -d '{"title":"Buy milk","dueDate":"2026-10-10"}'
```

## Assumptions

- Single-user API; no authentication.
- `todoId` is a server-generated UUID.
- `dueDate` is a calendar date (`YYYY-MM-DD`), not a timestamp.
- Overdue means `isCompleted = false` and `dueDate` is before today (UTC).
- Clients cannot set `isCompleted`, `todoId`, or `createdAt` on create/update.

## Build OpenAPI / Redoc locally

```bash
yarn openapi:build
```

Writes `postman/specs/openapi.json` and `redoc-report/index.html`.

## Postman

1. Start the API (`yarn dev:server`).
2. Import `postman/Todo-App.postman_collection.json` (or the YAML collection under `postman/collections/`).
3. Create a Local environment with `protocol` `http`, `host` `localhost`, and `port` `8000`. Environment files are gitignored (`*.postman_environment.json`).
4. Select that environment.
5. Run **Create Todo** first — it writes `todoId` for later Get / Update / Complete / Incomplete / Delete.

The collection includes status-code tests. Use **Run collection** to walk through CRUD in order.

## Trade-offs

- Example config uses SQLite so a checkout runs without SQL Server. Docker uses SQL Server. Tests use SQLite via `server/config/.env.test`.
- Create returns 201 and delete returns 204 (REST), rather than a 200-for-everything pattern.
- Express 5, TypeORM 1.x (`DataSource`), Biome for lint/format.
