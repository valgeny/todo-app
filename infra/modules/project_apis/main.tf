# -----------------------------------------------------------------------------
# modules/project_apis — Enable required GCP APIs for this stack
# -----------------------------------------------------------------------------

resource "google_project_service" "apis" {
  for_each = toset(var.apis)

  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}
