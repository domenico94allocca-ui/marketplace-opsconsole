# Cosa devi fare TU — guida passo-passo

Tre step in ordine. Stesso pattern del marketplace: deploy con un solo comando dal Mac.

| Step | Stato |
|---|---|
| 1. DNS su SiteGround | ✅ fatto |
| 2. Repo GitHub + push | ✅ fatto |
| 3. Bootstrap server + NPM | ⏳ stiamo qui |

---

## STEP 3 — Primo deploy (10 minuti)

### 3a. Compila il file `.env`

Sul tuo Mac:

```bash
cd "/Users/domenicoallocca/Documents/Progetti Cloude/MARKETPLACE/Gestione Marketplace/opsconsole"
cp .env.example .env
```

Genera 2 segreti:
```bash
echo "OPSCONSOLE_DB_PASSWORD=$(openssl rand -base64 32 | tr -d '=+/' | cut -c1-32)"
echo "SESSION_SECRET=$(openssl rand -base64 64 | tr -d '\n')"
```

Apri `.env` (con TextEdit, VS Code o `nano .env`) e modifica:
- `OPSCONSOLE_DB_PASSWORD=` ← incolla il primo
- `SESSION_SECRET=` ← incolla il secondo

Lascia gli altri valori così come stanno (i `ghp_xxx` `re_xxx` `CHANGE_ME` su `MARKETPLACE_DB_URL_RO` li sistemiamo dopo: per ora le viste relative mostreranno un messaggio "non configurato", la console si avvia comunque).

⚠️ Sostituisci almeno i 2 generati sopra. Il bootstrap blocca il deploy se trova ancora `CHANGE_ME` nei valori critici.

Le 3 cose che possiamo lasciare al `.env.example` come sono per il primo avvio:
- `RESEND_API_KEY=re_xxx` → email magic link, lo sistemiamo dopo
- `GITHUB_TOKEN=ghp_xxx` → vista release, dopo
- `MARKETPLACE_DB_URL_RO=...` → vista DB, dopo

Per il primo avvio sostituisci anche questi 3 con stringhe vuote per evitare confusione:
```
RESEND_API_KEY=
GITHUB_TOKEN=
MARKETPLACE_DB_URL_RO=
```

### 3b. Lancia il bootstrap

Un solo comando dal Mac. Lo script fa tutto: clone sul server, copia `.env`, crea la rete docker se manca, build, migrazioni Prisma, seed admin, health-check.

```bash
cd "/Users/domenicoallocca/Documents/Progetti Cloude/MARKETPLACE/Gestione Marketplace/opsconsole"
./scripts/bootstrap.sh
```

Cosa vedi (output normale):
```
[BOOTSTRAP] Test connessione SSH a root@204.168.168.140
[BOOTSTRAP] Setup directory /opt/opsconsole
[BOOTSTRAP] Copia .env (...)
[BOOTSTRAP] Verifica rete Docker 'marketplace-net'
[BOOTSTRAP] Build + up degli stack OpsConsole (può richiedere 3-5 min...)
[BOOTSTRAP] Esecuzione migrazioni
AdminUser ok: domenico94allocca@gmail.com id: ck...
[BOOTSTRAP] Health-check finale
HEALTH OK
[BOOTSTRAP] ✅ Bootstrap completato.
```

Se qualcosa fallisce: mandami l'output dell'errore, lo risolviamo. Lo script è idempotente: puoi rilanciarlo senza problemi.

### 3c. Configura NPM

Login al pannello NPM → **Hosts → Proxy Hosts → Add Proxy Host**:

Tab **Details**:
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

Click **Save**. NPM impiega ~30 secondi a richiedere il certificato.

### 3d. Primo accesso

1. Apri `https://ops.bacolionlife.it/login`
2. Inserisci `domenico94allocca@gmail.com` → click "Invia magic link"
3. **Resend non è configurato**, quindi l'email NON arriva. Per il primo accesso recupera il link dai log:
   ```bash
   ssh root@204.168.168.140 "docker logs opsconsole-web --tail 50 2>&1 | grep 'Magic link'"
   ```
   Vedrai una riga tipo:
   ```
   [ops][dev] Magic link: https://ops.bacolionlife.it/login/verify?token=...
   ```
   Copia il link e incollalo nel browser.
4. Scansiona il QR con Google Authenticator → conferma il codice a 6 cifre → sei dentro.

🎉 **La console è online e custom al 100%.**

---

## Aggiornamenti futuri

Da ora in poi, ogni volta che modifichi il codice:
```bash
cd "/Users/domenicoallocca/Documents/Progetti Cloude/MARKETPLACE/Gestione Marketplace/opsconsole"
git add -A && git commit -m "<msg>"
./scripts/local-deploy.sh
```
Lo script fa: branch check → push → SSH → pull → build → migrate → health-check → rollback automatico se qualcosa va storto.

**Stesso identico pattern del marketplace.**

---

## Completamenti opzionali (in qualsiasi momento)

Senza questi, la console funziona; semplicemente alcune viste mostrano "non configurato".

### A) Email magic link (Resend)
1. Account su https://resend.com
2. Aggiungi dominio `bacolionlife.it`, copia i 3 record DNS richiesti, inseriscili in **SiteGround → DNS Zone Editor** (stessa schermata dello Step 1).
3. Genera **API key** in Resend.
4. Aggiorna `.env` locale (`RESEND_API_KEY=re_...`) e rilancia:
   ```bash
   scp .env root@204.168.168.140:/opt/opsconsole/.env
   ./scripts/local-deploy.sh
   ```

### B) Vista Codice & Release (GitHub PAT)
1. https://github.com/settings/personal-access-tokens/new (fine-grained)
2. Repository access: **Only select repositories** → `domenico94allocca-ui/BacoliOnLife`
3. Permissions: `Contents: Read-only`, `Metadata: Read-only`. Scadenza 90gg.
4. Genera → copia il token.
5. Aggiorna `.env` locale (`GITHUB_TOKEN=ghp_...`) → `scp` + `local-deploy.sh` come sopra.

### C) Vista Database del marketplace (utente read-only)
Sul server marketplace-postgres serve un utente `SELECT-only`.

```bash
ssh root@204.168.168.140
PGRO_PWD='genera-una-password-sicura'   # salvala in 1Password
docker exec -i marketplace-postgres psql -U <utente_admin_marketplace> -d marketplace \
  -v ro_pwd="'$PGRO_PWD'" < /opt/opsconsole/scripts/init-marketplace-readonly.sql
exit
```
Aggiorna `.env`:
```
MARKETPLACE_DB_URL_RO=postgresql://opsconsole_ro:genera-una-password-sicura@marketplace-postgres:5432/marketplace
```
`scp .env root@204.168.168.140:/opt/opsconsole/.env && ./scripts/local-deploy.sh`.

> **Nota**: Step C è l'unica volta che dovremo fare un comando manuale lato server (la creazione di un utente DB richiede credenziali di un admin del marketplace-postgres, e va fatta una volta sola). In futuro, se vorrai, possiamo automatizzarla anche dentro `bootstrap.sh`.
