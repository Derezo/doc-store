#!/bin/bash

################################################################################
# Production Deployment Script for doc-store
#
# Deploys doc-store from local machine to production VPS via SSH.
# Builds locally, creates a compressed archive, and transfers via scp.
#
# Features:
# - Local build and archive creation (no build tools needed on VPS)
# - Compressed transfer via scp
# - SSH-based deployment to mittonvillage.com
# - PM2 process management (API + Web) with graceful reload
# - Nginx reverse proxy configuration (idempotent)
# - SSL/TLS certificate setup via Let's Encrypt (idempotent)
# - PostgreSQL database setup and Drizzle migrations
# - Pre-deployment validation and backups (app + database)
# - Health check verification with automatic rollback
# - Deployment locking (prevent concurrent deploys)
# - Dry-run mode for previewing changes
#
# Usage: ./scripts/deploy-production.sh [options]
#   --skip-backup     Skip pre-deployment backup
#   --skip-nginx      Skip Nginx configuration deployment
#   --skip-ssl        Skip SSL certificate setup
#   --skip-tests      Skip pre-deployment test suite
#   --skip-db         Skip database setup (user/db creation)
#   --force           Force deployment even if tests fail
#   --dry-run         Show what would be changed without making changes
#   --help            Show this help message
#
# Environment: Deploys to production VPS with PM2, Nginx, PostgreSQL
################################################################################

set -e
set -o pipefail

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly CYAN='\033[0;36m'
readonly BOLD='\033[1m'
readonly NC='\033[0m'

# Get the real user's home directory (handles sudo properly)
if [ -n "$SUDO_USER" ]; then
    REAL_USER="$SUDO_USER"
    REAL_HOME=$(getent passwd "$SUDO_USER" | cut -d: -f6)
else
    REAL_USER="$USER"
    REAL_HOME="$HOME"
fi

# Remote server configuration
REMOTE_HOST="${REMOTE_HOST:-mittonvillage.com}"
REMOTE_USER="${REMOTE_USER:-root}"
SSH_KEY="${SSH_KEY:-$REAL_HOME/.ssh/id_ed25519}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/var/www/doc-store}"
PM2_API_NAME="${PM2_API_NAME:-doc-store-api}"
PM2_WEB_NAME="${PM2_WEB_NAME:-doc-store-web}"
DOMAIN="${DOMAIN:-vault.mittonvillage.com}"

# Script configuration
SKIP_BACKUP=false
SKIP_NGINX=false
SKIP_SSL=false
SKIP_TESTS=false
SKIP_DB=false
FORCE_DEPLOY=false
DRY_RUN=false
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"
LOG_FILE="$LOG_DIR/deploy-$(date +%Y%m%d-%H%M%S).log"
LOCK_FILE="/tmp/doc-store-deploy.lock"

# Deployment package configuration
DEPLOY_PACKAGE_NAME="doc-store-deploy.tar.gz"
DEPLOY_PACKAGE_PATH="/tmp/$DEPLOY_PACKAGE_NAME"

# Parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-backup)
                SKIP_BACKUP=true
                shift
                ;;
            --skip-nginx)
                SKIP_NGINX=true
                shift
                ;;
            --skip-ssl)
                SKIP_SSL=true
                shift
                ;;
            --skip-tests)
                SKIP_TESTS=true
                shift
                ;;
            --skip-db)
                SKIP_DB=true
                shift
                ;;
            --force)
                FORCE_DEPLOY=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo ""
                echo "Deploys doc-store from local machine to production VPS via SSH."
                echo "Builds locally, creates a compressed archive, and transfers via scp."
                echo ""
                echo "Options:"
                echo "  --skip-backup   Skip pre-deployment backup"
                echo "  --skip-tests    Skip pre-deployment test suite"
                echo "  --skip-nginx    Skip Nginx configuration deployment"
                echo "  --skip-ssl      Skip SSL certificate setup"
                echo "  --skip-db       Skip database setup (user/db creation)"
                echo "  --force         Force deployment even if tests fail"
                echo "  --dry-run       Show what would be changed without making changes"
                echo "  --help          Show this help message"
                echo ""
                echo "Configuration (can be set via environment variables):"
                echo "  REMOTE_HOST:    $REMOTE_HOST"
                echo "  REMOTE_USER:    $REMOTE_USER"
                echo "  REMOTE_APP_DIR: $REMOTE_APP_DIR"
                echo "  SSH_KEY:        $SSH_KEY"
                echo "  DOMAIN:         $DOMAIN"
                echo ""
                echo "Example:"
                echo "  $0                                    # Full deployment"
                echo "  $0 --skip-nginx --skip-ssl            # Deploy code only"
                echo "  $0 --skip-ssl                         # First deploy (SSL after DNS)"
                echo "  $0 --dry-run                          # Preview changes"
                exit 0
                ;;
            *)
                echo -e "${RED}Unknown option: $1${NC}"
                exit 1
                ;;
        esac
    done
}

