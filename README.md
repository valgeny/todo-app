# To-Do List

REST API and a small React page for managing to-do items. The API follows the webconf Node/TypeScript service: Express routers, Joi-validated controllers, TypeORM models, and shared error middleware. The UI lives in `web/` and is a Vite + React + Material UI single page.

## Requirements

- Node.js 20 or later
- Yarn 1 (classic)

## Build / run

```bash
yarn install
```

Start the backend and the frontend in two terminals:

```bash
yarn dev:server
```

```bash
yarn dev:web
```

The API listens on port `8080` (override with `PORT`). Open the UI at `http://localhost:5173`. The page calls `http://localhost:8080` directly. Helmet sets the security headers, and `cors` allows `localhost` and `127.0.0.1` on any port. SQLite data is stored at `data/todos.sqlite` (override with `SQLITE_PATH`).

`yarn start` runs the API only. `yarn build` writes the UI to `web/dist`.

### Docker

```bash
docker compose up --build
```

The SQLite file is persisted on the `./data` volume.

## Tests

```bash
yarn test
```

That runs Biome from the repo root, then Mocha with coverage (`c8`) in `server/`. Lint/format only:

```bash
yarn lint
yarn format
```

API tests only:

```bash
yarn workspace server test
```

Tests use an in-memory SQLite database so they do not touch `data/todos.sqlite`.

## API

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
curl -s -X POST http://localhost:8080/api/v0/todos \
  -H 'Content-Type: application/json' \
  -d '{"title":"Buy milk","dueDate":"2026-10-10"}'
```

## Postman

1. Start the API (`yarn dev:server`).
2. In Postman: **Import** `postman/Todo-App.postman_collection.json` and `postman/Local.postman_environment.json`.
3. Select the **Local** environment (`http://localhost:8080`).
4. Run **Create Todo** first. It writes `todoId` onto the Local environment so Get / Update / Complete / Incomplete / Delete reuse it.

The collection includes status-code tests. Use **Run collection** to walk through CRUD in order.

## Design

- **Layers:** `main` → `createApp` → routers → controllers (`validation` + `handler`) → `todoService` → TypeORM `Todo` entity.
- **Validation:** Joi schemas live with the model; a small `validate` middleware binds them to each controller (same pattern as webconf’s `express-validation`, which is no longer maintained).
- **Persistence:** TypeORM 1.x `DataSource` + SQLite (`better-sqlite3`). Active Record (`Todo.create` / `find` / `save`) matches webconf. `synchronize: true` for the challenge; migrations would be the production follow-up.
- **Errors:** Shared `BaseError` types mapped to HTTP status codes (400 validation, 404 missing entity/route, 500 unexpected).
- **Testing:** Service tests cover CRUD, filters, and not-found behavior. HTTP tests use Supertest against `createApp` with an in-memory database.

## Assumptions

- Single-user API; no authentication.
- `todoId` is a server-generated UUID.
- `dueDate` is a calendar date (`YYYY-MM-DD`), not a timestamp.
- Overdue means `isCompleted = false` and `dueDate` is before today (UTC).
- Clients cannot set `isCompleted`, `todoId`, or `createdAt` on create/update.

## Trade-offs

- SQLite instead of webconf’s SQL Server: same TypeORM architecture, much simpler local/test setup. Postgres can replace the driver later without changing controllers.
- Express 5, TypeORM 1.x (`DataSource` instead of `createConnection`), Biome instead of TSLint/ESLint/Prettier.
- Create returns 201 and delete returns 204 (REST), rather than webconf’s 200-for-everything pattern.
- The UI is one page (Vite, React, MUI). It does not add a second backend.
