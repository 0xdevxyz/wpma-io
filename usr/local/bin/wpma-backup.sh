#!/bin/bash

# Automatisches Database Backup
BACKUP_DIR="/var/backups/wpma"
DATE=$(date +%Y%m%d_%H%M%S)

# PostgreSQL Backup
pg_dump -h localhost -U wpma_user wpma_db > "$BACKUP_DIR/wpma_db_$DATE.sql"

# Komprimieren
gzip "$BACKUP_DIR/wpma_db_$DATE.sql"

# Alte Backups löschen (älter als 7 Tage)
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "$(date): Database backup completed" >> /var/log/wpma/backup.log