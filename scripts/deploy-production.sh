#!/bin/bash

# WPMA.io Production Deployment Script for Hetzner Server
# Usage: ./scripts/deploy-production.sh [frontend|backend|all]

set -e

# Configuration
FRONTEND_DOMAIN="app.wpma.io"
BACKEND_DOMAIN="api.wpma.io"
FRONTEND_DIR="/var/www/app.wpma.io"
BACKEND_DIR="/var/www/api.wpma.io"
LOG_DIR="/var/log/wpma"
BACKUP_DIR="/var/backups/wpma"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root"
        exit 1
    fi
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    mkdir -p $FRONTEND_DIR
    mkdir -p $BACKEND_DIR
    mkdir -p $LOG_DIR
    mkdir -p $BACKUP_DIR
    mkdir -p /etc/nginx/sites-available
    mkdir -p /etc/nginx/sites-enabled
    mkdir -p /etc/systemd/system
    
    # Set proper permissions
    chown -R www-data:www-data $FRONTEND_DIR
    chown -R www-data:www-data $BACKEND_DIR
    chown -R www-data:www-data $LOG_DIR
    chown -R www-data:www-data $BACKUP_DIR
}

# Install system dependencies
install_dependencies() {
    log "Installing system dependencies..."
    
    # Update package list
    apt update
    
    # Install required packages
    apt install -y \
        nginx \
        postgresql \
        postgresql-contrib \
        redis-server \
        nodejs \
        npm \
        certbot \
        python3-certbot-nginx \
        curl \
        wget \
        git \
        unzip \
        build-essential \
        python3-pip \
        supervisor \
        logrotate \
        fail2ban \
        ufw
}

# Setup PostgreSQL
setup_postgresql() {
    log "Setting up PostgreSQL..."
    
    # Start PostgreSQL service
    systemctl start postgresql
    systemctl enable postgresql
    
    # Create database and user
    sudo -u postgres psql << EOF
CREATE DATABASE wpma_db;
CREATE USER wpma_user WITH PASSWORD 'wpma_password';
GRANT ALL PRIVILEGES ON DATABASE wpma_db TO wpma_user;
\q
EOF
    
    log "PostgreSQL setup completed"
}

# Setup Redis
setup_redis() {
    log "Setting up Redis..."
    
    # Configure Redis
    sed -i 's/# maxmemory <bytes>/maxmemory 256mb/' /etc/redis/redis.conf
    sed -i 's/# maxmemory-policy noeviction/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf
    
    # Start Redis service
    systemctl start redis-server
    systemctl enable redis-server
    
    log "Redis setup completed"
}

