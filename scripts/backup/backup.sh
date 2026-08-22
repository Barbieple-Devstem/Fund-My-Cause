#!/bin/bash
# Database Backup Script

set -e

# Source configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/backup-config.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log_info() {
    log "${GREEN}INFO:${NC} $1"
}

log_error() {
    log "${RED}ERROR:${NC} $1"
}

log_warning() {
    log "${YELLOW}WARNING:${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if PostgreSQL tools are installed
    if ! command -v pg_dump &> /dev/null; then
        log_error "pg_dump not found. Please install PostgreSQL client tools."
        exit 1
    fi
    
    if ! command -v psql &> /dev/null; then
        log_error "psql not found. Please install PostgreSQL client tools."
        exit 1
    fi
    
    # Check if AWS CLI is installed for S3 uploads
    if ! command -v aws &> /dev/null; then
        log_warning "AWS CLI not found. Backups will be stored locally only."
        export STORE_IN_S3=false
    else
        export STORE_IN_S3=true
    fi
    
    # Check database connection
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" &> /dev/null; then
        log_error "Cannot connect to database. Check your connection settings."
        exit 1
    fi
    
    log_info "✅ Prerequisites check passed"
}

# Perform full backup
perform_full_backup() {
    log_info "Starting full database backup..."
    
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_FILE="${BACKUP_PREFIX}-${TIMESTAMP}.sql.gz"
    BACKUP_PATH="/tmp/${BACKUP_FILE}"
    
    # Perform pg_dump with compression
    PGPASSWORD="$DB_PASSWORD" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --format=custom \
        --verbose \
        | gzip > "$BACKUP_PATH"
    
    if [ $? -eq 0 ]; then
        log_info "✅ Full backup created: $BACKUP_PATH"
        echo "BACKUP_FILE=$BACKUP_FILE" >> /tmp/backup_metadata
        echo "BACKUP_PATH=$BACKUP_PATH" >> /tmp/backup_metadata
        echo "BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)" >> /tmp/backup_metadata
    else
        log_error "❌ Full backup failed"
        rm -f "$BACKUP_PATH"
        exit 1
    fi
}

# Upload backup to S3
upload_to_s3() {
    if [ "$STORE_IN_S3" = true ]; then
        log_info "Uploading backup to S3..."
        
        # Upload to S3
        aws s3 cp "$BACKUP_PATH" "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/${BACKUP_FILE}" \
            --region "$BACKUP_REGION" \
            --storage-class STANDARD_IA
        
        if [ $? -eq 0 ]; then
            log_info "✅ Backup uploaded to S3: s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/${BACKUP_FILE}"
            echo "S3_URL=s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/${BACKUP_FILE}" >> /tmp/backup_metadata
        else
            log_error "❌ Failed to upload backup to S3"
        fi
    else
        log_warning "Skipping S3 upload (AWS CLI not available)"
    fi
}

# Perform WAL archiving for PITR
perform_wal_archive() {
    if [ "$PITR_ENABLED" = true ]; then
        log_info "Archiving WAL files..."
        
        # Archive WAL files
        PGPASSWORD="$DB_PASSWORD" psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -c "SELECT pg_switch_wal();" \
            &> /dev/null
        
        if [ $? -eq 0 ]; then
            log_info "✅ WAL files archived"
        else
            log_warning "⚠️ WAL archiving failed"
        fi
    fi
}

# Clean up old backups
cleanup_old_backups() {
    log_info "Cleaning up backups older than ${BACKUP_RETENTION_DAYS} days..."
    
    if [ "$STORE_IN_S3" = true ]; then
        # Delete old backups from S3
        aws s3 ls "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/" | while read -r line; do
            FILE_DATE=$(echo "$line" | awk '{print $1}')
            FILE_DAYS_OLD=$(($(date +%s) - $(date -d "$FILE_DATE" +%s) / 86400))
            
            if [ $FILE_DAYS_OLD -gt $BACKUP_RETENTION_DAYS ]; then
                FILE_NAME=$(echo "$line" | awk '{print $4}')
                aws s3 rm "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/${FILE_NAME}"
                log_info "Deleted old backup: $FILE_NAME"
            fi
        done
    fi
    
    # Clean up local backups
    find /tmp -name "${BACKUP_PREFIX}-*.sql.gz" -mtime +"${BACKUP_RETENTION_DAYS}" -delete
}

# Send notification
send_notification() {
    local status="$1"
    local message="$2"
    
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"[$status] Database Backup: $message\"}" \
            "$SLACK_WEBHOOK_URL" 2>/dev/null || true
    fi
    
    # Email notification if configured
    if [ -n "$EMAIL_RECIPIENT" ]; then
        echo "$message" | mail -s "[$status] Database Backup" "$EMAIL_RECIPIENT" 2>/dev/null || true
    fi
}

# Main execution
main() {
    log_info "🚀 Starting database backup process..."
    
    check_prerequisites
    
    # Create backup directory
    mkdir -p /tmp/backups
    
    # Perform backup
    perform_full_backup
    
    # Upload to S3
    upload_to_s3
    
    # Archive WAL
    perform_wal_archive
    
    # Clean up old backups
    cleanup_old_backups
    
    # Send success notification
    send_notification "SUCCESS" "Database backup completed successfully. Backup: ${BACKUP_FILE}"
    
    log_info "✅ Backup process completed!"
    
    # Print backup metadata
    if [ -f /tmp/backup_metadata ]; then
        log_info "📋 Backup metadata:"
        cat /tmp/backup_metadata
        rm -f /tmp/backup_metadata
    fi
}

main
