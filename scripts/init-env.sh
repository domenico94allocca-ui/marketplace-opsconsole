#!/usr/bin/env bash
# =====================================================================
# OPSCONSOLE - init-env: prepara .env locale al primo bootstrap
# Uso (dal Mac, dalla cartella opsconsole/):
#   bash scripts/init-env.sh
# =====================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err()  { echo -e "${RED}✗${NC} $1"; exit 1; }

# 1) Verifica template
[ -f .env.example ] || err "Manca .env.example"

# 2) Salvaguardia: se .env esiste già, non sovrascrivere senza chiedere
if [ -f .env ]; then
  warn ".env esistente. Lo rinomino in .env.bak (timestamp)."
  cp .env ".env.bak.$(date +%Y%m%d_%H%M%S)"
fi

# 3) Genera segreti
SESSION_SECRET=$(openssl rand -base64 64 | tr -d '\n')
DB_PWD=$(openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | cut -c1-32)

# 4) Crea .env partendo dal template
cp .env.example .env

# Funzione di replace cross-OS (BSD sed su macOS, GNU sed altrove)
replace() {
  local key="$1" val="$2"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s|^${key}=.*|${key}=${val}|" .env
  else
    sed -i "s|^${key}=.*|${key}=${val}|" .env
  fi
}

replace SESSION_SECRET "$SESSION_SECRET"
replace OPSCONSOLE_DB_PASSWORD "$DB_PWD"
replace RESEND_API_KEY ""
replace GITHUB_TOKEN ""
replace MARKETPLACE_DB_URL_RO ""

ok ".env creato."
echo
echo "---- Riepilogo .env (valori sensibili nascosti) ----"
awk -F= '
  /^[#]/ { next }
  /^[A-Z_]+=/{
    if ($1 ~ /SECRET|PASSWORD|TOKEN|KEY/) {
      if ($2 == "") print $1"=(vuoto)";
      else          print $1"=****";
    } else if ($2 == "") print $1"=(vuoto)";
    else print $0;
  }
' .env

echo
ok "Pronto. Prossimo passo:  ./scripts/bootstrap.sh"
