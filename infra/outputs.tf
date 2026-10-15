# -----------------------------------------------------------------------------
# outputs.tf — Stack outputs (null on nonprod where N/A)
# -----------------------------------------------------------------------------

output "environment" {
  value       = var.environment
  description = "nonprod | sandbox | staging | prod."
}

output "resource_prefix" {
  value       = local.prefix
  description = "Name prefix for env-scoped resources (e.g. todo-sandbox)."
}

output "cloud_sql_instance_name" {
  value       = local.is_nonprod || local.is_app ? local.sql_instance_name : null
  description = "Cloud SQL instance name (todo-nonprod-pg or todo-prod-pg)."
}

output "cloud_sql_connection_name" {
  value       = local.is_nonprod || local.is_app ? local.sql_connection_name : null
  description = "Cloud SQL connection name for Cloud Run."
}

output "cloud_sql_db_name" {
  value       = try(module.sql_database[0].db_name, null)
  description = "Logical database name (null on nonprod)."
}

output "artifact_registry_repo" {
  value       = try(module.artifact_registry[0].repository_id, null)
  description = "Artifact Registry repository id (app envs)."
}

output "api_image" {
  value       = local.is_app ? local.image : null
  description = "API container image URI."
}

output "api_uri" {
  value       = try(module.apis[0].uri, null)
  description = "Cloud Run API URL."
}

output "frontend_bucket" {
  value       = try(module.frontends[0].bucket_name, null)
  description = "GCS bucket for web/dist."
}

output "frontend_website_url" {
  value       = try(module.frontends[0].website_url, null)
  description = "Public object URL for the SPA."
}

output "secret_ids" {
  value       = try(module.secrets[0].secret_ids, null)
  description = "Secret Manager secret ids."
}

output "github_deploy_sa_email" {
  value       = try(module.github_deploy[0].email, null)
  description = "Deploy SA email for WIF auth."
}

output "workload_identity_provider" {
  value       = try(module.github_deploy[0].workload_identity_provider, null)
  description = "WIF provider resource name."
}

output "mcp_uri" {
  value       = try(module.mcp[0].uri, null)
  description = "Cloud Run MCP service URL."
}

output "mcp_endpoint" {
  value       = try(module.mcp[0].mcp_endpoint, null)
  description = "Streamable HTTP MCP endpoint (…/mcp)."
}

output "mcp_image" {
  value       = local.is_app ? local.mcp_image : null
  description = "MCP container image URI."
}
