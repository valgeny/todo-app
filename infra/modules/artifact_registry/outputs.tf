# -----------------------------------------------------------------------------
# modules/artifact_registry — outputs
# -----------------------------------------------------------------------------

output "repository_id" {
  value       = google_artifact_registry_repository.api.repository_id
  description = "Artifact Registry repository id."
}

output "location" {
  value       = google_artifact_registry_repository.api.location
  description = "Repository location."
}

output "name" {
  value       = google_artifact_registry_repository.api.name
  description = "Full repository name (for IAM members)."
}
