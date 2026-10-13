# -----------------------------------------------------------------------------
# modules/github_deploy — outputs
# -----------------------------------------------------------------------------

output "email" {
  value       = google_service_account.github_deploy.email
  description = "Deploy SA email (create a key once for GCP_SA_KEY)."
}
