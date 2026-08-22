#!/bin/bash
# Database Restore Script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/backup-config.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# List available backups
list_backups() {
    log_info "📋 Available backups:"
    
    if [ "$STORE_IN_S3" = true ]; then
        aws s3 ls "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/" | sort -r
    else
        ls -lh /tmp/${BACKUP_PREFIX}-*.sql.gz 2>/dev/null || echo "No backups found"
    fi
}

# Restore from backup file
restore_from_file() {
    local backup_file="$1"
    local target_db="${2:-$DB_NAME}"
    
    log_info "Starting restore from: $backup_file"
    
    # Check if backup file exists
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    # Check database connection
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT 1" &> /dev/null; then
        log_error "Cannot connect to database. Check your connection settings."
        exit 1
    fi
    
    # Create target database if it doesn't exist
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -lqt | cut -d \| -f 1 | grep -qw "$target_db"; then
        log_info "Creating database: $target_db"
        PGPASSWORD="$DB_PASSWORD" psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d postgres \
            -c "CREATE DATABASE $target_db;"
    fi
    
    # Restore the backup
    gunzip -c "$backup_file" | PGPASSWORD="$DB_PASSWORD" pg_restore \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$target_db" \
        --verbose \
        --clean \
        --if-exists \
        --no-owner \
        --no-privileges
    
    if [ $? -eq 0 ]; then
        log_info "✅ Restore completed successfully!"
        
        # Verify restore
        verify_restore "$target_db"
    else
        log_error "❌ Restore failed"
        exit 1
    fi
}

# Restore from S3
restore_from_s3() {
    local backup_key="$1"
    local target_db="${2:-$DB_NAME}"
    
    log_info "Downloading backup from S3: $backup_key"
    
    BACKUP_FILE="/tmp/$(basename "$backup_key")"
    
    aws s3 cp "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/${backup_key}" "$BACKUP_FILE" \
        --region "$BACKUP_REGION"
    
    if [ $? -eq 0 ]; then
        restore_from_file "$BACKUP_FILE" "$target_db"
        rm -f "$BACKUP_FILE"
    else
        log_error "Failed to download backup from S3"
        exit 1
    fi
}

# Verify restore
verify_restore() {
    local db_name="$1"
    
    log_info "🔍 Verifying restore..."
    
    # Check if tables exist
    local table_count=$(PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$db_name" \
        -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | xargs)
    
    log_info "Found $table_count tables"
    
    # Check if migrations table exists
    if PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$db_name" \
        -c "SELECT 1 FROM schema_migrations LIMIT 1;" &> /dev/null; then
        log_info "✅ Schema migrations table found"
    else
        log_warning "⚠️ Schema migrations table not found"
    fi
    
    # Run a simple query to verify data
    if PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$db_name" \
        -c "SELECT COUNT(*) FROM users LIMIT 1;" &> /dev/null; then
        log_info "✅ Data verification passed"
    else
        log_warning "⚠️ Data verification warning (users table may be empty)"
    fi
    
    log_info "✅ Restore verification complete"
}

# Point-in-Time Recovery
pitr_recovery() {
    local target_time="$1"
    local target_db="${2:-$DB_NAME}"
    
    log_info "⏰ Performing PITR to: $target_time"
    
    # Validate target time
    if ! date -d "$target_time" &> /dev/null; then
        log_error "Invalid time format. Use: 'YYYY-MM-DD HH:MM:SS'"
        exit 1
    fi
    
    # Restore base backup
    local latest_backup=$(aws s3 ls "s3://${BACKUP_BUCKET}/${BACKUP_PREFIX}/" | sort -r | head -1 | awk '{print $4}')
    
    if [ -z "$latest_backup" ]; then
        log_error "No backup found for PITR"
        exit 1
    fi
    
    restore_from_s3 "$latest_backup" "$target_db"
    
    # Apply WAL to reach target time
    log_info "Applying WAL logs to reach target time: $target_time"
    
    # Configure recovery.conf
    cat > /tmp/recovery.conf << EOF
restore_command = 'aws s3 cp s3://${BACKUP_BUCKET}/wal/%f %p'
recovery_target_time = '$target_time'
recovery_target_action = 'promote'