# ── Logging functions ────────────────────────────────────────────────

log() {
    mkdir -p "$LOG_DIR"
    echo -e "$1" | tee -a "$LOG_FILE"
}

log_step() {
    log "\n${BLUE}==>${BOLD} $1${NC}"
}

log_success() {
    log "${GREEN}✓ $1${NC}"
}

log_warning() {
    log "${YELLOW}⚠  $1${NC}"
}

log_error() {
    log "${RED}✗ $1${NC}"
}

log_info() {
    log "${CYAN}ℹ  $1${NC}"
}

log_dry_run() {
    log "${YELLOW}[DRY-RUN]${NC} $1"
}

# ── Lock management ─────────────────────────────────────────────────

acquire_lock() {
    if [ -f "$LOCK_FILE" ]; then
        local lock_pid
        lock_pid=$(cat "$LOCK_FILE" 2>/dev/null)
        if kill -0 "$lock_pid" 2>/dev/null; then
            log_error "Another deployment is in progress (PID: $lock_pid)"
            log_info "If this is stale, remove: $LOCK_FILE"
            exit 1
        else
            log_warning "Removing stale lock file from PID $lock_pid"
            rm -f "$LOCK_FILE"
        fi
    fi
    echo $$ > "$LOCK_FILE"
    log_success "Deployment lock acquired"
}

release_lock() {
    rm -f "$LOCK_FILE" 2>/dev/null || true
}

# ── Cleanup ──────────────────────────────────────────────────────────

cleanup() {
    if [ -f "$DEPLOY_PACKAGE_PATH" ]; then
        rm -f "$DEPLOY_PACKAGE_PATH"
        log_info "Cleaned up local deployment package"
    fi
    release_lock
}

# ── SSH/SCP helpers ──────────────────────────────────────────────────

ssh_exec() {
    ssh -i "$SSH_KEY" \
        -o StrictHostKeyChecking=yes \
        -o ConnectTimeout=30 \
        -o ServerAliveInterval=10 \
        -o BatchMode=yes \
        "$REMOTE_USER@$REMOTE_HOST" "$@"
}

scp_to() {
    scp -i "$SSH_KEY" \
        -o StrictHostKeyChecking=yes \
        -o ConnectTimeout=30 \
        "$1" "$REMOTE_USER@$REMOTE_HOST:$2"
}

# ── SSH initialization ──────────────────────────────────────────────

init_ssh_known_hosts() {
    if ! ssh-keygen -F "$REMOTE_HOST" &>/dev/null; then
        log_info "Adding $REMOTE_HOST to known_hosts..."
        ssh-keyscan -H "$REMOTE_HOST" >> "$REAL_HOME/.ssh/known_hosts" 2>/dev/null
        log_success "Host key added to known_hosts"
    fi
}

check_ssh_connectivity() {
    log_step "Checking SSH connectivity"

    if $DRY_RUN; then
        log_dry_run "Would test SSH connection to $REMOTE_USER@$REMOTE_HOST"
        return
    fi

    if ssh_exec "echo 'SSH connection successful'" &> /dev/null; then
        log_success "SSH connection to $REMOTE_HOST verified"
    else
        log_error "Cannot connect to $REMOTE_HOST via SSH"
        exit 1
    fi
}

# ── Local prerequisites ─────────────────────────────────────────────

check_local_prerequisites() {
    log_step "Checking local prerequisites"

    local has_errors=false

    # Check node
    if ! command -v node &> /dev/null; then
        log_error "node is not installed"
        has_errors=true
    else
        local node_version
        node_version=$(node --version)
        log_success "node is installed ($node_version)"
    fi

    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed"
        has_errors=true
    else
        log_success "npm is installed"
    fi

    # Check tar
    if ! command -v tar &> /dev/null; then
        log_error "tar is not installed"
        has_errors=true
    else
        log_success "tar is installed"
    fi

    # Check SSH key
    if [ ! -f "$SSH_KEY" ]; then
        log_error "SSH key not found: $SSH_KEY"
        has_errors=true
    else
        log_success "SSH key found: $SSH_KEY"
    fi

    # Check .env.production exists
    if [ ! -f "$PROJECT_ROOT/.env.production" ]; then
        log_error ".env.production not found (copy .env.example and configure)"
        has_errors=true
    else
        log_success ".env.production found"

        # Check NEXT_PUBLIC_API_URL is set
        if ! grep -q "NEXT_PUBLIC_API_URL" "$PROJECT_ROOT/.env.production"; then
            log_error ".env.production missing NEXT_PUBLIC_API_URL (required for Next.js build)"
            has_errors=true
        else
            log_success "NEXT_PUBLIC_API_URL configured"
        fi
    fi

    # Check ecosystem.config.cjs exists
    if [ ! -f "$PROJECT_ROOT/ecosystem.config.cjs" ]; then
        log_error "ecosystem.config.cjs not found"
        has_errors=true
    else
        log_success "ecosystem.config.cjs found"
    fi

    # Check all workspace package.json files
    local workspaces=("packages/shared" "packages/api" "packages/web")
    for ws in "${workspaces[@]}"; do
        if [ ! -f "$PROJECT_ROOT/$ws/package.json" ]; then
            log_error "Missing $ws/package.json"
            has_errors=true
        else
            log_success "$ws/package.json found"
        fi
    done

    if [ "$has_errors" = true ]; then
        log_error "Prerequisites check failed"
        exit 1
    fi
}

