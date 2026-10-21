# Quick start

Install, configure, and run the API and UI — locally with SQLite or with Docker + Postgres. For GitHub Codespaces, see [Codespaces](codespaces.md).

## Prerequisites

- Node.js 24+
- Corepack (included with Node 24; it installs the Yarn 4 version pinned in `package.json`)
- Docker (optional; required for the Postgres compose stack)

## Install

```bash
corepack enable
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

Supported dialects: **`sqlite`** and **`postgres`** only. On startup the API prints `Database sqlite …` or `Database postgres …`.

| Dialect | `DB_NAME` | Also need |
| --- | --- | --- |
| `sqlite` | File path or `:memory:` | — |
| `postgres` | Catalog name | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` |

## Run without Docker (SQLite)

The example API file uses SQLite (`DB_DIALECT=sqlite`, `DB_NAME=data/todo.sqlite`).

In two terminals:

```bash
yarn dev:server
```

```bash
yarn dev:web
```

- API: `http://localhost:8000`
- UI: `http://localhost:3000`

### Postgres on the host (Docker DB only)

```bash
docker compose up todo-db
```

Point `.env.local` at Postgres (see comments in `.env.example`), then start the API as usual.

### Build / API-only

```bash
yarn build          # UI → dist (local API origin)
yarn start          # API only
```

## Run with Docker

Compose starts **Postgres 16** (`todo-db`) and the API. Env for the API is set in `docker-compose.yml` (no MSSQL).

```bash
docker compose up --build
```

In another terminal (UI stays on the host):

```bash
yarn dev:web:docker
```

Host ports: `5432` (Postgres), `8080` (API), `3001` (UI).

## Cloud Run (sandbox / staging / prod)

Each env gets its own Cloud SQL instance via Terraform (`todo-{env}-pg`). See [infra/README.md](../infra/README.md).

## Codespaces

Prefer not to install Node locally? See **[Codespaces](codespaces.md)** — use SQLite there.

## Next

- [Codespaces](codespaces.md)
- [API docs & contract](api.md)
- [Testing](testing.md)
- [CI/CD](ci-cd.md)
