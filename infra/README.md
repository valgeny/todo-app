# Terraform — Cloud Run + Cloud SQL

Two roots: **`stack/`** (once per GCP project) and **`env/`** (identical per app environment). Local laptop: SQLite or `docker compose` Postgres — not this stack.

## Layout

| Root | Apply | Creates |
| --- | --- | --- |
| **`stack/`** | once per GCP project | APIs, AR **`todo-nonprod-api`**, WIF + **`gh-deploy-nonprod`**, SQL **`todo-nonprod-pg`**, **IAP OAuth** |
| **`env/`** | once per environment | logical DB + API / MCP / agent (Cloud Run + LB using stack IAP) / FE |

| Identity | State | Tfvars |
| --- | --- | --- |
| **nonprod** (stack) | `states/nonprod.tfstate` | `envs/nonprod.tfvars` |
| **sandbox** (env) | `states/sandbox.tfstate` | `envs/sandbox.tfvars` |
| **staging** (env) | `states/staging.tfstate` | `envs/staging.tfvars` |
| **prod** (env) | `states/prod.tfstate` | `envs/prod.tfvars` |

Sandbox/staging/prod **require** the project stack first. Env tfvars must list stack outputs (`sql_*`, `artifact_registry_*`, `deploy_sa_email`, `iap_*`) — no flags, no fallbacks.

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
| `apis` / `mcp` / `agent` / `frontends` / `secrets` | env | App stack |

### Agent (LangGraph) + IAP

**IAP is stack-owned** (one OAuth client + accessor list per GCP project). Env wires Cloud Run + HTTPS LB and passes through stack `iap_*` outputs.

**Keep OAuth consent Internal** (`orgInternalOnly`). Accessors must be Cloud Identity / Workspace users in the same org — consumer Gmail accounts get `403: org_internal` even if they own the GCP project. Use an address on your verified org domain (e.g. `you@valeriangeny.dev`), not `user:…@gmail.com`.

On the OAuth consent screen, set **support email** to that org address (or an org Google Group). The brand `supportEmail` is shown on the consent UI; keep personal Gmail off it.

Before apply:

1. Ensure Cloud Identity (or Workspace) is linked to the GCP org and you have a directory user on the org domain.
2. Create an **OAuth 2.0 Web client** (APIs & Services → Credentials). Redirect URI: `https://iap.googleapis.com/v1/oauth/clientIds/<CLIENT_ID>:handleRedirect`.
3. Set `iap_oauth_client_*` and `iap_members` (org users only) in **stack** tfvars (`nonprod.tfvars`); re-apply stack (also enables `compute` / `iap` / `aiplatform`).
4. Copy stack `iap_*` outputs into env tfvars; set per-env `agent_iap_host`.
5. After env apply: DNS **A** for `agent_iap_host` → `terraform -chdir=env output -raw agent_iap_ip`.

Public URL: `agent_iap_url`. CI only pushes the agent image. Domain WHOIS for Cloud Domains registrations should stay **REDACTED_CONTACT_DATA** (not public registrant email).

## Cost

One micro SQL instance per GCP project for shared nonprod envs; a dedicated prod GCP project gets its own stack instance. No HA, no VPC connector (Cloud Run Unix socket `/cloudsql/…`). Agent adds a global HTTPS LB + static IP + managed cert (IAP).
