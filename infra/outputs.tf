# -----------------------------------------------------------------------------
# outputs.tf — Stack outputs (re-export module outputs)
#
# After apply:
#   terraform output
#   terraform output -raw api_uri
#   terraform output -raw github_deploy_sa_email
# -----------------------------------------------------------------------------

output "environment" {
  value       = var.environment
  description = "Deployment environment (sandbox | staging | prod)."
}

output "resource_prefix" {
  value       = local.prefix
  description = "Name prefix for env-scoped resources (e.g. todo-sandbox)."
}

output "artifact_registry_repo" {
  value       = module.artifact_registry.repository_id
  description = "Artifact Registry repository id for API images."
}

output "api_image" {
  value       = local.image
  description = "Container image URI used by Cloud Run (build/push this tag)."
}

output "api_uri" {
  value       = module.apis.uri
  description = "Cloud Run service URL (scales to 0; SQLite data is ephemeral)."
}

output "frontend_bucket" {
  value       = try(module.frontends[0].bucket_name, null)
  description = "GCS bucket for web/dist (null if create_frontend_bucket is false)."
}

output "frontend_website_url" {
  value       = try(module.frontends[0].website_url, null)
  description = "Public object URL for the SPA (not a custom domain)."
}

output "secret_ids" {
  value       = module.secrets.secret_ids
  description = "Secret Manager secret ids mounted as Cloud Run env vars."
}

output "github_deploy_sa_email" {
  value       = module.github_deploy.email
  description = "Deploy SA email. Create a JSON key once for GitHub secret GCP_SA_KEY (do not manage keys in Terraform)."
}
