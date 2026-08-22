variable "ecr_repository_url" {
  description = "ECR repository URL"
  type        = string
}

variable "database_password_secret_arn" {
  description = "Database password secret ARN"
  type        = string
}

variable "jwt_secret" {
  description = "JWT secret"
  type        = string
  sensitive   = true
}

variable "jwt_secret_arn" {
  description = "JWT secret ARN"
  type        = string
}

variable "redis_url" {
  description = "Redis URL"
  type        = string
  sensitive   = true
}
