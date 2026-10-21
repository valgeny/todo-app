# -----------------------------------------------------------------------------
# modules/project_apis — outputs
# -----------------------------------------------------------------------------

output "services" {
  value       = [for s in google_project_service.apis : s.service]
  description = "Enabled API service names."
}
