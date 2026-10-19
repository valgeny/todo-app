# -----------------------------------------------------------------------------
# modules/agent — LangGraph API + CopilotKit UI behind HTTPS LB + IAP
#
# Access: browser Google login via IAP → LB → Cloud Run (not public run.app).
# Runtime uses Vertex ADC (roles/aiplatform.user) + TODO_MCP_URL.
# LangGraph API needs Redis + Postgres — sandbox uses Cloud Run sidecars.
#
# UI (ui_host + ui_image): same LB IP + IAP, host ui.* serves CopilotKit.
# Browser ↔ ui only; Next.js runtime → agent Cloud Run with ID token (IAM).
# -----------------------------------------------------------------------------

locals {
  cert_hosts       = sort([var.iap_host, var.ui_host])
  cert_fingerprint = substr(md5(join(",", local.cert_hosts)), 0, 8)
}

data "google_project" "current" {
  project_id = var.project_id
}

# IAP service agent is created asynchronously; ensure it exists before IAM bind.
resource "google_project_service_identity" "iap" {
  provider = google-beta
  project  = var.project_id
  service  = "iap.googleapis.com"
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
    # LangGraph API requires Redis + Postgres (sidecars share localhost).
    REDIS_URI    = "redis://127.0.0.1:6379"
    POSTGRES_URI = "postgres://postgres:postgres@127.0.0.1:5432/postgres?sslmode=disable"
  }
}

resource "google_secret_manager_secret_iam_member" "agent_accessor" {
  for_each = var.secret_resources

  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.agent.email}"
}

resource "google_cloud_run_v2_service" "agent" {
  depends_on = [
    google_artifact_registry_repository_iam_member.agent_reader,
    google_project_iam_member.agent_aiplatform_user,
    google_secret_manager_secret_iam_member.agent_accessor,
  ]

  name     = "${var.prefix}-agent"
  location = var.region
  # ALL + IAM (no allUsers): IAP LB for browsers; UI Cloud Run invokes via ID token.
  ingress = "INGRESS_TRAFFIC_ALL"
  labels  = var.labels

  deletion_protection = false

  template {
    service_account = google_service_account.agent.email
    labels          = var.labels

    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }

    # LangGraph API (ingress)
    containers {
      name  = "agent"
      image = var.image

      depends_on = ["redis", "postgres"]

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

      dynamic "env" {
        for_each = var.secret_resources
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value.secret_id
              version = "latest"
            }
          }
        }
      }

      startup_probe {
        tcp_socket {
          port = var.port
        }
        initial_delay_seconds = 15
        timeout_seconds       = 5
        period_seconds        = 5
        failure_threshold     = 24
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
        cpu_idle = true
      }
    }

    # Ephemeral Redis (sandbox; lost on scale-to-zero).
    containers {
      name  = "redis"
      image = "redis:6-alpine"

      resources {
        limits = {
          cpu    = "0.5"
          memory = "256Mi"
        }
        cpu_idle = true
      }

      startup_probe {
        tcp_socket {
          port = 6379
        }
        failure_threshold = 12
        period_seconds    = 5
      }
    }

    # Ephemeral Postgres for LangGraph checkpoints (sandbox).
    containers {
      name  = "postgres"
      image = "postgres:15-alpine"

      env {
        name  = "POSTGRES_PASSWORD"
        value = "postgres"
      }

      resources {
        limits = {
          cpu    = "0.5"
          memory = "512Mi"
        }
        cpu_idle = true
      }

      startup_probe {
        tcp_socket {
          port = 5432
        }
        failure_threshold = 12
        period_seconds    = 5
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
  depends_on = [google_project_service_identity.iap]

  name     = google_cloud_run_v2_service.agent.name
  location = google_cloud_run_v2_service.agent.location
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_project_service_identity.iap.email}"
}

