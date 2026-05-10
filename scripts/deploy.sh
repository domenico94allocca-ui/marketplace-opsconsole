#!/bin/bash
# =====================================================================
# OPSCONSOLE - Deploy lato server (eseguito da local-deploy.sh via SSH)
# Path atteso: /opt/opsconsole
# =====================================================================

set -euo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()   { echo -e "${GREEN}[SERVER]${NC} $1"; }
error() { echo -e "${RED}[ERRORE]${NC} $1"; }

cd /opt/opsconsole

# Snapshot SHA precedente per rollback codice
PREV_SHA=$(git rev-parse HEAD)
log "SHA precedente: $PREV_SHA"

log "Pull codice"
git fetch origin main
git reset --hard origin/main

log "Build + up (docker compose server)"
docker compose -f docker-compose.server.yml up --build -d --remove-orphans

log "Prisma migrate deploy"
docker compose -f docker-compose.server.yml exec -T opsconsole-web npx prisma migrate deploy

log "Health-check (max 30s)"
for i in 1 2 3 4 5 6; do
  if curl -fsS http://localhost:3100/api/health >/dev/null 2>&1 \
     || docker compose -f docker-compose.server.yml exec -T opsconsole-web wget -qO- http://localhost:3100/api/health >/dev/null 2>&1; then
    log "Health OK"
    exit 0
  fi
  sleep 5
done

error "Health-check fallito → rollback codice a $PREV_SHA"
git reset --hard "$PREV_SHA"
docker compose -f docker-compose.server.yml up --build -d --remove-orphans
exit 1
