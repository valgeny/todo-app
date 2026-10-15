# -----------------------------------------------------------------------------
# modules/github_deploy — GitHub Actions deploy SA + Workload Identity Federation
#
# No JSON keys: GitHub OIDC → impersonate this SA (fits orgs that disable SA keys).
# WIF pool id `github-actions` is project-scoped — only the project stack
# (infra/stack) should create this module, once per GCP project.
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

# Runtime act-as (API/MCP) and FE bucket write are owned by those modules via
# var.deploy_members — this module only creates the deploy identity + WIF + AR/Run.

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github-actions"
  display_name              = "GitHub Actions"
  description               = "OIDC pool for GitHub Actions deploys"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  display_name                       = "GitHub"
  description                        = "GitHub Actions OIDC (${var.github_repository})"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }

  attribute_condition = "assertion.repository == \"${var.github_repository}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "github_wif" {
  service_account_id = google_service_account.github_deploy.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}