# ── Pre-deployment validation ────────────────────────────────────────

run_pre_deployment_validation() {
    log_step "Running pre-deployment validation"

    if [ "$SKIP_TESTS" = true ]; then
        log_info "Skipping tests (--skip-tests)"
        return
    fi

    if $DRY_RUN; then
        log_dry_run "Would run test suite"
        return
    fi

    log_info "Running test suite..."
    if ! (cd "$PROJECT_ROOT" && npm test 2>&1 | tee -a "$LOG_FILE"); then
        log_error "Tests failed"
        if [ "$FORCE_DEPLOY" = false ]; then
            exit 1
        fi
        log_warning "Continuing despite test failure (--force)"
    else
        log_success "Tests passed"
    fi
}

# ── Build locally ────────────────────────────────────────────────────

build_locally() {
    log_step "Building application locally"

    if $DRY_RUN; then
        log_dry_run "Would build all packages (shared → api → web)"
        return
    fi

    # Source .env.production so NEXT_PUBLIC_API_URL is available for Next.js build
    log_info "Loading .env.production for build..."
    set -a
    source "$PROJECT_ROOT/.env.production"
    set +a

    log_info "Building all packages..."
    if ! (cd "$PROJECT_ROOT" && npm run build 2>&1 | tee -a "$LOG_FILE"); then
        log_error "Build failed"
        exit 1
    fi

    # Verify build outputs
    local build_errors=false

    if [ ! -f "$PROJECT_ROOT/packages/shared/dist/index.js" ]; then
        log_error "Missing build output: packages/shared/dist/index.js"
        build_errors=true
    else
        log_success "Shared package built"
    fi

    if [ ! -f "$PROJECT_ROOT/packages/api/dist/index.js" ]; then
        log_error "Missing build output: packages/api/dist/index.js"
        build_errors=true
    else
        log_success "API package built"
    fi

    if [ ! -f "$PROJECT_ROOT/packages/web/.next/BUILD_ID" ]; then
        log_error "Missing build output: packages/web/.next/BUILD_ID"
        build_errors=true
    else
        log_success "Web package built"
    fi

    if [ "$build_errors" = true ]; then
        log_error "Build verification failed"
        exit 1
    fi

    log_success "All packages built successfully"
}

# ── Remote prerequisites ─────────────────────────────────────────────

check_remote_prerequisites() {
    log_step "Checking remote prerequisites"

    if $DRY_RUN; then
        log_dry_run "Would check remote prerequisites (node, npm, pm2, nginx, certbot, psql)"
        return
    fi

    # Check Node.js
    if ssh_exec "command -v node" &> /dev/null; then
        local node_version
        node_version=$(ssh_exec "node --version")
        log_success "Remote node: $node_version"
    else
        log_error "node is not installed on remote server"
        exit 1
    fi

    # Check npm
    if ssh_exec "command -v npm" &> /dev/null; then
        log_success "Remote npm installed"
    else
        log_error "npm is not installed on remote server"
        exit 1
    fi

    # Check PM2
    if ssh_exec "command -v pm2" &> /dev/null; then
        log_success "Remote pm2 installed"
    else
        log_warning "pm2 not found, installing..."
        ssh_exec "npm install -g pm2"
        log_success "pm2 installed globally"
    fi

    # Check Nginx
    if ssh_exec "command -v nginx" &> /dev/null; then
        log_success "Remote nginx installed"
    else
        log_error "nginx is not installed on remote server"
        exit 1
    fi

    # Check certbot (only if SSL not skipped)
    if [ "$SKIP_SSL" = false ]; then
        if ssh_exec "command -v certbot" &> /dev/null; then
            log_success "Remote certbot installed"
        else
            log_warning "certbot not found, SSL setup will be skipped"
            SKIP_SSL=true
        fi
    fi

    # Check psql (needed for database setup)
    if [ "$SKIP_DB" = false ]; then
        if ssh_exec "command -v psql" &> /dev/null; then
            log_success "Remote psql installed"
        else
            log_error "psql is not installed on remote server"
            log_info "Install with: apt install postgresql-client"
            exit 1
        fi
    fi
}

