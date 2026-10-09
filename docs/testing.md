# Testing

Integration and end-to-end strategy, how to run tests, and where reports live.

## Latest reports

From `main` on GitHub Pages:

- [Integration (Allure)](https://valgeny.github.io/todo-app/allure/latest/)
- [E2E (Playwright)](https://valgeny.github.io/todo-app/playwright/latest/)

Branch previews: `https://valgeny.github.io/todo-app/<branch>/allure/latest/` and `…/playwright/latest/`. Timestamped history slots are kept under each report (see [CI/CD](ci-cd.md)).

## Layout

| Path | Role |
| --- | --- |
| `tests/integration/` | API + service specs (Node test runner) |
| `tests/e2e/` | Playwright UI specs |
| `test-results/` | All generated output (gitignored) |

Under `test-results/`: `allure-results/`, `allure/`, `playwright/`, `playwright-output/`, `coverage/`.

## Commands

```bash
yarn test                 # lint + integration
yarn test:integration
yarn test:e2e
yarn test:integration:report   # open Allure HTML
yarn test:e2e:report           # open Playwright HTML
yarn lint
yarn format
```

## Integration

- Specs call the todo service and HTTP API in-process (Supertest against `createApp`).
- Database: SQLite via `server/config/.env.test`.
- Coverage: `c8` → `test-results/coverage/`.
- Reporters: console `spec`, Allure HTML, `@reporters/github` (Actions annotations + job summary).

## End-to-end

- Playwright drives Chromium against the UI; config in `playwright.config.ts`.
- Starts API + Vite for the run (SQLite under `data/playwright.sqlite`).
- Reporters: `list`, HTML → `test-results/playwright/`, built-in `github` reporter on Actions.

## Local vs CI artifacts

| Source | What |
| --- | --- |
| Local | Generate under `test-results/`; open with the `*:report` scripts |
| CI artifacts | Allure + Playwright HTML uploaded on every PR and push (14-day retention) |
| GitHub Pages | Same reports published on **push** under `/latest/` and timestamp slots |

Details of publish/deploy: [CI/CD](ci-cd.md).

Committed UI captures from these runs: [Screenshots](screenshots.md).
