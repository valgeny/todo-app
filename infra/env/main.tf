# -----------------------------------------------------------------------------
# main.tf — App environment stack (identical every environment)
#
# Creates: logical DB, secrets, Cloud Run API/MCP, FE bucket.
# Requires project stack outputs in tfvars (no data-source fallbacks).
#
#   terraform -chdir=env init -reconfigure -backend-config=backends/sandbox.hcl
#   terraform -chdir=env apply -var-file=../envs/sandbox.tfvars
# -----------------------------------------------------------------------------

locals {
  prefix = "${var.name_prefix}-${var.environment}"

  common_labels = {
    app         = var.name_prefix
    environment = var.environment
    managed_by  = "terraform"
  }

  fe_bucket_name = "${var.project_id}-${local.prefix}-web"

  cors_origins = "localhost,127.0.0.1,*.run.app,storage.googleapis.com,${local.fe_bucket_name}.storage.googleapis.com"

  managed_secrets = merge(
    {
      CORS_ORIGINS = local.cors_origins
      DB_PASSWORD  = module.sql_database.db_password
    },
    var.secret_env,
  )

  image = var.image != "" ? var.image : (
    "${var.region}-docker.pkg.dev/${var.project_id}/${var.artifact_registry_repository_id}/${local.prefix}-api:latest"
  )

  mcp_image = var.mcp_image != "" ? var.mcp_image : (
    "${var.region}-docker.pkg.dev/${var.project_id}/${var.artifact_registry_repository_id}/${local.prefix}-mcp:latest"
  )
}

module "sql_database" {
  source = "../modules/sql_database"

  instance_name = var.sql_instance_name
  db_name       = "todo_${var.environment}"
  db_user       = "todo_${var.environment}"
}

module "secrets" {
  source = "../modules/secrets"

  depends_on = [module.sql_database]

  prefix  = local.prefix
  labels  = local.common_labels
  secrets = local.managed_secrets
}

module "apis" {
  source = "../modules/apis"

  depends_on = [module.secrets]

  prefix                     = local.prefix
  environment                = var.environment
  region                     = var.region
  labels                     = local.common_labels
  image                      = local.image
  artifact_registry_location = var.artifact_registry_location
  artifact_registry_name     = var.artifact_registry_name
  secret_resources           = module.secrets.secret_resources
  deploy_members = [
    "serviceAccount:${var.deploy_sa_email}",
  ]

  db_dialect          = "postgres"
  db_name             = module.sql_database.db_name
  db_host             = "/cloudsql/${var.sql_connection_name}"
  db_port             = module.sql_database.db_port
  db_user             = module.sql_database.db_user
  cloud_sql_instances = [var.sql_connection_name]
}

resource "google_project_iam_member" "api_cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${module.apis.service_account_email}"
}

module "mcp" {
  source = "../modules/mcp"

  depends_on = [module.apis]

  prefix                     = local.prefix
  environment                = var.environment
  region                     = var.region
  labels                     = local.common_labels
  image                      = local.mcp_image
  api_uri                    = module.apis.uri
  artifact_registry_location = var.artifact_registry_location
  artifact_registry_name     = var.artifact_registry_name
  deploy_members = [
    "serviceAccount:${var.deploy_sa_email}",
  ]
}

module "frontends" {
  source = "../modules/frontends"

  bucket_name = local.fe_bucket_name
  region      = var.region
  labels      = local.common_labels
  deploy_members = [
    "serviceAccount:${var.deploy_sa_email}",
  ]
}
