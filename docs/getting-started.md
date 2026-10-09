# Quick start

Install, configure, and run the API and UI — locally with SQLite or with Docker + SQL Server. For GitHub Codespaces, see [Codespaces](codespaces.md).

## Prerequisites

- Node.js 24+
- Yarn classic
- Docker (optional; required for the SQL Server compose stack)

## Install

```bash
yarn install
```

Copy the env examples (env files are gitignored):

```bash
cp server/config/.env.example server/config/.env.local
cp web/config/.env.example web/config/.env.local
```

## Environment files

The API reads `server/config/`. The UI reads `web/config/`. `APP_ENV` selects the API file (`local` when unset):

| API | UI | Use |
| --- | --- | --- |
| `server/config/.env.local` | `web/config/.env.local` | `yarn dev:server` / `yarn dev:web` |
| `server/config/.env.docker` | `web/config/.env.docker` | `docker compose` / `yarn dev:web:docker` |
| `server/config/.env.test` | — | `yarn test:integration` |
| `server/config/.env.dev` / `.env.uat` | matching UI files | Future shared environments (placeholders) |

`DB_NAME` is the SQLite file when `DB_DIALECT=sqlite`, and the SQL Server catalog when `DB_DIALECT=mssql`. SQL Server also uses `DB_HOST`, `DB_PORT`, `DB_USER`, and `DB_PASSWORD`. On startup the API prints `Database sqlite …` or `Database mssql …`.

## Run without Docker (SQLite)

The example API file uses SQLite (`DB_DIALECT=sqlite`, `DB_NAME=data/todo.sqlite`). Uncomment the SQL Server block to use `mssql` instead.

In two terminals:

```bash
yarn dev:server
```

```bash
yarn dev:web
```

- API: `http://localhost:8000`
- UI: `http://localhost:3000`

`VITE_ORIGIN` is the page address; `VITE_API_ORIGIN` is the API the page calls. `yarn dev:web` and `yarn build` read `web/config/.env.local`. Helmet sets security headers; `cors` allows `localhost` and `127.0.0.1` on any port.

### SQL Server on the host only

```bash
docker compose up --build todo-db
```

Point `.env.local` at that instance, then start the API as usual.

### Build / API-only

```bash
yarn build          # UI → dist (local API origin)
yarn start          # API only
```

A later shared-env UI bundle: `yarn workspace web exec vite build --mode dev` or `--mode uat`.

## Run with Docker

1. Copy examples to `server/config/.env.docker` and `web/config/.env.docker`.
2. In the API docker env: enable SQL Server, set `APP_ENV=docker`, `PORT=8080`, `DB_HOST=todo-db`, plus `SA_PASSWORD`, `MSSQL_SA_PASSWORD`, `ACCEPT_EULA=Y`, and `MSSQL_PID=Express`.
3. In the UI docker env: `VITE_ORIGIN=http://localhost:3001` and `VITE_API_ORIGIN=http://localhost:8080`.

```bash
docker compose up --build
```

In another terminal (UI stays on the host):

```bash
yarn dev:web:docker
```

Host ports: `1433` (SQL Server), `8080` (API), `3001` (UI).

## Codespaces

Prefer not to install Node locally? See **[Codespaces](codespaces.md)** — create your own environment from the GitHub UI, then `yarn dev:server` / `yarn dev:web`.

## Next

- [Codespaces](codespaces.md)
- [API docs & contract](api.md)
- [Testing](testing.md)
- [CI/CD](ci-cd.md)
