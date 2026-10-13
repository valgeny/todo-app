# -----------------------------------------------------------------------------
# modules/frontends — Public GCS website bucket for the SPA
#
# HTTPS custom domain usually needs a Load Balancer (~$18+/mo); skip for demos.
# -----------------------------------------------------------------------------

resource "google_storage_bucket" "frontend" {
  name                        = var.bucket_name
  location                    = var.region
  force_destroy               = true
  uniform_bucket_level_access = true
  labels                      = var.labels

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html"
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "OPTIONS"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
}

resource "google_storage_bucket_iam_member" "frontend_public" {
  bucket = google_storage_bucket.frontend.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# CI / deploy identities that may upload objects (e.g. GitHub Actions deploy SA).
resource "google_storage_bucket_iam_member" "deploy_writer" {
  for_each = toset(var.deploy_members)

  bucket = google_storage_bucket.frontend.name
  role   = "roles/storage.objectAdmin"
  member = each.value
}
