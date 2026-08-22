# API Module - ECS Service

resource "aws_ecs_task_definition" "api" {
  family                   = "${var.environment}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name  = "api"
      image = var.image_url
      
      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]
      
      environment = [
        { name = "NODE_ENV", value = var.environment },
        { name = "PORT", value = "3000" },
        { name = "DATABASE_URL", value = var.database_connection_string },
        { name = "REDIS_URL", value = var.redis_url },
        { name = "JWT_SECRET", value = var.jwt_secret },
        { name = "INDEXER_URL", value = var.indexer_url },
      ]
      
      secrets = [
        { name = "DATABASE_PASSWORD", valueFrom = var.database_password_secret_arn },
        { name = "JWT_SECRET", valueFrom = var.jwt_secret_arn },
      ]
      
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/${var.environment}-api"
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "api"
        }
      }
      
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 10
      }
    }
  ])
}

resource "aws_ecs_service" "api" {
  name            = "${var.environment}-api"
  cluster         = var.cluster_id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [var.security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = "api"
    container_port   = 3000
  }

  depends_on = [aws_ecs_task_definition.api]
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.environment}-api"
  retention_in_days = 30

  tags = {
    Name        = "${var.environment}-api-logs"
    Environment = var.environment
    Project     = var.project_name
  }
}
