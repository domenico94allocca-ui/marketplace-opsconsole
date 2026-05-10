# Cosa devi fare TU — guida passo-passo

Solo 3 cose, in ordine. Niente SSH. Tempo totale stimato: ~20 minuti.

Tutto il resto (Resend per email, GitHub PAT, utente DB read-only) lo aggiungeremo **dopo**, quando la console è già visibile online. Per ora puntiamo a "vedere la pagina di login".

---

## STEP 1 — DNS su SiteGround (3 minuti)

Crea il sottodominio `ops.bacolionlife.it` puntato al server.

1. Login su SiteGround → **Site Tools** del dominio `bacolionlife.it`.
2. Menu sinistra: **Domain → DNS Zone Editor**.
3. Tab **A** → Click **Create Record**.
   - **Name**: `ops`
   - **Type**: `A`
   - **IPv4**: `204.168.168.140`
   - **TTL**: lascia default (3600).
4. Click **Create**.
5. Verifica da terminale del Mac:
   ```bash
   dig +short ops.bacolionlife.it
   # Deve rispondere: 204.168.168.140
   ```
   (Può servire qualche minuto per propagarsi.)

---

## STEP 2 — Repo GitHub + push iniziale (5 minuti)

Serve un repo da cui Portainer farà il deploy.

1. Vai su https://github.com/new
   - **Owner**: `domenico94allocca-ui` (lo stesso del marketplace)
   - **Repository name**: `marketplace-opsconsole`
   - **Private** ✅
   - **NO** README/gitignore/license (li abbiamo già).
   - Click **Create repository**.

2. Sul tuo Mac, dal Terminal:
   ```bash
   cd "/Users/domenicoallocca/Documents/Progetti Cloude/MARKETPLACE/Gestione Marketplace/opsconsole"
   git init
   git add -A
   git commit -m "feat: scaffold OpsConsole v0.1"
   git branch -M main
   git remote add origin https://github.com/domenico94allocca-ui/marketplace-opsconsole.git
   git push -u origin main
   ```
   (Se ti chiede credenziali GitHub, usa username + Personal Access Token come password.)

---

## STEP 3 — Deploy via Portainer (10 minuti)

Niente SSH. Fai tutto dal pannello Portainer.

### 3a. Genera 2 password e 1 segreto

Nel Terminal del Mac:
```bash
openssl rand -base64 32   # → questa è OPSCONSOLE_DB_PASSWORD
openssl rand -base64 64   # → questa è SESSION_SECRET
```
Salva entrambi in 1Password (voce: "OpsConsole prod").

### 3b. Deploy dello stack su Portainer

1. Login su Portainer → menu sinistra **Stacks** → **+ Add stack**.
2. **Name**: `opsconsole`
3. **Build method**: scegli **Repository**.
4. Compila:
   - **Repository URL**: `https://github.com/domenico94allocca-ui/marketplace-opsconsole`
   - **Repository reference**: `refs/heads/main`
   - **Compose path**: `docker-compose.server.yml`
   - **Authentication**: ✅ → username `domenico94allocca-ui` + un Personal Access Token GitHub (basta scope `repo`).
5. Sezione **Environment variables** → click **Advanced mode** e incolla:
   ```env
   OPS_DOMAIN=ops.bacolionlife.it
   ADMIN_EMAIL=domenico94allocca@gmail.com
   SESSION_SECRET=<incolla qui il secondo openssl>
   TOTP_ISSUER=BacoliOnLife OpsConsole
   MAGIC_LINK_TTL_MIN=10
   SESSION_TTL_DAYS=7
   OPSCONSOLE_DB_PASSWORD=<incolla qui il primo openssl>
   MARKETPLACE_DB_URL_RO=
   GITHUB_TOKEN=
   GITHUB_OWNER=domenico94allocca-ui
   GITHUB_REPO=BacoliOnLife
   MARKETPLACE_HEALTH_URL=https://bacolionlife.it/api/health
   MARKETPLACE_DOMAIN=bacolionlife.it
   BACKUP_FRESHNESS_HOURS=26
   HOST_BACKUP_DIR=/opt/backups
   RESEND_API_KEY=
   EMAIL_FROM=ops@bacolionlife.it
   ```
   (`MARKETPLACE_DB_URL_RO`, `GITHUB_TOKEN`, `RESEND_API_KEY` li lasciamo **vuoti** per ora — le viste relative mostreranno un errore controllato e gentile, va bene.)
