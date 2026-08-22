# Indexer Module - ECS Service

resource "aws_ecs_task_definition" "indexer" {
  family                   = "${var.environment}-indexer"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name  = "indexer"
      image = var.image_url
      
      portMappings = [
        {
          containerPort = 3001
          protocol      = "tcp"
        }
      ]
      
      environment = [
        { name = "NODE_ENV", value = var.environment },
        { name = "PORT", value = "3001" },
        { name = "DATABASE_URL", value = var.database_connection_string },
        { name = "REDIS_URL", value = var.redis_url },
        { name = "STELLAR_RPC_URL", value = var.stellar_rpc_url },
        { name = "NETWORK", value = var.network },
      ]
      
      secrets = [
        { name = "DATABASE_PASSWORD", valueFrom = var.database_password_secret_arn },
      ]
      
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/${var.environment}-indexer"
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "indexer"
        }
      }
      
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:3001/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 10
      }
    }
  ])
}

resource "aws_ecs_service" "indexer" {
  name            = "${var.environment}-indexer"
  cluster         = var.cluster_id
  task_definition = aws_ecs_task_definition.indexer.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.subnet_ids
    security_groups  = [var.security_group_id]
    assign_public_ip = false
  }

  depends_on = [aws_ecs_task_definition.indexer]
}

resource "aws_cloudwatch_log_group" "indexer" {
  name              = "/ecs/${var.environment}-indexer"
  retention_in_days = 30

  tags = {
    Name        = "${var.environment}-indexer-logs"
    Environment = var.environment
    Project     = var.project_name
  }
}
