#!/bin/bash
# =====================================================================
# OPSCONSOLE - Deploy dal Mac (stesso pattern del marketplace)
# =====================================================================
# Uso:  ./scripts/local-deploy.sh
# Cosa fa:
#   1. Verifica branch main + working tree pulito
#   2. Push su GitHub
#   3. SSH al server, git pull + docker compose up --build -d + prisma migrate deploy
# =====================================================================

set -euo pipefail

SERVER_USER="root"
SERVER_IP="204.168.168.140"
SERVER_DIR="/opt/opsconsole"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()   { echo -e "${GREEN}[LOCAL]${NC} $1"; }
error() { echo -e "${RED}[ERRORE]${NC} $1"; }
warn()  { echo -e "${YELLOW}[AVVISO]${NC} $1"; }

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  error "Sei sul branch '$BRANCH'. Passa a 'main' prima del deploy."
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  error "Hai modifiche non committate:"
  git status --short
  exit 1
fi

log "Push su GitHub..."
git push origin main

log "Deploy remoto..."
ssh "$SERVER_USER@$SERVER_IP" "cd $SERVER_DIR && git fetch origin main && git checkout origin/main -- scripts/deploy.sh 2>/dev/null; bash scripts/deploy.sh"

log "Deploy OK. Verifica su https://ops.bacolionlife.it"
