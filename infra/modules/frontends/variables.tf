# -----------------------------------------------------------------------------
# modules/frontends — variables
# -----------------------------------------------------------------------------

variable "bucket_name" {
  type        = string
  description = "Globally unique GCS bucket name."
}

variable "region" {
  type        = string
  description = "Bucket location."
}

variable "labels" {
  type        = map(string)
  description = "Labels applied to the bucket."
  default     = {}
}

variable "deploy_members" {
  type        = list(string)
  description = "IAM members granted roles/storage.objectAdmin on this bucket (e.g. serviceAccount:gh-deploy-…@….iam.gserviceaccount.com)."
  default     = []
}