# ── Remote backup ────────────────────────────────────────────────────

create_remote_backup() {
    log_step "Creating remote backup"

    if [ "$SKIP_BACKUP" = true ]; then
        log_info "Skipping backup (--skip-backup)"
        return
    fi

    if $DRY_RUN; then
        log_dry_run "Would create backup of $REMOTE_APP_DIR and database"
        return
    fi

    local backup_dir="/var/backups/doc-store"
    local timestamp
    timestamp=$(date +%Y%m%d-%H%M%S)

    # App backup
    if ssh_exec "[ -d $REMOTE_APP_DIR ]"; then
        ssh_exec "mkdir -p $backup_dir"
        ssh_exec "cd $REMOTE_APP_DIR && tar -czf $backup_dir/backup-$timestamp.tar.gz \
            --exclude='node_modules' \
            --exclude='logs' \
            --exclude='.next/cache' \
            ."
        log_success "App backup created: $backup_dir/backup-$timestamp.tar.gz"
    else
        log_info "No existing deployment to backup"
    fi

    # Database backup
    if ssh_exec "[ -f $REMOTE_APP_DIR/.env ]"; then
        local db_url
        db_url=$(ssh_exec "grep '^DATABASE_URL=' $REMOTE_APP_DIR/.env | cut -d= -f2-")
        if [ -n "$db_url" ]; then
            ssh_exec "pg_dump '$db_url' 2>/dev/null | gzip > $backup_dir/database-$timestamp.sql.gz" || \
                log_warning "Database backup failed (database may not exist yet)"
            if ssh_exec "[ -f $backup_dir/database-$timestamp.sql.gz ]"; then
                log_success "Database backup created: $backup_dir/database-$timestamp.sql.gz"
            fi
        fi
    else
        log_info "No .env file on remote, skipping database backup"
    fi

    # Keep only last 5 backups
    ssh_exec "cd $backup_dir && ls -t backup-*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm -- 2>/dev/null || true"
    ssh_exec "cd $backup_dir && ls -t database-*.sql.gz 2>/dev/null | tail -n +6 | xargs -r rm -- 2>/dev/null || true"
    log_info "Old backups cleaned up (keeping last 5)"
}

# ── Create deployment package ────────────────────────────────────────

create_deploy_package() {
    log_step "Creating deployment package"

    if $DRY_RUN; then
        log_dry_run "Would create deployment package at $DEPLOY_PACKAGE_PATH"
        return
    fi

    rm -f "$DEPLOY_PACKAGE_PATH"

    log_info "Packaging built artifacts..."

    # Create a manifest of files to include
    local tmp_filelist
    tmp_filelist=$(mktemp)

    cat > "$tmp_filelist" << 'FILELIST'
packages/shared/dist/
packages/shared/package.json
packages/api/dist/
packages/api/package.json
packages/api/drizzle/
packages/api/drizzle.config.ts
packages/web/.next/
packages/web/package.json
packages/web/next.config.mjs
package.json
package-lock.json
ecosystem.config.cjs
FILELIST

    tar -czf "$DEPLOY_PACKAGE_PATH" \
        -C "$PROJECT_ROOT" \
        --exclude='node_modules' \
        --exclude='.next/cache' \
        --exclude='.git' \
        --exclude='.env*' \
        --exclude='src/' \
        --exclude='*.test.*' \
        --exclude='*.spec.*' \
        --exclude='__tests__' \
        --exclude='coverage' \
        --exclude='logs' \
        --exclude='data' \
        --exclude='.claude' \
        --files-from="$tmp_filelist"

    rm -f "$tmp_filelist"

    local package_size
    package_size=$(du -h "$DEPLOY_PACKAGE_PATH" | cut -f1)
    log_success "Deployment package created: $package_size"
}

# ── Transfer and extract ─────────────────────────────────────────────

