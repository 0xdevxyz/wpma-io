#!/bin/bash

# WPMA.io Uptime Monitor
LOG_FILE="/var/log/wpma/monitor.log"
EMAIL="admin@leapp.studio"

check_service() {
    local service=$1
    local url=$2
    
    if ! curl -f -s "$url" > /dev/null; then
        echo "$(date): $service is DOWN!" >> $LOG_FILE
        systemctl restart $service
        # Send alert email
        echo "$service was down and has been restarted" | mail -s "WPMA Alert: $service restarted" $EMAIL
    else
        echo "$(date): $service is UP" >> $LOG_FILE
    fi
}

# Check services every minute
check_service "wpma-backend" "http://localhost:3000/health"
check_service "wpma-frontend" "http://localhost:3001"
check_service "nginx" "http://localhost"