variable "environment" {
  description = "Environment name"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "fund-my-cause"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "image_url" {
  description = "Indexer image URL"
  type        = string
}

variable "cpu" {
  description = "CPU units"
  type        = string
  default     = "256"
}

variable "memory" {
  description = "Memory in MB"
  type        = string
  default     = "512"
}

variable "desired_count" {
  description = "Desired number of tasks"
  type        = number
  default     = 1
}

variable "subnet_ids" {
  description = "Subnet IDs"
  type        = list(string)
}

variable "security_group_id" {
  description = "Security group ID"
  type        = string
}

variable "cluster_id" {
  description = "ECS cluster ID"
  type        = string
}

variable "execution_role_arn" {
  description = "ECS execution role ARN"
  type        = string
}

variable "task_role_arn" {
  description = "ECS task role ARN"
  type        = string
}

variable "database_connection_string" {
  description = "Database connection string"
  type        = string
  sensitive   = true
}

variable "database_password_secret_arn" {
  description = "Database password secret ARN"
  type        = string
}

variable "redis_url" {
  description = "Redis URL"
  type        = string
  sensitive   = true
}

variable "stellar_rpc_url" {
  description = "Stellar RPC URL"
  type        = string
  default     = "https://soroban-testnet.stellar.org"
}

variable "network" {
  description = "Stellar network"
  type        = string
  default     = "testnet"
}
