#!/bin/bash
# =====================================================================
# OPSCONSOLE - Bootstrap (PRIMA installazione sul server)
# Eseguilo UNA VOLTA SOLA dal tuo Mac.
# Da quel momento in poi, per gli aggiornamenti userai solo:
#   ./scripts/local-deploy.sh
# =====================================================================
# Uso:
#   ./scripts/bootstrap.sh
#
# Prerequisiti:
#   - DNS ops.bacolionlife.it → 204.168.168.140 (Step 1)
#   - Repo github.com/domenico94allocca-ui/marketplace-opsconsole creato (Step 2)
#   - File .env COMPILATO nella stessa cartella di questo script (vedi .env.example)
#   - Accesso SSH come root al server (stesso usato per il marketplace)
# =====================================================================

set -euo pipefail

SERVER_USER="root"
SERVER_IP="204.168.168.140"
SERVER_DIR="/opt/opsconsole"
REPO_URL="https://github.com/domenico94allocca-ui/marketplace-opsconsole.git"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
log()   { echo -e "${GREEN}[BOOTSTRAP]${NC} $1"; }
error() { echo -e "${RED}[ERRORE]${NC} $1"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- Pre-check locali --------------------------------------------------
[ -f "$PROJECT_DIR/.env" ] || error "Manca $PROJECT_DIR/.env (parti da .env.example e compila i CHANGE_ME)"
grep -q "^SESSION_SECRET=" "$PROJECT_DIR/.env" || error ".env senza SESSION_SECRET"
grep -q "CHANGE_ME"        "$PROJECT_DIR/.env" && error ".env contiene ancora CHANGE_ME — completa prima di continuare"

# --- Test SSH ----------------------------------------------------------
log "Test connessione SSH a $SERVER_USER@$SERVER_IP"
ssh -o BatchMode=no -o ConnectTimeout=10 "$SERVER_USER@$SERVER_IP" "echo ok" >/dev/null \
  || error "SSH fallita. Verifica credenziali."

# --- Clone repo lato server -------------------------------------------
log "Setup directory $SERVER_DIR"
ssh "$SERVER_USER@$SERVER_IP" "
  set -e
  if [ -d $SERVER_DIR/.git ]; then
    echo '[server] repo esistente, eseguo pull'
    cd $SERVER_DIR && git fetch origin main && git reset --hard origin/main
  else
    mkdir -p $SERVER_DIR
    git clone $REPO_URL $SERVER_DIR
  fi
  chmod +x $SERVER_DIR/scripts/*.sh
"

# --- Copia .env ---------------------------------------------------------
log "Copia .env (sicurezza: il file resta solo sul server, mai nel repo)"
scp "$PROJECT_DIR/.env" "$SERVER_USER@$SERVER_IP:$SERVER_DIR/.env"
ssh "$SERVER_USER@$SERVER_IP" "chmod 600 $SERVER_DIR/.env"

# --- Verifica rete docker ----------------------------------------------
log "Verifica rete Docker 'marketplace-net'"
ssh "$SERVER_USER@$SERVER_IP" "docker network inspect marketplace-net >/dev/null 2>&1 || docker network create marketplace-net"

# --- Build & up --------------------------------------------------------
log "Build + up degli stack OpsConsole (può richiedere 3-5 min la prima volta)"
ssh "$SERVER_USER@$SERVER_IP" "
  set -e
  cd $SERVER_DIR
  docker compose -f docker-compose.server.yml up --build -d --remove-orphans
"

# --- Migrazioni Prisma -------------------------------------------------
log "Attendo che opsconsole-postgres sia pronto..."
ssh "$SERVER_USER@$SERVER_IP" "
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if docker exec opsconsole-postgres pg_isready -U opsconsole >/dev/null 2>&1; then break; fi
    sleep 3
  done
"

log "Esecuzione migrazioni"
ssh "$SERVER_USER@$SERVER_IP" "
  cd $SERVER_DIR
  docker compose -f docker-compose.server.yml exec -T opsconsole-web npx prisma migrate deploy
  docker compose -f docker-compose.server.yml exec -T opsconsole-web npx tsx scripts/seed-admin.ts
"

# --- Health-check ------------------------------------------------------
log "Health-check finale"
ssh "$SERVER_USER@$SERVER_IP" "
  for i in 1 2 3 4 5 6; do
    if docker compose -f $SERVER_DIR/docker-compose.server.yml exec -T opsconsole-web wget -qO- http://localhost:3100/api/health >/dev/null 2>&1; then
      echo 'HEALTH OK'; exit 0
    fi
    sleep 5
  done
  echo 'HEALTH FAIL'; exit 1
"

log "✅ Bootstrap completato."
log "Prossimo passo: configura NPM (proxy host ops.bacolionlife.it → opsconsole-web:3100)"
log "Da ora in poi per ogni update:  ./scripts/local-deploy.sh"
