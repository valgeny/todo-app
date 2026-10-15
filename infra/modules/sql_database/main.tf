# -----------------------------------------------------------------------------
# modules/sql_database — one logical database + user per app env
#
# Created by sandbox / staging / prod applies on an existing instance.
# Fails if the instance does not exist (nonprod must be applied first for
# sandbox/staging).
# -----------------------------------------------------------------------------

resource "random_password" "db" {
  length  = 24
  special = false
}

resource "google_sql_database" "app" {
  name     = var.db_name
  instance = var.instance_name
}

resource "google_sql_user" "app" {
  name     = var.db_user
  instance = var.instance_name
  password = random_password.db.result
}
