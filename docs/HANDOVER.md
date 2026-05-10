# OpsConsole — Handover per Claude Code

Brief di passaggio dalla chat Cowork. Da qui Claude Code prende il lavoro e completa il primo deploy senza ulteriori azioni manuali da parte di Domenico (oltre a fornire la password SSH del server quando richiesta, se le chiavi non sono ancora installate).

## Contesto progetto
- **Scopo**: console operativa privata single-tenant per il marketplace BacoliOnLife (osservare server, container, DB, Git/release, backup; in fase 2 anche gestire).
- **Architettura**: Next.js 15 App Router + Prisma + Postgres dedicato, sottodominio `ops.bacolionlife.it` dietro Nginx Proxy Manager esistente, sulla stessa VM Hetzner del marketplace, sulla rete docker `marketplace-net`.
- **Auth**: magic link (Resend, opzionale al primo avvio) + TOTP obbligatorio.
- **Sorgenti dati**: `tecnativa/docker-socket-proxy` GET-only (container), ruolo `opsconsole_ro` su `marketplace-postgres` (vista DB), GitHub PAT fine-grained (vista release), directory backup montata RO (vista backup).
- **Coerenza con marketplace**: stesso pattern di deploy (`local-deploy.sh` da Mac → SSH → `deploy.sh` lato server). Niente Portainer, niente SSH manuale (lo script automatizza).

## Stato attuale (10 maggio 2026)
- ✅ Scaffold completo in `opsconsole/` (44+ file): config, schema Prisma, auth completa, 4 viste MVP, Docker compose dev/prod, script di deploy.
- ✅ DNS `ops.bacolionlife.it` → `204.168.168.140` configurato su SiteGround.
- ✅ Repo GitHub privato `domenico94allocca-ui/marketplace-opsconsole` creato e pushato.
- ✅ Script `scripts/init-env.sh` per generare `.env` locale (idempotente).
- ⏳ **Da fare adesso**: generare `.env`, lanciare `scripts/bootstrap.sh`, configurare Proxy Host su NPM.

## Coordinate operative
- Server: `root@204.168.168.140` (Hetzner, Docker già installato, rete `marketplace-net` esistente)
- Path remoto: `/opt/opsconsole`
- Marketplace: `/opt/marketplace`, container `marketplace-postgres`/`marketplace-backend`/`marketplace-frontend`, backup in `/opt/backups`
- NPM: pannello già operativo (lo usa il marketplace)
- Repo: `https://github.com/domenico94allocca-ui/marketplace-opsconsole` branch `main`

## Cosa deve fare Claude Code
Esegui in ordine, fermandoti se uno step fallisce:

1. **Verifica stato repo locale**:
   ```bash
   cd "/Users/domenicoallocca/Documents/Progetti Cloude/MARKETPLACE/Gestione Marketplace/opsconsole"
   git status
   git pull --ff-only
   ```
2. **Se non esiste già `.env`**, genera con:
   ```bash
   bash scripts/init-env.sh
   ```
   (crea `.env`, popola `SESSION_SECRET` e `OPSCONSOLE_DB_PASSWORD` con `openssl`, lascia vuoti `RESEND_API_KEY`/`GITHUB_TOKEN`/`MARKETPLACE_DB_URL_RO`)
3. **Verifica DNS**: `dig +short ops.bacolionlife.it` deve dare `204.168.168.140`. Se vuoto, aspetta 2 min e ritenta.
4. **Bootstrap server** (richiede SSH a `root@204.168.168.140`):
   ```bash
   ./scripts/bootstrap.sh
   ```
   Lo script: clona/aggiorna `/opt/opsconsole`, copia `.env`, crea rete `marketplace-net` se manca, `docker compose -f docker-compose.server.yml up --build -d`, `prisma migrate deploy`, `seed-admin`, health-check. Se SSH chiede password ripetutamente, proporre setup chiavi: `ssh-copy-id root@204.168.168.140`.
5. **Configurazione NPM** (manuale se non c'è API key NPM): proxy host `ops.bacolionlife.it` → `opsconsole-web:3100`, SSL Let's Encrypt + Force SSL + HTTP/2 + HSTS. Se l'utente ha l'API NPM, automatizzare anche questo via curl.
6. **Recupera magic link dal log** (Resend non configurato al primo avvio):
   ```bash
   ssh root@204.168.168.140 'docker logs opsconsole-web --tail 100 2>&1 | grep "Magic link"'
   ```
   Mostrare il link a Domenico per il primo accesso. Lui scansiona QR TOTP, completa enrollment.

## Vincoli e regole
- **Solo Docker** per i servizi (no Homebrew). Riferimento: memory `feedback_solo_docker`.
- **Niente SSH interattivo manuale**: tutto via script. Riferimento: memory `feedback_no_ssh_loops`.
- **Verifica schema DB** dopo `prisma migrate`: il drift è già successo in passato sul marketplace. Riferimento: memory `feedback_verifica_schema_post_migrate`.
- **Mai committare `.env`**: è in `.gitignore`. `.env.example` è il template.
- **Convenzione naming**: container `opsconsole-*`, porta web `3100`, network `marketplace-net`.

## Completamenti opzionali (dopo che la console è online)
- (A) **Resend** per email magic link reali — vedi `docs/ACTIONS_REQUIRED.md` sezione A.
- (B) **GitHub PAT fine-grained** per popolare la vista Release — sezione B.
- (C) **Utente `opsconsole_ro` su marketplace-postgres** per popolare la vista Database — sezione C, usare `scripts/init-marketplace-readonly.sql`.

## File di riferimento
- `docs/SPECS.md` — requisiti FR/NFR numerati e criteri di accettazione.
- `docs/RUNBOOK.md` — procedure operative (recovery TOTP, rollback, restore-test, rotazione segreti).
- `docs/ACTIONS_REQUIRED.md` — guida step-by-step (oggi semi-completata: 1 e 2 fatti, 3 in corso).
- `prisma/schema.prisma` — modello dati (AdminUser, Session, MagicLink, AuditLog, HealthSample, BackupSnapshot, ReleaseRecord).
- `docker-compose.server.yml` — stack di produzione (3 container: `-web`, `-postgres`, `-socketproxy`).

## Criterio di "completato"
Chiusura del lavoro = Domenico apre `https://ops.bacolionlife.it/login`, riceve un magic link (dal log al primo giro, da Resend dopo configurazione opzionale A), completa enrollment TOTP, vede la dashboard popolata almeno per la sezione Infrastruttura (DB e Release vuote in attesa di B/C). Audit log ha già tracciato i suoi accessi.
