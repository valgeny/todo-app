# -----------------------------------------------------------------------------
# modules/agent — outputs
# -----------------------------------------------------------------------------

output "cloud_run_uri" {
  value       = google_cloud_run_v2_service.agent.uri
  description = "Internal Cloud Run URL (not publicly reachable; use iap_url)."
}

output "service_name" {
  value       = google_cloud_run_v2_service.agent.name
  description = "Cloud Run service name."
}

output "service_account_email" {
  value       = google_service_account.agent.email
  description = "Agent runtime service account email."
}

output "iap_url" {
  value       = "https://${var.iap_host}"
  description = "Public IAP URL (DNS A record → iap_ip)."
}

output "iap_ip" {
  value       = google_compute_global_address.agent.address
  description = "Global HTTPS LB IP — point DNS A for iap_host here."
}

output "iap_host" {
  value       = var.iap_host
  description = "Configured IAP hostname."
}
