# -----------------------------------------------------------------------------
# modules/agent — LangGraph API on Cloud Run, fronted by HTTPS LB + IAP
#
# Access: browser Google login via IAP → LB → Cloud Run (not public run.app).
# Runtime uses Vertex ADC (roles/aiplatform.user) + TODO_MCP_URL.
# -----------------------------------------------------------------------------

data "google_project" "current" {
  project_id = var.project_id
}

resource "google_service_account" "agent" {
  account_id   = "${var.prefix}-agent"
  display_name = "Todo agent Cloud Run (${var.environment})"
}

resource "google_project_iam_member" "agent_aiplatform_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.agent.email}"
}

resource "google_artifact_registry_repository_iam_member" "agent_reader" {
  location   = var.artifact_registry_location
  repository = var.artifact_registry_name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.agent.email}"
}

resource "google_service_account_iam_member" "deploy_acts_as" {
  for_each = toset(var.deploy_members)

  service_account_id = google_service_account.agent.name
  role               = "roles/iam.serviceAccountUser"
  member             = each.value
}

locals {
  plain_env = {
    APP_ENV               = var.app_env
    ENVIRONMENT           = var.environment
    TODO_MCP_URL          = var.mcp_endpoint
    GOOGLE_CLOUD_PROJECT  = var.project_id
    GOOGLE_CLOUD_LOCATION = var.region
    # Prefer Vertex ADC over empty API key in container env.
  }
}

resource "google_cloud_run_v2_service" "agent" {
  depends_on = [
    google_artifact_registry_repository_iam_member.agent_reader,
    google_project_iam_member.agent_aiplatform_user,
  ]

  name     = "${var.prefix}-agent"
  location = var.region
  # Only reachable via the HTTPS load balancer (IAP), not the run.app URL.
  ingress = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"
  labels  = var.labels

  deletion_protection = false

  template {
    service_account = google_service_account.agent.email
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
          memory = "1Gi"
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
      scaling,
    ]
  }
}

# IAP service agent invokes Cloud Run on behalf of authenticated users.
resource "google_cloud_run_v2_service_iam_member" "iap_invoker" {
  name     = google_cloud_run_v2_service.agent.name
  location = google_cloud_run_v2_service.agent.location
  role     = "roles/run.invoker"
  member   = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-iap.iam.gserviceaccount.com"
}

# Deploy SA can also invoke for smoke / proxy (optional).
resource "google_cloud_run_v2_service_iam_member" "deploy_invoker" {
  for_each = toset(var.deploy_members)

  name     = google_cloud_run_v2_service.agent.name
  location = google_cloud_run_v2_service.agent.location
  role     = "roles/run.invoker"
  member   = each.value
}

# -----------------------------------------------------------------------------
# External HTTPS load balancer + IAP
# -----------------------------------------------------------------------------

resource "google_compute_region_network_endpoint_group" "agent" {
  name                  = "${var.prefix}-agent-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = google_cloud_run_v2_service.agent.name
  }
}

resource "google_compute_backend_service" "agent" {
  name                  = "${var.prefix}-agent-bes"
  protocol              = "HTTP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  enable_cdn            = false

  backend {
    group = google_compute_region_network_endpoint_group.agent.id
  }

  iap {
    enabled              = true
    oauth2_client_id     = var.iap_oauth_client_id
    oauth2_client_secret = var.iap_oauth_client_secret
  }
}

resource "google_iap_web_backend_service_iam_member" "access" {
  for_each = toset(var.iap_members)

  web_backend_service = google_compute_backend_service.agent.name
  role                = "roles/iap.httpsResourceAccessor"
  member              = each.value
}

resource "google_compute_url_map" "agent" {
  name            = "${var.prefix}-agent-urlmap"
  default_service = google_compute_backend_service.agent.id

  host_rule {
    hosts        = [var.iap_host]
    path_matcher = "agent"
  }

  path_matcher {
    name            = "agent"
    default_service = google_compute_backend_service.agent.id
  }
}

resource "google_compute_managed_ssl_certificate" "agent" {
  name = "${var.prefix}-agent-cert"

  managed {
    domains = [var.iap_host]
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_compute_target_https_proxy" "agent" {
  name             = "${var.prefix}-agent-https"
  url_map          = google_compute_url_map.agent.id
  ssl_certificates = [google_compute_managed_ssl_certificate.agent.id]
}

resource "google_compute_global_address" "agent" {
  name = "${var.prefix}-agent-ip"
}

resource "google_compute_global_forwarding_rule" "agent" {
  name                  = "${var.prefix}-agent-https-fw"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  ip_protocol           = "TCP"
  port_range            = "443"
  target                = google_compute_target_https_proxy.agent.id
  ip_address            = google_compute_global_address.agent.id
}
