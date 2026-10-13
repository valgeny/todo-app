# -----------------------------------------------------------------------------
# moved.tf — State moves from flat resources → modules (no destroy/recreate)
#
# Safe to keep after the first successful apply with modules.
# -----------------------------------------------------------------------------

# project_apis
moved {
  from = google_project_service.apis["run.googleapis.com"]
  to   = module.project_apis.google_project_service.apis["run.googleapis.com"]
}
moved {
  from = google_project_service.apis["artifactregistry.googleapis.com"]
  to   = module.project_apis.google_project_service.apis["artifactregistry.googleapis.com"]
}
moved {
  from = google_project_service.apis["iam.googleapis.com"]
  to   = module.project_apis.google_project_service.apis["iam.googleapis.com"]
}
moved {
  from = google_project_service.apis["cloudbuild.googleapis.com"]
  to   = module.project_apis.google_project_service.apis["cloudbuild.googleapis.com"]
}
moved {
  from = google_project_service.apis["secretmanager.googleapis.com"]
  to   = module.project_apis.google_project_service.apis["secretmanager.googleapis.com"]
}

# artifact_registry
moved {
  from = google_artifact_registry_repository.api
  to   = module.artifact_registry.google_artifact_registry_repository.api
}
moved {
  from = google_artifact_registry_repository_iam_member.cloudrun_agent_reader
  to   = module.artifact_registry.google_artifact_registry_repository_iam_member.cloudrun_agent_reader
}
moved {
  from = data.google_project.current
  to   = module.artifact_registry.data.google_project.current
}

# secrets
moved {
  from = google_secret_manager_secret.app["CORS_ORIGINS"]
  to   = module.secrets.google_secret_manager_secret.app["CORS_ORIGINS"]
}
moved {
  from = google_secret_manager_secret_version.app["CORS_ORIGINS"]
  to   = module.secrets.google_secret_manager_secret_version.app["CORS_ORIGINS"]
}

# apis
moved {
  from = google_service_account.api
  to   = module.apis.google_service_account.api
}
moved {
  from = google_artifact_registry_repository_iam_member.api_reader
  to   = module.apis.google_artifact_registry_repository_iam_member.api_reader
}
moved {
  from = google_secret_manager_secret_iam_member.api_accessor["CORS_ORIGINS"]
  to   = module.apis.google_secret_manager_secret_iam_member.api_accessor["CORS_ORIGINS"]
}
moved {
  from = google_cloud_run_v2_service.api
  to   = module.apis.google_cloud_run_v2_service.api
}
moved {
  from = google_cloud_run_v2_service_iam_member.public
  to   = module.apis.google_cloud_run_v2_service_iam_member.public
}

# frontends (was count on root resources → count on module)
moved {
  from = google_storage_bucket.frontend[0]
  to   = module.frontends[0].google_storage_bucket.frontend
}
moved {
  from = google_storage_bucket_iam_member.frontend_public[0]
  to   = module.frontends[0].google_storage_bucket_iam_member.frontend_public
}

# github_deploy
moved {
  from = google_service_account.github_deploy
  to   = module.github_deploy.google_service_account.github_deploy
}
moved {
  from = google_artifact_registry_repository_iam_member.github_deploy_writer
  to   = module.github_deploy.google_artifact_registry_repository_iam_member.github_deploy_writer
}
moved {
  from = google_project_iam_member.github_deploy_run_admin
  to   = module.github_deploy.google_project_iam_member.github_deploy_run_admin
}
moved {
  from = google_service_account_iam_member.github_deploy_acts_as_api
  to   = module.github_deploy.google_service_account_iam_member.github_deploy_acts_as_api
}
# FE deploy writer: flat → github_deploy → frontends (bucket owns its IAM)
moved {
  from = google_storage_bucket_iam_member.github_deploy_frontend[0]
  to   = module.github_deploy.google_storage_bucket_iam_member.github_deploy_frontend[0]
}

moved {
  from = module.github_deploy.google_storage_bucket_iam_member.github_deploy_frontend[0]
  to   = module.frontends[0].google_storage_bucket_iam_member.deploy_writer["serviceAccount:gh-deploy-sandbox@project-8011a04e-e026-4189-b28.iam.gserviceaccount.com"]
}
