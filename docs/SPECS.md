# OpsConsole — Specifiche numerate (Fase 1)

## 1. Requisiti funzionali (FR)
| ID | Descrizione | Priorità |
|----|-------------|----------|
| FR-1.1 | Single user (`ADMIN_EMAIL`); ogni altro indirizzo viene rifiutato senza rivelare l'email autorizzata | Must |
| FR-1.2 | Login a due fattori: magic link via email (Resend) + TOTP obbligatorio | Must |
| FR-1.3 | Sessione HTTP-only, SameSite=strict, durata configurabile (default 7gg), revocabile da DB | Must |
| FR-2.1 | Vista Infrastruttura: lista container con stato, image, porte, ultimo restart | Must |
| FR-2.2 | Vista Infrastruttura: stato host (RAM, CPU, disco, OS) | Should |
| FR-2.3 | Vista Infrastruttura: ping `/api/health` marketplace + scadenza certificato TLS | Should |
| FR-3.1 | Vista DB: elenco tabelle con conteggio righe stimato | Must |
| FR-3.2 | Vista DB: ultime migrazioni Prisma applicate vs pendenti | Must |
| FR-3.3 | Vista DB: utente con soli `SELECT`, `statement_timeout = 5s` | Must |
| FR-4.1 | Vista Codice: branch main, ultimo commit, link GitHub | Must |
| FR-4.2 | Vista Release: lista tag/release con changelog e link a GitHub | Must |
| FR-4.3 | Vista Release: confronto commit deployato vs HEAD main | Should |
| FR-5.1 | Vista Backup: lista backup con dimensione, età, alert se obsoleto | Must |
| FR-5.2 | Vista Log: tail log container via SSE con filtro per livello | Should |
| FR-6.1 | Audit log persistente di ogni richiesta API e cambio stato | Must |
| FR-6.2 | Logout invalida la sessione corrente lato server | Must |

## 2. Requisiti non funzionali (NFR)
| ID | Descrizione |
|----|-------------|
| NFR-1 | Tutto containerizzato, niente Homebrew per i servizi |
| NFR-2 | Deploy esclusivo via `local-deploy.sh`, niente SSH manuale |
| NFR-3 | Zero scrittura sul DB del marketplace in Fase 1 |
| NFR-4 | Niente esposizione del Docker socket alla webapp: solo `docker-socket-proxy` (GET only) |
| NFR-5 | TLS gestito da NPM con Let's Encrypt; HSTS 2 anni; CSP restrittiva |
| NFR-6 | TOTP obbligatorio: nessun percorso bypassa il secondo fattore |
| NFR-7 | Backup giornaliero del DB OpsConsole con retention 14gg + restore-test settimanale |
| NFR-8 | Tempo di risposta P95 dashboard < 800ms con dati cache |
| NFR-9 | Logging strutturato; nessun secret nei log |

## 3. Criteri di accettazione
- AC-1 Login con email diversa da `ADMIN_EMAIL` ritorna sempre risposta generica.
- AC-2 Senza TOTP verificato, qualsiasi rotta privata reindirizza a `/login/totp`.
- AC-3 Restart di `marketplace-postgres` → la pagina DB mostra errore esplicito entro 6s.
- AC-4 Backup più vecchio di `BACKUP_FRESHNESS_HOURS` → badge `WARN`/`ERR` in dashboard.
- AC-5 Ogni view emette un record `AuditLog` con `actor`, `action`, `ip`, `userAgent`.
- AC-6 Test E2E (Playwright) coprono: magic link → TOTP enroll → dashboard → 4 viste → logout.

## 4. Vincoli tecnici
- Naming container: `opsconsole-web`, `opsconsole-postgres`, `opsconsole-socketproxy`.
- Rete Docker: `marketplace-net` esterna (riusa quella del marketplace).
- Variabili sensibili: file `.env` fuori repo, mai committate.
- Versioni pinnate in `package.json`.

## 5. Milestone
| M | Output | Stato |
|---|--------|-------|
| M0 | Scaffolding repo, compose, schema Prisma, docs | ✅ creato |
| M1 | Auth magic link + TOTP + audit log + middleware | ✅ creato |
| M2 | Vista Infrastruttura (container + info + health) | 🟡 base creata, completare host stats |
| M3 | Vista DB (tabelle + migrazioni + drift detection) | 🟡 base creata, completare drift |
| M4 | Vista Codice/Release + Backup/Log (SSE) | 🟡 base creata, completare log SSE |
