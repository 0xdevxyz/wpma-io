# Backend Dockerfile für WPMA
FROM node:20-alpine

# Arbeitsverzeichnis setzen
WORKDIR /app

# Package-Dateien kopieren
COPY package*.json ./

# Dependencies installieren
RUN npm ci --only=production

# Anwendungscode kopieren
COPY . .

# Port freigeben
EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node healthcheck.js || exit 1

# Anwendung starten
CMD ["npm", "start"]

