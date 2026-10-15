# -----------------------------------------------------------------------------
# main.tf — Root stack by environment
#
#   nonprod  → Cloud SQL instance only (todo-nonprod-pg), shared by sandbox/staging
#   sandbox  → logical DB todo_sandbox on nonprod instance + Cloud Run/MCP/FE
#   staging  → logical DB todo_staging on nonprod instance + Cloud Run/…
#   prod     → Cloud SQL todo-prod-pg + DB todo_prod + Cloud Run/…
#
# Apply order: nonprod once → then sandbox (or staging). Prod is independent.
# Separate local state per env (see backends/*.hcl).
#
# Local laptop: SQLite or docker compose Postgres — not this stack.
# -----------------------------------------------------------------------------

locals {
  is_nonprod       = var.environment == "nonprod"
  is_prod          = var.environment == "prod"
  is_app           = contains(["sandbox", "staging", "prod"], var.environment)
  uses_nonprod_sql = contains(["sandbox", "staging"], var.environment)

  enabled_apis = concat(
    ["sqladmin.googleapis.com", "iam.googleapis.com"],
    local.is_app ? [
      "run.googleapis.com",
      "artifactregistry.googleapis.com",
      "iamcredentials.googleapis.com",
      "sts.googleapis.com",
      "cloudbuild.googleapis.com",
      "secretmanager.googleapis.com",
    ] : [],
  )

  # App resources: todo-sandbox-api. SQL instances: todo-nonprod-pg / todo-prod-pg.
  prefix = "${var.name_prefix}-${var.environment}"

  sql_instance_id = local.is_prod ? "${var.name_prefix}-prod-pg" : "${var.name_prefix}-nonprod-pg"

  common_labels = {
    app         = var.name_prefix
    environment = var.environment
    managed_by  = "terraform"
  }

  fe_bucket_name = "${var.project_id}-${local.prefix}-web"

  cors_origins = var.create_frontend_bucket ? "localhost,127.0.0.1,*.run.app,storage.googleapis.com,${local.fe_bucket_name}.storage.googleapis.com" : "localhost,127.0.0.1,*.run.app"

  # Resolved after sql_instance / data source below.
  sql_instance_name   = local.is_nonprod || local.is_prod ? module.sql_instance[0].instance_name : data.google_sql_database_instance.nonprod[0].name
  sql_connection_name = local.is_nonprod || local.is_prod ? module.sql_instance[0].connection_name : data.google_sql_database_instance.nonprod[0].connection_name

  managed_secrets = local.is_app ? merge(
    {
      CORS_ORIGINS = local.cors_origins
      DB_PASSWORD  = module.sql_database[0].db_password
    },
    var.secret_env,
  ) : {}

  image = local.is_app ? (
    var.image != "" ? var.image : "${var.region}-docker.pkg.dev/${var.project_id}/${module.artifact_registry[0].repository_id}/${local.prefix}-api:latest"
  ) : ""

  mcp_image = local.is_app ? (
    var.mcp_image != "" ? var.mcp_image : "${var.region}-docker.pkg.dev/${var.project_id}/${module.artifact_registry[0].repository_id}/${local.prefix}-mcp:latest"
  ) : ""
}

# -----------------------------------------------------------------------------
# Always: enable APIs
# -----------------------------------------------------------------------------

module "project_apis" {
  source = "./modules/project_apis"

  project_id = var.project_id
  apis       = local.enabled_apis
}

# -----------------------------------------------------------------------------
# SQL instance: created by nonprod or prod only
# -----------------------------------------------------------------------------

module "sql_instance" {
  source = "./modules/sql_instance"
  count  = local.is_nonprod || local.is_prod ? 1 : 0

  depends_on = [module.project_apis]

  project_id          = var.project_id
  instance_name       = local.sql_instance_id
  region              = var.region
  labels              = local.common_labels
  deletion_protection = local.is_prod
  enable_backups      = local.is_prod
}

# sandbox / staging: require nonprod instance (fails if not applied yet)
data "google_sql_database_instance" "nonprod" {
  count   = local.uses_nonprod_sql ? 1 : 0
  name    = "${var.name_prefix}-nonprod-pg"
  project = var.project_id

  depends_on = [module.project_apis]
}

# -----------------------------------------------------------------------------
# Logical DB: sandbox / staging / prod only
# -----------------------------------------------------------------------------

module "sql_database" {
  source = "./modules/sql_database"
  count  = local.is_app ? 1 : 0

  instance_name = local.sql_instance_name
  db_name       = "todo_${var.environment}"
  db_user       = "todo_${var.environment}"
}

# -----------------------------------------------------------------------------
# App stack: sandbox / staging / prod only
# -----------------------------------------------------------------------------

module "artifact_registry" {
  source = "./modules/artifact_registry"
  count  = local.is_app ? 1 : 0

  depends_on = [module.project_apis]

  project_id  = var.project_id
  region      = var.region
  prefix      = local.prefix
  environment = var.environment
  labels      = local.common_labels
}

module "secrets" {
  source = "./modules/secrets"
  count  = local.is_app ? 1 : 0

  depends_on = [module.project_apis, module.sql_database]

  prefix  = local.prefix
  labels  = local.common_labels
  secrets = local.managed_secrets
}

module "github_deploy" {
  source = "./modules/github_deploy"
  count  = local.is_app ? 1 : 0

  depends_on = [module.project_apis, module.artifact_registry]

  project_id                 = var.project_id
  environment                = var.environment
  artifact_registry_location = module.artifact_registry[0].location
  artifact_registry_name     = module.artifact_registry[0].name
  github_repository          = var.github_repository
}

module "apis" {
  source = "./modules/apis"
  count  = local.is_app ? 1 : 0

  depends_on = [module.project_apis, module.artifact_registry, module.secrets]

  prefix                     = local.prefix
  environment                = var.environment
  region                     = var.region
  labels                     = local.common_labels
  image                      = local.image
  artifact_registry_location = module.artifact_registry[0].location
  artifact_registry_name     = module.artifact_registry[0].name
  secret_resources           = module.secrets[0].secret_resources
  deploy_members = [
    "serviceAccount:${module.github_deploy[0].email}",
  ]

  db_dialect          = "postgres"
  db_name             = module.sql_database[0].db_name
  db_host             = "/cloudsql/${local.sql_connection_name}"
  db_port             = module.sql_database[0].db_port
  db_user             = module.sql_database[0].db_user
  cloud_sql_instances = [local.sql_connection_name]
}

resource "google_project_iam_member" "api_cloudsql_client" {
  count = local.is_app ? 1 : 0

  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${module.apis[0].service_account_email}"
}

module "mcp" {
  source = "./modules/mcp"
  count  = local.is_app ? 1 : 0

  depends_on = [module.project_apis, module.artifact_registry, module.apis]

  prefix                     = local.prefix
  environment                = var.environment
  region                     = var.region
  labels                     = local.common_labels
  image                      = local.mcp_image
  api_uri                    = module.apis[0].uri
  artifact_registry_location = module.artifact_registry[0].location
  artifact_registry_name     = module.artifact_registry[0].name
  deploy_members = [
    "serviceAccount:${module.github_deploy[0].email}",
  ]
}

module "frontends" {
  source = "./modules/frontends"
  count  = local.is_app && var.create_frontend_bucket ? 1 : 0

  bucket_name = local.fe_bucket_name
  region      = var.region
  labels      = local.common_labels
  deploy_members = [
    "serviceAccount:${module.github_deploy[0].email}",
  ]
}
