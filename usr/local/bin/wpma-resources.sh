#!/bin/bash

# Resource Monitoring
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')
MEM_USAGE=$(free | grep Mem | awk '{printf "%.2f", $3/$2 * 100.0}')
DISK_USAGE=$(df -h / | awk 'NR==2{printf "%s", $5}')

# Alerts bei hoher Auslastung
if (( $(echo "$CPU_USAGE > 80" | bc -l) )); then
    echo "High CPU usage: $CPU_USAGE%" | mail -s "WPMA Alert: High CPU" admin@wpma.io
fi

if (( $(echo "$MEM_USAGE > 80" | bc -l) )); then
    echo "High Memory usage: $MEM_USAGE%" | mail -s "WPMA Alert: High Memory" admin@wpma.io
fi

echo "$(date): CPU: $CPU_USAGE%, MEM: $MEM_USAGE%, DISK: $DISK_USAGE" >> /var/log/wpma/resources.log