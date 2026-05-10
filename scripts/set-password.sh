#!/usr/bin/env bash
# =====================================================================
# OPSCONSOLE - imposta la password dell'AdminUser via SSH (no echo).
# Uso (dal Mac, dalla cartella opsconsole/):
#   ./scripts/set-password.sh
# La password viene letta in modo nascosto e passata al container come
# variabile d'ambiente, mai loggata né committata.
# =====================================================================

set -euo pipefail

SERVER_USER="root"
SERVER_IP="204.168.168.140"
SERVER_DIR="/opt/opsconsole"
ADMIN_EMAIL_DEFAULT="domenico94allocca@gmail.com"

read -rp "Email admin [${ADMIN_EMAIL_DEFAULT}]: " ADMIN_EMAIL
ADMIN_EMAIL="${ADMIN_EMAIL:-$ADMIN_EMAIL_DEFAULT}"

read -rsp "Nuova password (min 8): " ADMIN_PASSWORD
echo
read -rsp "Conferma password: " ADMIN_PASSWORD2
echo

if [ "$ADMIN_PASSWORD" != "$ADMIN_PASSWORD2" ]; then
  echo "✗ Le password non coincidono." >&2
  exit 1
fi
if [ "${#ADMIN_PASSWORD}" -lt 8 ]; then
  echo "✗ Password troppo corta (min 8)." >&2
  exit 1
fi

# La password viene passata via stdin a un sub-shell remota che la
# riassegna a una env var SOLO per quella exec. Niente argv visibile in `ps`.
ssh "$SERVER_USER@$SERVER_IP" \
  "cd $SERVER_DIR && \
   read -r PWD_IN && \
   docker compose -f docker-compose.server.yml exec -T \
     -e ADMIN_EMAIL='$ADMIN_EMAIL' \
     -e ADMIN_PASSWORD=\"\$PWD_IN\" \
     opsconsole-web npx tsx scripts/set-password.ts" <<<"$ADMIN_PASSWORD"

echo "✓ Password impostata per $ADMIN_EMAIL"
