# -----------------------------------------------------------------------------
# modules/github_deploy — GitHub Actions deploy SA + scoped IAM
#
# Create a JSON key once outside Terraform for GitHub secret GCP_SA_KEY —
# never store keys in Terraform state.
# -----------------------------------------------------------------------------

resource "google_service_account" "github_deploy" {
  account_id   = "gh-deploy-${var.environment}"
  display_name = "GitHub Actions deploy (${var.environment})"
}

resource "google_artifact_registry_repository_iam_member" "github_deploy_writer" {
  location   = var.artifact_registry_location
  repository = var.artifact_registry_name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${google_service_account.github_deploy.email}"
}

resource "google_project_iam_member" "github_deploy_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.github_deploy.email}"
}

resource "google_service_account_iam_member" "github_deploy_acts_as_api" {
  service_account_id = var.api_service_account_name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.github_deploy.email}"
}

# FE bucket objectAdmin is owned by modules/frontends (var.deploy_members).
