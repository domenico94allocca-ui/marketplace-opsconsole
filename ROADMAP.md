# Roadmap — BacoliOnLife (Marketplace + OpsConsole)

Aggiornata: 2026-05-16.
Fonti: questa chat + memory + git log + Claude Code sessions.

---

## ✅ Fatto

### Marketplace (versioni rilasciate)
- [x] **v1.0.0** — MVP marketplace base con negozi, prodotti, dati demo Bacoli
- [x] **v1.3.0** — Sistema punti, promozioni, upload immagini, fix critici
- [x] **v1.4.0** — Doppia categoria prodotto, ruota fortuna admin, popup cliente, cassa offline QR, API assign-offline
- [x] **v1.5.0** (5 mag 2026) — PIN cassa, redeem offline, mock checkout, mobile iOS completo
- [x] **v1.6.0** (7 mag 2026) — Carrello multi-vendor, checkout, ordini, ordinamento prodotti
- [x] **v1.6.1** — Fix endpoint `/api/health` + bump version + workflow release strutturato
- [x] **v1.7.0** — App mobile: carrello, ordini, dettaglio prodotto

### Infrastruttura & processi
- [x] Scaffold marketplace su Hetzner con Docker, NPM esterno, Postgres+Redis (mar 2026)
- [x] Backup giornalieri automatici (daily/weekly/monthly + pre-deploy) con retention
- [x] Workflow deploy reliable: `./scripts/local-deploy.sh` con rollback automatico se health fallisce
- [x] Tag retroattivi v1.0…v1.7 + GitHub Release pubblicate
- [x] Script `release.sh` (bump+changelog+tag+GitHub release+deploy in un comando)
- [x] Fix portabilità `release.sh` per BSD sed (macOS)
- [x] Baseline migration Prisma `0_init` su OpsConsole (chiude debito tecnico P3005)

### OpsConsole (console operativa)
- [x] Scaffold Next.js + Postgres dedicato + Docker, sottodominio `ops.bacolionlife.it`
- [x] Auth: email + password (bcrypt, sostituiva magic link + TOTP iniziale)
- [x] Audit log immutabile per ogni view/azione
- [x] Vista Infrastruttura: container, host, immagini, porte
- [x] Vista Database: tabelle marketplace ordinate per dimensione + migrazioni Prisma
- [x] Vista Codice & Release: LIVE vs Git, badge "Sincronizzato"/"Aggiornamento", lista tag con badge LIVE
- [x] Vista Backup: ultimo backup + calendario 30 giorni + lista file + **download in locale**
- [x] Health-check marketplace dal dashboard
- [x] Mount RO `/opt/marketplace` per leggere versione live dal package.json
- [x] Lettura GitHub via PAT fine-grained (read-only)
- [x] Ruolo Postgres `opsconsole_ro` (SELECT-only, statement_timeout 5s)
- [x] docker-socket-proxy GET-only per stato container

---

## 🟡 In corso (questa sessione)

- [ ] **DB esplorabile** — apri tabella, vedi colonne, prime 100 righe, filtro guidato, masking automatico PII
- [ ] **Vista Progetto** — overview prodotto + pagine pubbliche autopopolate + API endpoint
- [ ] **Vista Roadmap & Docs** — questa pagina + viewer markdown delle docs

---

## 📋 Da fare (prossime sessioni)

### Priorità alta
- [ ] **Backup off-site Hetzner Object Storage** — disaster recovery vero (oggi backup solo sul server)

### Priorità media
- [ ] Vista **Accessi** — visualizzazione audit log della console (chi è entrato, cosa ha visto)
- [ ] **Comando "Crea release"** dalla UI OpsConsole (al posto di CLI `release.sh`)
- [ ] **Comando "Backup ora"** dalla UI per forzare backup on-demand
- [ ] **Vista Allineamento** — evidenzia disallineamenti (file modificati non committati, tag mancanti, drift schema)
- [ ] Tail **log container** in tempo reale (SSE) dalla vista Infrastruttura

### Priorità bassa / nice-to-have
- [ ] Analisi traffico marketplace (integrazione Plausible o Umami self-hosted)
- [ ] Notifiche (telegram/email) su eventi critici: health down, backup mancante, deploy fallito
- [ ] Vista IP allow-list su NPM e gestione da UI
- [ ] Rotazione automatica secrets (`SESSION_SECRET`, GitHub PAT)
- [ ] Pulizia codice orfano TOTP/magic-link nello schema Prisma (richiede migration)
- [ ] Test E2E Playwright per i flow critici della console

---

## Promemoria tecnici

- Container marketplace: `marketplace-backend`, `marketplace-frontend`, `marketplace-postgres`, `marketplace-redis`
- Container console: `opsconsole-web`, `opsconsole-postgres`, `opsconsole-socketproxy`
- Rete Docker condivisa: `marketplace-net` (esterna, gestita da NPM)
- Server: Hetzner `root@204.168.168.140`, marketplace in `/opt/marketplace`, console in `/opt/opsconsole`, backup in `/opt/backups`
- Repo: `domenico94allocca-ui/BacoliOnLife` (marketplace) · `domenico94allocca-ui/marketplace-opsconsole` (console)
- Deploy: `./scripts/local-deploy.sh` da Mac per entrambi i progetti
- Release marketplace: `./scripts/release.sh patch|minor|major -m "msg"`