transfer_and_extract() {
    log_step "Transferring to remote server"

    if $DRY_RUN; then
        log_dry_run "Would transfer package to $REMOTE_HOST and extract to $REMOTE_APP_DIR"
        return
    fi

    # Create remote directories
    ssh_exec "mkdir -p $REMOTE_APP_DIR"
    ssh_exec "mkdir -p $REMOTE_APP_DIR/logs"

    # Stop PM2 processes before extraction
    if ssh_exec "pm2 describe $PM2_API_NAME &> /dev/null" 2>/dev/null; then
        log_info "Stopping $PM2_API_NAME..."
        ssh_exec "pm2 stop $PM2_API_NAME" 2>/dev/null || true
    fi
    if ssh_exec "pm2 describe $PM2_WEB_NAME &> /dev/null" 2>/dev/null; then
        log_info "Stopping $PM2_WEB_NAME..."
        ssh_exec "pm2 stop $PM2_WEB_NAME" 2>/dev/null || true
    fi

    # Transfer package
    log_info "Uploading deployment package..."
    scp_to "$DEPLOY_PACKAGE_PATH" "/tmp/$DEPLOY_PACKAGE_NAME"
    log_success "Package uploaded"

    # Extract package
    log_info "Extracting on remote server..."
    ssh_exec "cd $REMOTE_APP_DIR && tar -xzf /tmp/$DEPLOY_PACKAGE_NAME --overwrite"
    log_success "Package extracted"

    # Clean up remote package
    ssh_exec "rm -f /tmp/$DEPLOY_PACKAGE_NAME"

    log_success "Code deployed to $REMOTE_APP_DIR"
}

# ── Install dependencies ─────────────────────────────────────────────

install_dependencies() {
    log_step "Installing dependencies"

    if $DRY_RUN; then
        log_dry_run "Would run npm ci on remote"
        return
    fi

    log_info "Installing all dependencies (including dev for migrations)..."
    ssh_exec "cd $REMOTE_APP_DIR && npm ci"
    log_success "Dependencies installed"
}

# ── Deploy environment file ──────────────────────────────────────────

deploy_env_file() {
    log_step "Deploying environment configuration"

    local local_env="$PROJECT_ROOT/.env.production"
    local remote_env="$REMOTE_APP_DIR/.env"

    if $DRY_RUN; then
        log_dry_run "Would deploy .env.production to $remote_env"
        return
    fi

    # Check if env file changed using hash comparison
    local local_hash
    local remote_hash
    local_hash=$(md5sum "$local_env" | cut -d' ' -f1)
    remote_hash=$(ssh_exec "md5sum $remote_env 2>/dev/null | cut -d' ' -f1" || echo "none")

    if [ "$local_hash" != "$remote_hash" ]; then
        scp_to "$local_env" "$remote_env"
        ssh_exec "chmod 600 $remote_env"
        log_success "Environment file deployed"
    else
        log_info "Environment file unchanged, skipping"
    fi
}

# ── Setup data directory ─────────────────────────────────────────────

setup_data_directory() {
    log_step "Setting up data directory"

    if $DRY_RUN; then
        log_dry_run "Would create /var/data/doc-store/vaults"
        return
    fi

    ssh_exec "mkdir -p /var/data/doc-store/vaults"
    ssh_exec "chmod 755 /var/data/doc-store/vaults"
    log_success "Data directory ready: /var/data/doc-store/vaults"
}

# ── Database setup ───────────────────────────────────────────────────

setup_database() {
    log_step "Setting up database"

    if [ "$SKIP_DB" = true ]; then
        log_info "Skipping database setup (--skip-db)"
        return
    fi

    if $DRY_RUN; then
        log_dry_run "Would create PostgreSQL user and database if not exists"
        return
    fi

    # Parse DATABASE_URL from remote .env
    local db_url
    db_url=$(ssh_exec "grep '^DATABASE_URL=' $REMOTE_APP_DIR/.env | cut -d= -f2-")

    if [ -z "$db_url" ]; then
        log_error "DATABASE_URL not found in remote .env"
        exit 1
    fi

    # Extract components from postgresql://user:password@host:port/dbname
    local db_user db_pass db_name
    db_user=$(echo "$db_url" | sed -n 's|postgresql://\([^:]*\):.*|\1|p')
    db_pass=$(echo "$db_url" | sed -n 's|postgresql://[^:]*:\([^@]*\)@.*|\1|p')
    db_name=$(echo "$db_url" | sed -n 's|.*/\([^?]*\).*|\1|p')

    log_info "Database: $db_name, User: $db_user"

    # Create user if not exists
    ssh_exec "sudo -u postgres psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='$db_user'\" | grep -q 1 || \
        sudo -u postgres psql -c \"CREATE USER $db_user WITH PASSWORD '$db_pass';\""
    log_success "Database user '$db_user' ready"

    # Create database if not exists
    ssh_exec "sudo -u postgres psql -tc \"SELECT 1 FROM pg_database WHERE datname='$db_name'\" | grep -q 1 || \
        sudo -u postgres psql -c \"CREATE DATABASE $db_name OWNER $db_user;\""
    log_success "Database '$db_name' ready"
}

