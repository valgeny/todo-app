# -----------------------------------------------------------------------------
# outputs.tf — Always set (no try / null). Pass these into env tfvars.
# -----------------------------------------------------------------------------

output "environment" {
  value       = var.environment
  description = "nonprod | prod (this GCP project's stack)."
}

output "resource_prefix" {
  value       = local.prefix
  description = "Name prefix (e.g. todo-nonprod)."
}

output "cloud_sql_instance_name" {
  value       = module.sql_instance.instance_name
  description = "Cloud SQL instance name (for env tfvars)."
}

output "cloud_sql_connection_name" {
  value       = module.sql_instance.connection_name
  description = "Cloud SQL connection name for Cloud Run."
}

output "artifact_registry_repo" {
  value       = module.artifact_registry.repository_id
  description = "Artifact Registry repository id."
}

output "artifact_registry_location" {
  value       = module.artifact_registry.location
  description = "Artifact Registry location."
}

output "artifact_registry_name" {
  value       = module.artifact_registry.name
  description = "Full Artifact Registry repository name (for IAM)."
}

output "github_deploy_sa_email" {
  value       = module.github_deploy.email
  description = "Deploy SA email for WIF auth."
}

output "workload_identity_provider" {
  value       = module.github_deploy.workload_identity_provider
  description = "WIF provider resource name."
}