6. Click **Deploy the stack**. Ci mette 2–4 minuti (compila Next.js).
7. In **Containers** dovresti vedere 3 container nuovi tutti `running`:
   - `opsconsole-postgres`
   - `opsconsole-socketproxy`
   - `opsconsole-web`

### 3c. Inizializza il DB OpsConsole

In Portainer → **Containers** → `opsconsole-web` → **Console** (icona `>_`) → Command `/bin/sh`, User `nextjs` → **Connect**, poi nel terminale:
```
npx prisma migrate deploy
npx tsx scripts/seed-admin.ts
```
Output atteso dell'ultimo comando: `AdminUser ok: domenico94allocca@gmail.com id: ...`

### 3d. Configura NPM (Nginx Proxy Manager)

Login NPM → **Hosts → Proxy Hosts → Add Proxy Host**:

- **Domain Names**: `ops.bacolionlife.it`
- **Scheme**: `http`
- **Forward Hostname/IP**: `opsconsole-web`
- **Forward Port**: `3100`
- **Block Common Exploits** ✅
- **Websockets Support** ✅

Tab **SSL**:
- **SSL Certificate**: `Request a new SSL Certificate (Let's Encrypt)`
- **Force SSL** ✅
- **HTTP/2** ✅
- **HSTS Enabled** ✅
- **Email**: la tua
- ✅ Accetto i ToS Let's Encrypt
- **Save**.

### 3e. Primo accesso

1. Apri `https://ops.bacolionlife.it/login`
2. Inserisci `domenico94allocca@gmail.com` → click "Invia magic link"
3. **Senza Resend, l'email non arriva**. Per il primo accesso prendi il link dal log del container:
   - Portainer → `opsconsole-web` → **Logs** → cerca riga `[ops][dev] Magic link: https://...`
   - Copia il link, aprilo nel browser.
4. Scansiona il QR con Google Authenticator → conferma il codice → sei dentro.

🎉 **Da qui in poi la console è online e tu sei autenticato.**

---

## DOPO che funziona — i 3 "completamenti opzionali"

Ognuno sblocca una vista, in qualsiasi ordine.

### A) Email magic link (Resend) — non più dipendente dai log
1. Account su https://resend.com
2. Aggiungi dominio `bacolionlife.it`, copia i 3 record DNS richiesti, **inseriscili in SiteGround** stessa procedura DNS Zone Editor.
3. Crea **API key** → la metti come `RESEND_API_KEY` nello stack Portainer (Stacks → opsconsole → Editor → Environment variables → Update the stack).

### B) Vista Codice & Release — abilita lettura GitHub
1. https://github.com/settings/personal-access-tokens/new (fine-grained)
2. Repository access: `domenico94allocca-ui/BacoliOnLife` (solo questo)
3. Permissions: `Contents: Read-only`, `Metadata: Read-only`
4. Genera → copia → mettilo come `GITHUB_TOKEN` nello stack Portainer.

### C) Vista Database del marketplace — utente read-only
In Portainer → Container `marketplace-postgres` → Console → **Connect**:
```
psql -U <utente_admin> -d marketplace
```
Incolla:
```sql
CREATE ROLE opsconsole_ro LOGIN PASSWORD 'metti_password_sicura';
GRANT CONNECT ON DATABASE marketplace TO opsconsole_ro;
GRANT USAGE ON SCHEMA public TO opsconsole_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO opsconsole_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO opsconsole_ro;
ALTER ROLE opsconsole_ro SET statement_timeout = '5s';
\q
```
Poi metti nello stack:
```
MARKETPLACE_DB_URL_RO=postgresql://opsconsole_ro:metti_password_sicura@marketplace-postgres:5432/marketplace
```

---

## Riepilogo — cosa fa ogni step
| Step | Cosa sblocca |
|---|---|
| 1 — DNS | Il browser sa dove andare quando digiti `ops.bacolionlife.it` |
| 2 — Repo GitHub | Portainer ha da dove prendere il codice |
| 3 — Portainer + NPM | I container girano e il sottodominio risponde in HTTPS |
| A — Resend | Email reali invece di copiare link dai log |
| B — GitHub PAT | Vista Release/Codice popolata |
| C — Utente DB ro | Vista Database popolata |
