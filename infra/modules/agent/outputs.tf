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
  description = "Global HTTPS LB IP — point DNS A for iap_host / ui_host here."
}

output "iap_host" {
  value       = var.iap_host
  description = "Configured Agent Server IAP hostname."
}

output "ui_url" {
  value       = "https://${var.ui_host}"
  description = "Public CopilotKit agent-ui URL behind IAP."
}

output "ui_host" {
  value       = var.ui_host
  description = "Configured UI hostname."
}

output "ui_service_name" {
  value       = google_cloud_run_v2_service.agent_ui.name
  description = "Cloud Run agent-ui service name."
}
