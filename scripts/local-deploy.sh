#!/usr/bin/env bash
# =====================================================================
# OpsConsole - Local deploy (Mac → Hetzner)
# Replica il pattern di marketplace/scripts/local-deploy.sh:
#   1. typecheck + build locale
#   2. commit + push su main
#   3. ssh server: git pull + docker compose up --build -d
#   4. health-check post-deploy
#   5. rollback automatico se health-check fallisce
# =====================================================================
set -euo pipefail

SERVER_USER="${OPS_SERVER_USER:-deploy}"
SERVER_HOST="${OPS_SERVER_HOST:-CHANGE_ME.bacolionlife.it}"
REMOTE_DIR="${OPS_REMOTE_DIR:-/opt/opsconsole}"
HEALTH_URL="${OPS_HEALTH_URL:-https://ops.bacolionlife.it/api/health}"

step() { printf "\n\033[1;36m▶ %s\033[0m\n" "$*"; }
fail() { printf "\033[1;31m✗ %s\033[0m\n" "$*"; exit 1; }

step "Pre-check: branch e working tree"
git rev-parse --is-inside-work-tree >/dev/null || fail "Non sei in un repo git"
[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || fail "Devi essere su main"

step "Lint + typecheck + build locali"
npm run typecheck
npm run build

step "Commit & push (se ci sono modifiche)"
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "deploy: $(date +%Y-%m-%d_%H:%M)"
fi
git push origin main

PREV_SHA=$(ssh "$SERVER_USER@$SERVER_HOST" "cd $REMOTE_DIR && git rev-parse HEAD")
step "SHA precedente: $PREV_SHA"

step "Deploy remoto"
ssh "$SERVER_USER@$SERVER_HOST" "
  set -e
  cd $REMOTE_DIR
  git fetch origin main
  git reset --hard origin/main
  docker compose -f docker-compose.server.yml up --build -d
  docker compose -f docker-compose.server.yml exec -T opsconsole-web npx prisma migrate deploy
"

step "Health-check"
sleep 5
for i in 1 2 3 4 5; do
  if curl -fsS "$HEALTH_URL" >/dev/null; then
    printf "\033[1;32m✓ Deploy OK\033[0m\n"
    exit 0
  fi
  sleep 5
done

step "Rollback a $PREV_SHA"
ssh "$SERVER_USER@$SERVER_HOST" "
  set -e
  cd $REMOTE_DIR
  git reset --hard $PREV_SHA
  docker compose -f docker-compose.server.yml up --build -d
"
fail "Health-check fallito → rollback eseguito"
