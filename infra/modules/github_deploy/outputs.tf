# -----------------------------------------------------------------------------
# modules/github_deploy — outputs
# -----------------------------------------------------------------------------

output "email" {
  value       = google_service_account.github_deploy.email
  description = "Deploy SA email (used by google-github-actions/auth service_account)."
}

output "workload_identity_provider" {
  value       = google_iam_workload_identity_pool_provider.github.name
  description = "Full WIF provider resource name for google-github-actions/auth."
}