# ── Run migrations ───────────────────────────────────────────────────

run_migrations() {
    log_step "Running database migrations"

    if $DRY_RUN; then
        log_dry_run "Would run drizzle-kit migrate"
        return
    fi

    log_info "Applying Drizzle migrations..."
    ssh_exec "cd $REMOTE_APP_DIR && set -a && source .env && set +a && cd packages/api && npx drizzle-kit migrate"
    log_success "Migrations applied"
}

# ── Prune dev dependencies ───────────────────────────────────────────

prune_dev_dependencies() {
    log_step "Pruning dev dependencies"

    if $DRY_RUN; then
        log_dry_run "Would run npm prune --omit=dev"
        return
    fi

    log_info "Removing dev dependencies..."
    ssh_exec "cd $REMOTE_APP_DIR && npm prune --omit=dev"
    log_success "Dev dependencies pruned"
}

# ── Deploy PM2 ───────────────────────────────────────────────────────

deploy_pm2() {
    log_step "Deploying with PM2"

    if $DRY_RUN; then
        log_dry_run "Would start/reload PM2 processes ($PM2_API_NAME, $PM2_WEB_NAME)"
        return
    fi

    # Source .env so PM2 processes inherit all environment variables
    local env_cmd="cd $REMOTE_APP_DIR && set -a && source .env && set +a"

    # Handle API process
    if ssh_exec "pm2 describe $PM2_API_NAME &> /dev/null" 2>/dev/null; then
        log_info "Reloading $PM2_API_NAME..."
        ssh_exec "$env_cmd && pm2 reload $PM2_API_NAME --update-env"
    else
        log_info "Starting $PM2_API_NAME for the first time..."
        ssh_exec "$env_cmd && pm2 start ecosystem.config.cjs --only $PM2_API_NAME"
    fi

    # Handle Web process
    if ssh_exec "pm2 describe $PM2_WEB_NAME &> /dev/null" 2>/dev/null; then
        log_info "Reloading $PM2_WEB_NAME..."
        ssh_exec "$env_cmd && pm2 reload $PM2_WEB_NAME --update-env"
    else
        log_info "Starting $PM2_WEB_NAME for the first time..."
        ssh_exec "$env_cmd && pm2 start ecosystem.config.cjs --only $PM2_WEB_NAME"
    fi

    # Save PM2 process list
    ssh_exec "pm2 save"
    log_success "PM2 deployment complete"
}

# ── Deploy Nginx ─────────────────────────────────────────────────────

deploy_nginx() {
    log_step "Deploying Nginx configuration"

    if [ "$SKIP_NGINX" = true ]; then
        log_info "Skipping Nginx deployment (--skip-nginx)"
        return
    fi

    local local_nginx="$PROJECT_ROOT/deploy/nginx/vault.mittonvillage.com.conf"
    local remote_nginx="/etc/nginx/sites-available/vault.mittonvillage.com"
    local enabled_nginx="/etc/nginx/sites-enabled/vault.mittonvillage.com"
    local nginx_changed=false

    if $DRY_RUN; then
        log_dry_run "Would deploy Nginx config to $remote_nginx"
        return
    fi

    # Check if nginx config changed
    local local_hash
    local remote_hash
    local_hash=$(md5sum "$local_nginx" | cut -d' ' -f1)
    remote_hash=$(ssh_exec "md5sum $remote_nginx 2>/dev/null | cut -d' ' -f1" || echo "none")

    if [ "$local_hash" != "$remote_hash" ]; then
        scp_to "$local_nginx" "$remote_nginx"
        nginx_changed=true
        log_success "Nginx config deployed"
    else
        log_info "Nginx config unchanged, skipping"
    fi

    # Enable site if not already enabled
    if ! ssh_exec "[ -L $enabled_nginx ]"; then
        log_info "Enabling Nginx site..."
        ssh_exec "ln -sf $remote_nginx $enabled_nginx"
        nginx_changed=true
    fi

    # Test and reload Nginx if config changed
    if [ "$nginx_changed" = true ]; then
        log_info "Testing Nginx configuration..."
        if ssh_exec "nginx -t" 2>&1; then
            ssh_exec "systemctl reload nginx"
            log_success "Nginx reloaded"
        else
            log_error "Nginx config test failed - NOT reloading"
            exit 1
        fi
    fi
}

# ── Setup SSL ────────────────────────────────────────────────────────

