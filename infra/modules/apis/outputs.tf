# -----------------------------------------------------------------------------
# modules/apis — outputs
# -----------------------------------------------------------------------------

output "service_account_email" {
  value       = google_service_account.api.email
  description = "Cloud Run runtime service account email."
}

output "service_account_name" {
  value       = google_service_account.api.name
  description = "Cloud Run runtime service account resource name (for act-as IAM)."
}

output "service_name" {
  value       = google_cloud_run_v2_service.api.name
  description = "Cloud Run service name."
}

output "uri" {
  value       = google_cloud_run_v2_service.api.uri
  description = "Cloud Run service URL."
}