# Deploy SA can also invoke for smoke / proxy (optional).
resource "google_cloud_run_v2_service_iam_member" "deploy_invoker" {
  for_each = toset(var.deploy_members)

  name     = google_cloud_run_v2_service.agent.name
  location = google_cloud_run_v2_service.agent.location
  role     = "roles/run.invoker"
  member   = each.value
}

# CopilotKit UI runtime calls Agent Server with a Google ID token.
resource "google_cloud_run_v2_service_iam_member" "ui_invokes_agent" {
  name     = google_cloud_run_v2_service.agent.name
  location = google_cloud_run_v2_service.agent.location
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.agent_ui.email}"
}

# -----------------------------------------------------------------------------
# CopilotKit agent-ui (Cloud Run)
# -----------------------------------------------------------------------------

resource "google_service_account" "agent_ui" {
  account_id   = "${var.prefix}-agent-ui"
  display_name = "Todo agent Chat UI (${var.environment})"
}

resource "google_artifact_registry_repository_iam_member" "agent_ui_reader" {
  location   = var.artifact_registry_location
  repository = var.artifact_registry_name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.agent_ui.email}"
}

resource "google_service_account_iam_member" "deploy_acts_as_ui" {
  for_each = toset(var.deploy_members)

  service_account_id = google_service_account.agent_ui.name
  role               = "roles/iam.serviceAccountUser"
  member             = each.value
}

resource "google_cloud_run_v2_service" "agent_ui" {
  depends_on = [google_artifact_registry_repository_iam_member.agent_ui_reader]

  name     = "${var.prefix}-agent-ui"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"
  labels   = var.labels

  deletion_protection = false

  template {
    service_account = google_service_account.agent_ui.email
    labels          = var.labels

    scaling {
      min_instance_count = 0
      max_instance_count = 2
    }

    containers {
      name  = "agent-ui"
      image = var.ui_image

      ports {
        container_port = var.port
      }

      # CopilotKit runtime (server-side) → Agent Server Cloud Run URL + ID token.
      env {
        name  = "LANGGRAPH_URL"
        value = google_cloud_run_v2_service.agent.uri
      }
      env {
        name  = "LANGGRAPH_GRAPH_ID"
        value = var.ui_assistant_id
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "1Gi"
        }
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

resource "google_cloud_run_v2_service_iam_member" "iap_invoker_ui" {
  depends_on = [google_project_service_identity.iap]

  name     = google_cloud_run_v2_service.agent_ui.name
  location = google_cloud_run_v2_service.agent_ui.location
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_project_service_identity.iap.email}"
}

resource "google_cloud_run_v2_service_iam_member" "deploy_invoker_ui" {
  for_each = toset(var.deploy_members)

  name     = google_cloud_run_v2_service.agent_ui.name
  location = google_cloud_run_v2_service.agent_ui.location
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

resource "google_compute_region_network_endpoint_group" "agent_ui" {
  name                  = "${var.prefix}-agent-ui-neg"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = google_cloud_run_v2_service.agent_ui.name
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

resource "google_compute_backend_service" "agent_ui" {
  name                  = "${var.prefix}-agent-ui-bes"
  protocol              = "HTTP"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  enable_cdn            = false

  backend {
    group = google_compute_region_network_endpoint_group.agent_ui.id
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

resource "google_iap_web_backend_service_iam_member" "access_ui" {
  for_each = toset(var.iap_members)

  web_backend_service = google_compute_backend_service.agent_ui.name
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

  host_rule {
    hosts        = [var.ui_host]
    path_matcher = "ui"
  }

  path_matcher {
    name            = "agent"
    default_service = google_compute_backend_service.agent.id
  }

  path_matcher {
    name            = "ui"
    default_service = google_compute_backend_service.agent_ui.id
  }
}

resource "google_compute_managed_ssl_certificate" "agent" {
  # name_prefix so -replace / recreate always gets a unique name (same domains).
  name_prefix = "${var.prefix}-agent-cert-${local.cert_fingerprint}-"

  managed {
    domains = local.cert_hosts
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
