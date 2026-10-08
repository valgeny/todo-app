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

The API reads `server/config/`. The UI reads `web/config/`. `APP_ENV` selects the API file (`local` when unset):

| API | UI | Use |
| --- | --- | --- |
| `server/config/.env.local` | `web/config/.env.local` | `yarn dev:server` and `yarn dev:web` |
| `server/config/.env.docker` | `web/config/.env.docker` | `docker compose` and `yarn dev:web:docker` |
| `server/config/.env.dev` | `web/config/.env.dev` | Future shared dev. Placeholder host only. |
| `server/config/.env.uat` | `web/config/.env.uat` | Future UAT. Placeholder host only. |
| `server/config/.env.test` | `web/config/.env.test` | `yarn test` |

`DB_NAME` is the SQLite file when `DB_DIALECT=sqlite` (the test file sets `:memory:`), and the SQL Server catalog when `DB_DIALECT=mssql`. SQL Server also uses `DB_HOST`, `DB_PORT`, `DB_USER`, and `DB_PASSWORD`. On startup the API prints `Database sqlite :memory:` or `Database mssql localhost/TodoApp`.

The local API listens on port `8000`. Open the UI at `http://localhost:3000`. The page calls `VITE_API_ORIGIN` from the matching UI file. `yarn dev:web` and `yarn build` read `web/config/.env.local`. Vite reserves the mode name `local`, so those commands use Vite's normal modes and still open that file. A later dev or UAT bundle is `yarn workspace web exec vite build --mode dev` or `--mode uat`. Helmet sets the security headers, and `cors` allows `localhost` and `127.0.0.1` on any port.

Start the database before the host API:

```bash
docker compose up --build todo-db
```

`yarn start` runs the API only. `yarn build` writes the UI with the local API origin. `yarn workspace web build` can take `--mode dev` or `--mode uat` later.

### Docker

```bash
docker compose up --build
```

This builds the API image and a SQL Server 2019 image, creates the `TodoApp` database, and starts both. The UI stays on the host with `yarn dev:web:docker`, which reads `web/config/.env.docker` and listens on port `3001`. Host ports are `1433` and `8080` for the database and API.

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

Tests load `server/config/.env.test`. That file sets `DB_DIALECT=sqlite` and `DB_NAME=:memory:`.

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
curl -s -X POST http://localhost:8000/api/v0/todos \
  -H 'Content-Type: application/json' \
  -d '{"title":"Buy milk","dueDate":"2026-10-10"}'
```

## Postman

1. Start the API (`yarn dev:server`).
2. In Postman: **Import** `postman/Todo-App.postman_collection.json` and `postman/Local.postman_environment.json`.
3. Select the **Local** environment (`http://localhost:8000`).
4. Run **Create Todo** first. It writes `todoId` onto the Local environment so Get / Update / Complete / Incomplete / Delete reuse it.

The collection includes status-code tests. Use **Run collection** to walk through CRUD in order.

## Design

- **Layers:** `main` → `createApp` → routers → controllers (`validation` + `handler`) → `todoService` → TypeORM `Todo` entity.
- **Validation:** Joi schemas live with the model; a small `validate` middleware binds them to each controller (same pattern as webconf’s `express-validation`, which is no longer maintained).
- **Persistence:** TypeORM 1.x `DataSource`. `DB_DIALECT=mssql` uses SQL Server. `DB_DIALECT=sqlite` uses `better-sqlite3`. Active Record (`Todo.create` / `find` / `save`) matches webconf. `synchronize: true` creates the `todo` table.
- **Errors:** Shared `BaseError` types mapped to HTTP status codes (400 validation, 404 missing entity/route, 500 unexpected).
- **Testing:** Service tests cover CRUD, filters, and not-found behavior. HTTP tests use Supertest against `createApp`. The database comes from `server/config/.env.test`.

## Assumptions

- Single-user API; no authentication.
- `todoId` is a server-generated UUID.
- `dueDate` is a calendar date (`YYYY-MM-DD`), not a timestamp.
- Overdue means `isCompleted = false` and `dueDate` is before today (UTC).
- Clients cannot set `isCompleted`, `todoId`, or `createdAt` on create/update.

## Trade-offs

- SQL Server for local and Docker. Automated tests stay on in-memory SQLite via `server/config/.env.test`.
- Express 5, TypeORM 1.x (`DataSource` instead of `createConnection`), Biome instead of TSLint/ESLint/Prettier.
- Create returns 201 and delete returns 204 (REST), rather than webconf’s 200-for-everything pattern.
- The UI is one page (Vite, React, MUI). It does not add a second backend.