setup_ssl() {
    log_step "Setting up SSL certificate"

    if [ "$SKIP_SSL" = true ]; then
        log_info "Skipping SSL setup (--skip-ssl)"
        return
    fi

    local cert_path="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"

    if $DRY_RUN; then
        log_dry_run "Would setup SSL certificate for $DOMAIN"
        return
    fi

    # Check DNS resolution first
    if ! host "$DOMAIN" &> /dev/null; then
        log_warning "DNS for $DOMAIN not resolving yet"
        log_info "Create an A record pointing to your VPS IP, then re-run without --skip-ssl"
        return
    fi

    # Check if certificate already exists
    if ssh_exec "[ -f $cert_path ]"; then
        log_success "SSL certificate already exists"

        # Check expiration
        local expiry_info
        expiry_info=$(ssh_exec "certbot certificates 2>/dev/null | grep -A3 '$DOMAIN' | grep 'Expiry'" || echo "")
        if [ -n "$expiry_info" ]; then
            log_info "Certificate expiry: $expiry_info"
        fi
    else
        log_info "Requesting new SSL certificate..."

        # Create webroot directory for certbot
        ssh_exec "mkdir -p /var/www/certbot"

        # Request certificate
        if ssh_exec "certbot certonly --webroot -w /var/www/certbot -d $DOMAIN --non-interactive --agree-tos --email admin@mittonvillage.com"; then
            log_success "SSL certificate obtained"

            # Reload Nginx to use new certificate
            ssh_exec "systemctl reload nginx"
            log_success "Nginx reloaded with SSL"
        else
            log_error "Failed to obtain SSL certificate"
            log_warning "Ensure DNS A record exists and port 80 is accessible"
        fi
    fi
}

# ── Verify deployment ────────────────────────────────────────────────

verify_deployment() {
    log_step "Verifying deployment"

    if $DRY_RUN; then
        log_dry_run "Would verify health endpoints"
        return 0
    fi

    # Wait for API PM2 process
    log_info "Waiting for $PM2_API_NAME to start..."
    local api_attempts=0
    while [ $api_attempts -lt 20 ]; do
        if ssh_exec "pm2 describe $PM2_API_NAME 2>/dev/null | grep -q 'status.*online'"; then
            log_success "$PM2_API_NAME is online"
            break
        fi
        api_attempts=$((api_attempts + 1))
        sleep 2
    done

    if [ $api_attempts -eq 20 ]; then
        log_error "$PM2_API_NAME failed to start"
        log_info "Check logs: ssh $REMOTE_USER@$REMOTE_HOST 'pm2 logs $PM2_API_NAME'"
        return 1
    fi

    # Wait for Web PM2 process
    log_info "Waiting for $PM2_WEB_NAME to start..."
    local web_attempts=0
    while [ $web_attempts -lt 20 ]; do
        if ssh_exec "pm2 describe $PM2_WEB_NAME 2>/dev/null | grep -q 'status.*online'"; then
            log_success "$PM2_WEB_NAME is online"
            break
        fi
        web_attempts=$((web_attempts + 1))
        sleep 2
    done

    if [ $web_attempts -eq 20 ]; then
        log_error "$PM2_WEB_NAME failed to start"
        log_info "Check logs: ssh $REMOTE_USER@$REMOTE_HOST 'pm2 logs $PM2_WEB_NAME'"
        return 1
    fi

    # Check API health endpoint
    log_info "Checking API health endpoint..."
    local health_attempts=0
    while [ $health_attempts -lt 15 ]; do
        if ssh_exec "curl -sf http://localhost:4000/api/v1/health" &> /dev/null; then
            log_success "API health check passed (localhost:4000)"
            break
        fi
        health_attempts=$((health_attempts + 1))
        sleep 2
    done

    if [ $health_attempts -eq 15 ]; then
        log_error "API health check failed"
        return 1
    fi

    # Check Next.js is responding
    log_info "Checking Next.js frontend..."
    if ssh_exec "curl -sf http://localhost:3200 -o /dev/null" &> /dev/null; then
        log_success "Next.js frontend responding (localhost:3200)"
    else
        log_warning "Next.js frontend not responding on localhost:3200"
    fi

    # Check via domain if Nginx deployed
    if [ "$SKIP_NGINX" = false ]; then
        sleep 2
        if curl -sf "https://$DOMAIN/api/v1/health" &> /dev/null; then
            log_success "HTTPS health check passed (https://$DOMAIN)"
        else
            log_warning "HTTPS health check failed (may need DNS setup or SSL)"
        fi
    fi

    return 0
}

# ── Rollback ─────────────────────────────────────────────────────────

