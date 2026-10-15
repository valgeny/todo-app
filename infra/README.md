# Terraform — Cloud Run + Cloud SQL (nonprod shared / prod dedicated)

Local laptop: SQLite or `docker compose` Postgres — not this stack.

## Environments

| Env | State | Creates |
| --- | --- | --- |
| **nonprod** | `states/nonprod.tfstate` | Cloud SQL **`todo-nonprod-pg`** only (shared) |
| **sandbox** | `states/sandbox.tfstate` | DB **`todo_sandbox`** on nonprod instance + API/MCP/FE |
| **staging** | `states/staging.tfstate` | DB **`todo_staging`** on nonprod instance + API/MCP/FE |
| **prod** | `states/prod.tfstate` | Cloud SQL **`todo-prod-pg`** + DB **`todo_prod`** + API/MCP/FE |

Sandbox/staging **require** nonprod first: they look up `todo-nonprod-pg` and fail if it is missing.

## Apply order

```bash
cd infra

# 1) Shared nonprod Postgres (once)
cp envs/nonprod.tfvars.example envs/nonprod.tfvars   # set project_id
terraform init -reconfigure -backend-config=backends/nonprod.hcl
terraform apply -var-file=envs/nonprod.tfvars

# 2) Sandbox app (logical DB + Cloud Run)
cp envs/sandbox.tfvars.example envs/sandbox.tfvars
terraform init -reconfigure -backend-config=backends/sandbox.hcl
terraform apply -var-file=envs/sandbox.tfvars
```

First Cloud SQL create can take **10–15 minutes**. Then deploy images:

```bash
gh workflow run deploy-gcp.yml --ref dev
```

## Modules

| Module | Role |
| --- | --- |
| `sql_instance` | Cloud SQL instance (`db-f1-micro`, zonal, 10 GB HDD) |
| `sql_database` | Logical DB + user on an existing instance |
| `apis` / `mcp` / `frontends` | App stack (not created for `nonprod`) |

## Cost

One shared micro instance for all nonprod envs; prod has its own. No HA, no VPC connector (Cloud Run Unix socket `/cloudsql/…`).

## Migrating old single `terraform.tfstate`

If you previously applied sandbox into `terraform.tfstate`:

```bash
mkdir -p states
mv terraform.tfstate states/sandbox.tfstate   # if it was sandbox-only
terraform init -reconfigure -backend-config=backends/sandbox.hcl
```

Then apply **nonprod** in its own state before changing DB wiring on sandbox.
