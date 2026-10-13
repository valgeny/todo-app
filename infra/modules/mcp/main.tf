# -----------------------------------------------------------------------------
# modules/mcp — Cloud Run Streamable HTTP MCP server (calls the Todo REST API)
#
# Separate from modules/apis: different image, no DB, TODO_API_ORIGIN env.
# Uses the same Artifact Registry repo as the API (image name {prefix}-mcp).
# -----------------------------------------------------------------------------

resource "google_service_account" "mcp" {
  account_id   = "${var.prefix}-mcp"
  display_name = "Todo MCP Cloud Run (${var.environment})"
}

# Cloud Run service agent AR reader is granted by modules/artifact_registry.
resource "google_artifact_registry_repository_iam_member" "mcp_reader" {
  location   = var.artifact_registry_location
  repository = var.artifact_registry_name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.mcp.email}"
}

# CI / deploy identities that may gcloud run deploy this service (act-as runtime SA).
resource "google_service_account_iam_member" "deploy_acts_as" {
  for_each = toset(var.deploy_members)

  service_account_id = google_service_account.mcp.name
  role               = "roles/iam.serviceAccountUser"
  member             = each.value
}

locals {
  plain_env = {
    APP_ENV         = var.app_env
    ENVIRONMENT     = var.environment
    TODO_API_ORIGIN = var.api_uri
  }
}

resource "google_cloud_run_v2_service" "mcp" {
  depends_on = [
    google_artifact_registry_repository_iam_member.mcp_reader,
  ]

  name     = "${var.prefix}-mcp"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"
  labels   = var.labels

  deletion_protection = false

  template {
    service_account = google_service_account.mcp.email
    labels          = var.labels

    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }

    containers {
      image = var.image

      ports {
        container_port = var.port
      }

      dynamic "env" {
        for_each = local.plain_env
        content {
          name  = env.key
          value = env.value
        }
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle = true
      }
    }
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  lifecycle {
    ignore_changes = [
      client,
      client_version,
    ]
  }
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.mcp.name
  location = google_cloud_run_v2_service.mcp.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
