# -----------------------------------------------------------------------------
# modules/mcp — outputs
# -----------------------------------------------------------------------------

output "uri" {
  value       = google_cloud_run_v2_service.mcp.uri
  description = "Cloud Run MCP service URL (Streamable HTTP at /mcp)."
}

output "mcp_endpoint" {
  value       = "${google_cloud_run_v2_service.mcp.uri}/mcp"
  description = "MCP Streamable HTTP endpoint URL."
}

output "service_name" {
  value       = google_cloud_run_v2_service.mcp.name
  description = "Cloud Run service name."
}

output "service_account_email" {
  value       = google_service_account.mcp.email
  description = "MCP runtime service account email."
}

output "service_account_name" {
  value       = google_service_account.mcp.name
  description = "MCP runtime service account resource name (for act-as IAM)."
}
