# Terraform — Cloud Run + Cloud SQL

Two roots: **`stack/`** (once per GCP project) and **`env/`** (identical per app environment). Local laptop: SQLite or `docker compose` Postgres — not this stack.

## Layout

| Root | Apply | Creates |
| --- | --- | --- |
| **`stack/`** | once per GCP project | APIs, AR **`todo-nonprod-api`**, WIF + **`gh-deploy-nonprod`**, SQL **`todo-nonprod-pg`** |
| **`env/`** | once per environment | logical DB + API / MCP / FE |

| Identity | State | Tfvars |
| --- | --- | --- |
| **nonprod** (stack) | `states/nonprod.tfstate` | `envs/nonprod.tfvars` |
| **sandbox** (env) | `states/sandbox.tfstate` | `envs/sandbox.tfvars` |
| **staging** (env) | `states/staging.tfstate` | `envs/staging.tfvars` |
| **prod** (env) | `states/prod.tfstate` | `envs/prod.tfvars` |

Sandbox/staging/prod **require** the project stack first. Env tfvars must list stack outputs (`sql_*`, `artifact_registry_*`, `deploy_sa_email`) — no flags, no fallbacks.

## Apply order

```bash
cd infra

# 1) Project stack (once)
cp envs/nonprod.tfvars.example envs/nonprod.tfvars   # set project_id
terraform -chdir=stack init -reconfigure -backend-config=backends/nonprod.hcl
terraform -chdir=stack apply -var-file=../envs/nonprod.tfvars
terraform -chdir=stack output

# 2) Sandbox env (copy stack outputs into sandbox.tfvars)
cp envs/sandbox.tfvars.example envs/sandbox.tfvars
terraform -chdir=env init -reconfigure -backend-config=backends/sandbox.hcl
terraform -chdir=env apply -var-file=../envs/sandbox.tfvars
```

First Cloud SQL create can take **10–15 minutes**. Then deploy images (CI uses nonprod WIF + AR):

```bash
gh workflow run deploy-gcp.yml --ref dev
```

## Modules

| Module | Used by | Role |
| --- | --- | --- |
| `project_apis` | stack | Enable GCP APIs |
| `artifact_registry` | stack | Docker repo (`todo-nonprod-api`) |
| `github_deploy` | stack | Deploy SA + WIF pool |
| `sql_instance` | stack | Cloud SQL instance (`db-f1-micro`, zonal, 10 GB HDD) |
| `sql_database` | env | Logical DB + user on the stack instance |
| `apis` / `mcp` / `frontends` / `secrets` | env | App stack |

## Cost

One micro SQL instance per GCP project for shared nonprod envs; a dedicated prod GCP project gets its own stack instance. No HA, no VPC connector (Cloud Run Unix socket `/cloudsql/…`).
