# -----------------------------------------------------------------------------
# modules/artifact_registry — Docker repo for API images + Cloud Run pull IAM
# -----------------------------------------------------------------------------

data "google_project" "current" {
  project_id = var.project_id
}

resource "google_artifact_registry_repository" "api" {
  location      = var.region
  repository_id = "${var.prefix}-api"
  description   = "Todo API container images (${var.environment})"
  format        = "DOCKER"
  labels        = var.labels
}

# Cloud Run pulls images as the regional service agent (not the runtime SA).
resource "google_artifact_registry_repository_iam_member" "cloudrun_agent_reader" {
  location   = google_artifact_registry_repository.api.location
  repository = google_artifact_registry_repository.api.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:service-${data.google_project.current.number}@serverless-robot-prod.iam.gserviceaccount.com"
}
