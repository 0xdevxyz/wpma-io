#!/bin/bash
set -e

BACKEND_IP="172.18.0.7"
FRONTEND_IP="172.18.0.9"

echo "Stopping old containers..."
docker stop wpma-backend wpma-frontend 2>/dev/null || true
docker rm wpma-backend wpma-frontend 2>/dev/null || true

echo "Building images..."
docker build -t saas-project-1-backend:latest /opt/projects/saas-project-1/
docker build -t saas-project-1-frontend:latest /opt/projects/saas-project-1/wpma-frontend/

source /opt/projects/saas-project-1/.env

echo "Starting backend..."
docker run -d --name wpma-backend \
  --network saas-project-1_wpma-network \
  --restart unless-stopped \
  -e NODE_ENV=production -e PORT=8000 \
  -e DATABASE_URL="$DATABASE_URL" \
  -e DATABASE_SSL=false -e DATABASE_POOL_MAX=20 \
  -e REDIS_HOST=wpma-redis -e REDIS_PORT=6379 \
  -e REDIS_PASSWORD="$REDIS_PASSWORD" -e REDIS_DB=3 \
  -e JWT_SECRET="$JWT_SECRET" \
  -e FRONTEND_URL=https://app.wpma.io \
  -e OPENROUTER_API_KEY="$OPENROUTER_API_KEY" \
  saas-project-1-backend:latest

echo "Starting frontend..."
docker run -d --name wpma-frontend \
  --network saas-project-1_wpma-network \
  --restart unless-stopped \
  -e NEXT_PUBLIC_API_URL="https://api.wpma.io" \
  -e NODE_ENV=production \
  saas-project-1-frontend:latest

sleep 4

echo "Connecting to proxy-network with fixed IPs..."
docker network connect --ip "$BACKEND_IP" proxy-network wpma-backend
docker network connect --ip "$FRONTEND_IP" proxy-network wpma-frontend

echo "Reloading nginx..."
nginx -s reload

echo "Done. Backend: $BACKEND_IP, Frontend: $FRONTEND_IP"
