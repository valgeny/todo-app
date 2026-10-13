# -----------------------------------------------------------------------------
# versions.tf — Terraform & provider constraints + local state backend
#
# State lives on disk (`terraform.tfstate`). Do not commit *.tfstate.
# Apply with an env var-file, e.g.:
#   terraform apply -var-file=envs/sandbox.tfvars
# See README.md for environments, secrets, and CI deploy SA key setup.
# -----------------------------------------------------------------------------

terraform {
  required_version = ">= 1.5.0"

  # Local backend (state file on disk). Do not commit *.tfstate.
  backend "local" {
    path = "terraform.tfstate"
  }

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}