rollback_deployment() {
    log_error "Deployment failed, initiating rollback..."

    local backup_dir="/var/backups/doc-store"

    # Find latest app backup
    local latest_backup
    latest_backup=$(ssh_exec "ls -t $backup_dir/backup-*.tar.gz 2>/dev/null | head -1" || echo "")

    if [ -z "$latest_backup" ]; then
        log_error "No backup found for rollback - manual intervention required"
        return 1
    fi

    log_info "Restoring from backup: $latest_backup"

    # Stop PM2 processes
    ssh_exec "pm2 stop $PM2_API_NAME 2>/dev/null || true"
    ssh_exec "pm2 stop $PM2_WEB_NAME 2>/dev/null || true"

    # Restore app files
    ssh_exec "cd $REMOTE_APP_DIR && tar -xzf $latest_backup --overwrite"
    log_success "App files restored"

    # Restore database
    local latest_db_backup
    latest_db_backup=$(ssh_exec "ls -t $backup_dir/database-*.sql.gz 2>/dev/null | head -1" || echo "")

    if [ -n "$latest_db_backup" ]; then
        local db_url
        db_url=$(ssh_exec "grep '^DATABASE_URL=' $REMOTE_APP_DIR/.env | cut -d= -f2-")
        if [ -n "$db_url" ]; then
            ssh_exec "gunzip -c $latest_db_backup | psql '$db_url'" 2>/dev/null || \
                log_warning "Database restore failed"
            log_success "Database restored"
        fi
    fi

    # Reinstall dependencies and restart
    ssh_exec "cd $REMOTE_APP_DIR && npm ci --omit=dev"
    ssh_exec "cd $REMOTE_APP_DIR && pm2 restart $PM2_API_NAME 2>/dev/null || pm2 start ecosystem.config.cjs --only $PM2_API_NAME"
    ssh_exec "cd $REMOTE_APP_DIR && pm2 restart $PM2_WEB_NAME 2>/dev/null || pm2 start ecosystem.config.cjs --only $PM2_WEB_NAME"
    ssh_exec "pm2 save"

    # Re-verify
    sleep 5
    if ssh_exec "pm2 describe $PM2_API_NAME 2>/dev/null | grep -q 'status.*online'"; then
        log_success "Rollback complete - $PM2_API_NAME is online"
    else
        log_error "Rollback failed - manual intervention required"
        return 1
    fi
}

# ── Summary ──────────────────────────────────────────────────────────

show_summary() {
    log_step "Deployment Summary"

    if $DRY_RUN; then
        log_info "This was a dry run - no changes were made"
        return
    fi

    log_success "doc-store deployed successfully!"
    log_info ""
    log_info "Application URL:  https://$DOMAIN"
    log_info "API health:       https://$DOMAIN/api/v1/health"
    log_info "WebDAV URL:       https://$DOMAIN/webdav/"
    log_info ""
    log_info "Useful commands:"
    log_info "  API logs:       ssh $REMOTE_USER@$REMOTE_HOST 'pm2 logs $PM2_API_NAME'"
    log_info "  Web logs:       ssh $REMOTE_USER@$REMOTE_HOST 'pm2 logs $PM2_WEB_NAME'"
    log_info "  Restart API:    ssh $REMOTE_USER@$REMOTE_HOST 'pm2 restart $PM2_API_NAME'"
    log_info "  Restart Web:    ssh $REMOTE_USER@$REMOTE_HOST 'pm2 restart $PM2_WEB_NAME'"
    log_info "  App status:     ssh $REMOTE_USER@$REMOTE_HOST 'pm2 status'"
    log_info ""
    log_info "First deploy? Create an admin user:"
    log_info "  ssh $REMOTE_USER@$REMOTE_HOST 'cd $REMOTE_APP_DIR && node packages/api/dist/cli/create-admin.js --email X --password Y --name Z'"
}

# ── Main ─────────────────────────────────────────────────────────────

main() {
    parse_arguments "$@"

    echo -e "${BOLD}${BLUE}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║            doc-store Production Deployment                   ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    if $DRY_RUN; then
        log_warning "DRY RUN MODE - No changes will be made"
    fi

    log_info "Target: $REMOTE_USER@$REMOTE_HOST:$REMOTE_APP_DIR"
    log_info "Domain: $DOMAIN"

    # Trap to cleanup on exit
    trap cleanup EXIT

    acquire_lock
    check_local_prerequisites
    run_pre_deployment_validation
    build_locally
    init_ssh_known_hosts
    check_ssh_connectivity
    check_remote_prerequisites
    create_remote_backup
    create_deploy_package
    transfer_and_extract
    install_dependencies
    deploy_env_file
    setup_data_directory
    setup_database
    run_migrations
    prune_dev_dependencies
    deploy_pm2
    deploy_nginx
    setup_ssl

    # Verify deployment with rollback on failure
    if ! verify_deployment; then
        rollback_deployment
        exit 1
    fi

    show_summary
}

# Run main
main "$@"
