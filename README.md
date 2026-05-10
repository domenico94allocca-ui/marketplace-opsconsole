# BacoliOnLife OpsConsole

Console operativa **single-tenant** per il marketplace BacoliOnLife.
Solo Domenico ha accesso. Fase 1 = sola lettura (server, container, DB, Git/release, backup).

## Architettura
- **Stack**: Next.js 15 (App Router), TypeScript, Prisma, Postgres dedicato.
- **Auth**: Magic link (Resend) + TOTP obbligatorio.
- **Hosting**: Stesso server Hetzner del marketplace, sottodominio `ops.bacolionlife.it` dietro Nginx Proxy Manager.
- **Sorgenti dati**:
  - Container/host → `tecnativa/docker-socket-proxy` (GET-only).
  - DB marketplace → utente `opsconsole_ro` (solo SELECT, statement_timeout 5s).
  - Git/release → GitHub API con PAT fine-grained (read).
  - Backup → directory host montata read-only.

## Setup locale
```bash
cp .env.example .env
docker compose up -d                       # Postgres dev
npm install
npx prisma migrate dev --name init
npm run seed:admin                         # crea AdminUser
npm run dev                                # http://localhost:3100
```

In dev il magic link viene stampato in console (no email).

## Deploy
Vedi `scripts/local-deploy.sh` (replica il pattern del marketplace).

## Documentazione
- [`docs/SPECS.md`](docs/SPECS.md) — requisiti funzionali e non funzionali numerati.
- [`docs/RUNBOOK.md`](docs/RUNBOOK.md) — procedure operative (primo accesso, restore, rollback).
- [`docs/ACTIONS_REQUIRED.md`](docs/ACTIONS_REQUIRED.md) — **azioni che deve fare Domenico manualmente**.
