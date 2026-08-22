#!/bin/bash
# Database Backup Configuration

export BACKUP_RETENTION_DAYS=30
export BACKUP_SCHEDULE="0 2 * * *"
export BACKUP_BUCKET="fund-my-cause-backups"
export BACKUP_PREFIX="database-backups"
export BACKUP_REGION="us-east-1"

export DB_HOST="${DB_HOST:-localhost}"
export DB_PORT="${DB_PORT:-5432}"
export DB_NAME="${DB_NAME:-fundmycause}"
export DB_USER="${DB_USER:-fundmycause}"
export DB_PASSWORD="${DB_PASSWORD:-}"

export PITR_ENABLED="true"
export PITR_RETENTION_DAYS=7
export WAL_ARCHIVE_ENABLED="true"

export SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
export EMAIL_RECIPIENT="${EMAIL_RECIPIENT:-admin@fund-my-cause.com}"