# Setup Nginx
setup_nginx() {
    log "Setting up Nginx..."
    
    # Create Nginx configuration for frontend
    cat > /etc/nginx/sites-available/$FRONTEND_DOMAIN << EOF
server {
    listen 80;
    server_name $FRONTEND_DOMAIN;
    
    root $FRONTEND_DIR;
    index index.html;
    
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    
    location /_next/static {
        alias $FRONTEND_DIR/.next/static;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    location /static {
        alias $FRONTEND_DIR/public;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
EOF

    # Create Nginx configuration for backend
    cat > /etc/nginx/sites-available/$BACKEND_DOMAIN << EOF
upstream wpma_backend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name $BACKEND_DOMAIN;
    
    location / {
        proxy_pass http://wpma_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Rate limiting
        limit_req zone=api burst=10 nodelay;
        limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    }
    
    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
}
EOF

    # Enable sites
    ln -sf /etc/nginx/sites-available/$FRONTEND_DOMAIN /etc/nginx/sites-enabled/
    ln -sf /etc/nginx/sites-available/$BACKEND_DOMAIN /etc/nginx/sites-enabled/
    
    # Test Nginx configuration
    nginx -t
    
    # Restart Nginx
    systemctl restart nginx
    systemctl enable nginx
    
    log "Nginx setup completed"
}

# Setup SSL certificates
setup_ssl() {
    log "Setting up SSL certificates..."
    
    # Get SSL certificates
    certbot --nginx -d $FRONTEND_DOMAIN -d $BACKEND_DOMAIN --non-interactive --agree-tos --email admin@wpma.io
    
    # Setup auto-renewal
    echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
    
    log "SSL setup completed"
}

# Deploy backend
deploy_backend() {
    log "Deploying backend..."
    
    cd $BACKEND_DIR
    
    # Backup current version
    if [ -d "current" ]; then
        cp -r current backup-$(date +%Y%m%d-%H%M%S)
    fi
    
    # Clone/pull latest code
    if [ -d ".git" ]; then
        git pull origin main
    else
        git clone https://github.com/your-username/wpma.git .
    fi
    
    # Install dependencies
    npm ci --production
    
    # Copy environment file
    cp env.production .env
    
    # Run database migrations
    npm run migrate
    
    # Create systemd service
    cat > /etc/systemd/system/wpma-backend.service << EOF
[Unit]
Description=WPMA Backend API
After=network.target postgresql.service redis-server.service

[Service]
Type=simple
User=www-data
WorkingDirectory=$BACKEND_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
StandardOutput=append:/var/log/wpma/backend.log
StandardError=append:/var/log/wpma/backend-error.log

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd and start service
    systemctl daemon-reload
    systemctl enable wpma-backend
    systemctl start wpma-backend
    
    log "Backend deployment completed"
}

# Deploy frontend
deploy_frontend() {
    log "Deploying frontend..."
    
    cd $FRONTEND_DIR
    
    # Backup current version
    if [ -d "current" ]; then
        cp -r current backup-$(date +%Y%m%d-%H%M%S)
    fi
    
    # Clone/pull latest code
    if [ -d ".git" ]; then
        git pull origin main
    else
        git clone https://github.com/your-username/wpma-frontend.git .
    fi
    
    # Install dependencies
    npm ci
    
    # Build for production
    npm run build
    
    # Copy environment file
    cp .env.production .env.local
    
    # Create systemd service
    cat > /etc/systemd/system/wpma-frontend.service << EOF
[Unit]
Description=WPMA Frontend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=$FRONTEND_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10
StandardOutput=append:/var/log/wpma/frontend.log
StandardError=append:/var/log/wpma/frontend-error.log

[Install]
WantedBy=multi-user.target
EOF

    # Reload systemd and start service
    systemctl daemon-reload
    systemctl enable wpma-frontend
    systemctl start wpma-frontend
    
    log "Frontend deployment completed"
}

# Setup monitoring
setup_monitoring() {
    log "Setting up monitoring..."
    
    # Create logrotate configuration
    cat > /etc/logrotate.d/wpma << EOF
/var/log/wpma/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 www-data www-data
    postrotate
        systemctl reload wpma-backend
        systemctl reload wpma-frontend
    endscript
}
EOF

    # Setup fail2ban
    cat > /etc/fail2ban/jail.local << EOF
[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
port = http,https
logpath = /var/log/nginx/error.log
EOF

    systemctl enable fail2ban
    systemctl start fail2ban
    
    log "Monitoring setup completed"
}

# Setup firewall
setup_firewall() {
    log "Setting up firewall..."
    
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow ssh
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable
    
    log "Firewall setup completed"
}

# Health check
health_check() {
    log "Performing health check..."
    
    # Check if services are running
    if systemctl is-active --quiet wpma-backend; then
        log "Backend service is running"
    else
        error "Backend service is not running"
        return 1
    fi
    
    if systemctl is-active --quiet wpma-frontend; then
        log "Frontend service is running"
    else
        error "Frontend service is not running"
        return 1
    fi
    
    # Check if websites are accessible
    if curl -f -s http://localhost:3000/health > /dev/null; then
        log "Backend health check passed"
    else
        error "Backend health check failed"
        return 1
    fi
    
    log "Health check completed successfully"
}

# Main deployment function
main() {
    local component=${1:-all}
    
    log "Starting WPMA.io production deployment..."
    
    check_root
    create_directories
    
    case $component in
        "backend")
            install_dependencies
            setup_postgresql
            setup_redis
            setup_nginx
            setup_ssl
            deploy_backend
            setup_monitoring
            setup_firewall
            ;;
        "frontend")
            install_dependencies
            setup_nginx
            setup_ssl
            deploy_frontend
            setup_monitoring
            setup_firewall
            ;;
        "all")
            install_dependencies
            setup_postgresql
            setup_redis
            setup_nginx
            setup_ssl
            deploy_backend
            deploy_frontend
            setup_monitoring
            setup_firewall
            ;;
        *)
            error "Invalid component. Use: frontend, backend, or all"
            exit 1
            ;;
    esac
    
    health_check
    
    log "Deployment completed successfully!"
    log "Frontend: https://$FRONTEND_DOMAIN"
    log "Backend: https://$BACKEND_DOMAIN"
    log "Health Check: https://$BACKEND_DOMAIN/health"
}

# Run main function with arguments
main "$@" 