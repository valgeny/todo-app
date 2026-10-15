# -----------------------------------------------------------------------------
# outputs.tf — Always set (no try / null).
# -----------------------------------------------------------------------------

output "environment" {
  value       = var.environment
  description = "sandbox | staging | prod."
}

output "resource_prefix" {
  value       = local.prefix
  description = "Name prefix for env-scoped resources (e.g. todo-sandbox)."
}

output "cloud_sql_instance_name" {
  value       = var.sql_instance_name
  description = "Cloud SQL instance name (from stack)."
}

output "cloud_sql_connection_name" {
  value       = var.sql_connection_name
  description = "Cloud SQL connection name (from stack)."
}

output "cloud_sql_db_name" {
  value       = module.sql_database.db_name
  description = "Logical database name."
}

output "artifact_registry_repo" {
  value       = var.artifact_registry_repository_id
  description = "Artifact Registry repository id (from stack)."
}

output "api_image" {
  value       = local.image
  description = "API container image URI."
}

output "api_uri" {
  value       = module.apis.uri
  description = "Cloud Run API URL."
}

output "frontend_bucket" {
  value       = module.frontends.bucket_name
  description = "GCS bucket for web/dist."
}

output "frontend_website_url" {
  value       = module.frontends.website_url
  description = "Public object URL for the SPA."
}

output "secret_ids" {
  value       = module.secrets.secret_ids
  description = "Secret Manager secret ids."
}

output "github_deploy_sa_email" {
  value       = var.deploy_sa_email
  description = "Deploy SA email (from stack)."
}

output "mcp_uri" {
  value       = module.mcp.uri
  description = "Cloud Run MCP service URL."
}

output "mcp_endpoint" {
  value       = module.mcp.mcp_endpoint
  description = "Streamable HTTP MCP endpoint (…/mcp)."
}

output "mcp_image" {
  value       = local.mcp_image
  description = "MCP container image URI."
}
