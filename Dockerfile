# Backend Dockerfile für WPMA
FROM node:20-alpine

# Install zip utility
RUN apk add --no-cache zip

# Arbeitsverzeichnis setzen
WORKDIR /app

# Package-Dateien kopieren
COPY package*.json ./

# Dependencies installieren
RUN npm install --production

# Anwendungscode kopieren
COPY . .

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Port freigeben
EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node healthcheck.js || exit 1

# Anwendung starten mit entrypoint
ENTRYPOINT ["/docker-entrypoint.sh"]

