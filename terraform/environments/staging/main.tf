terraform {
  backend "s3" {
    bucket         = "fund-my-cause-terraform-state"
    key            = "staging/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

provider "aws" {
  region = "us-east-1"
}

locals {
  environment = "staging"
  project     = "fund-my-cause"
}

# Network configuration (using existing VPC)
data "aws_vpc" "main" {
  tags = {
    Environment = local.environment
    Project     = local.project
  }
}

data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.main.id]
  }
  tags = {
    Type = "private"
  }
}

data "aws_security_groups" "app" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.main.id]
  }
  tags = {
    Type = "app"
  }
}

data "aws_ecs_cluster" "main" {
  cluster_name = "${local.environment}-cluster"
}

data "aws_iam_role" "ecs_execution" {
  name = "ecs-execution-role"
}

data "aws_iam_role" "ecs_task" {
  name = "ecs-task-role"
}

data "aws_lb_target_group" "api" {
  name = "${local.environment}-api-tg"
}

# Database module
module "database" {
  source = "../../modules/database"

  environment       = local.environment
  project_name      = local.project
  subnet_ids        = data.aws_subnets.private.ids
  security_group_id = data.aws_security_groups.app.ids[0]
  instance_class    = "db.t3.micro"
  allocated_storage = 20
  deletion_protection = false
  skip_final_snapshot = true
}

# API module
module "api" {
  source = "../../modules/api"

  environment       = local.environment
  project_name      = local.project
  image_url         = "${var.ecr_repository_url}:staging"
  subnet_ids        = data.aws_subnets.private.ids
  security_group_id = data.aws_security_groups.app.ids[0]
  cluster_id        = data.aws_ecs_cluster.main.id
  execution_role_arn = data.aws_iam_role.ecs_execution.arn
  task_role_arn      = data.aws_iam_role.ecs_task.arn
  target_group_arn   = data.aws_lb_target_group.api.arn
  desired_count      = 1

  database_connection_string = module.database.database_connection_string
  database_password_secret_arn = var.database_password_secret_arn
  jwt_secret = var.jwt_secret
  jwt_secret_arn = var.jwt_secret_arn
  redis_url = var.redis_url
  indexer_url = "http://indexer:3001"
}

# Indexer module
module "indexer" {
  source = "../../modules/indexer"

  environment       = local.environment
  project_name      = local.project
  image_url         = "${var.ecr_repository_url}:staging"
  subnet_ids        = data.aws_subnets.private.ids
  security_group_id = data.aws_security_groups.app.ids[0]
  cluster_id        = data.aws_ecs_cluster.main.id
  execution_role_arn = data.aws_iam_role.ecs_execution.arn
  task_role_arn      = data.aws_iam_role.ecs_task.arn
  desired_count      = 1

  database_connection_string = module.database.database_connection_string
  database_password_secret_arn = var.database_password_secret_arn
  redis_url = var.redis_url
}
