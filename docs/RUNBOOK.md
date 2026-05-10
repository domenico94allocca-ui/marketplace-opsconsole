# OpsConsole — Runbook

## 1. Primo accesso
1. Visita `https://ops.bacolionlife.it/login`.
2. Inserisci `domenico94allocca@gmail.com` → ricevi magic link via Resend.
3. Apri il link entro 10 minuti: parte la procedura di enrollment TOTP.
4. Scansiona il QR con Google Authenticator / 1Password / Authy. Salva il codice manuale come backup in 1Password.
5. Inserisci il codice a 6 cifre per attivare il secondo fattore.

## 2. Recovery TOTP (perso device)
1. SSH al server (eccezionalmente) → `docker exec -it opsconsole-postgres psql -U opsconsole`.
2. `UPDATE "AdminUser" SET "totpSecret"=NULL, "totpEnabledAt"=NULL WHERE email='domenico94allocca@gmail.com';`
3. Esegui di nuovo il flusso di enrollment al prossimo login.

## 3. Restore-test settimanale (raccomandato)
```bash
LATEST=$(ls -1t /var/backups/opsconsole/*.sql.gz | head -1)
docker run --rm -d --name pg-restore-test -e POSTGRES_PASSWORD=test postgres:16-alpine
sleep 5
gunzip -c "$LATEST" | docker exec -i pg-restore-test psql -U postgres
docker stop pg-restore-test
```

## 4. Rollback deploy
`scripts/local-deploy.sh` esegue rollback automatico se l'health-check post-deploy fallisce. Manuale:
```bash
ssh deploy@$SERVER "cd /opt/opsconsole && git reset --hard <PREV_SHA> && docker compose -f docker-compose.server.yml up --build -d"
```

## 5. Rotazione segreti
- `SESSION_SECRET`: ruotare ogni 90gg → invalida tutte le sessioni esistenti (atteso). I secret TOTP sono cifrati con questo secret: **prima della rotazione**, decifrare e ricifrare con il nuovo (`scripts/rotate-totp-key.ts` da implementare prima della prima rotazione).
- `GITHUB_TOKEN`: PAT fine-grained scope `contents:read, metadata:read`, scadenza 90gg.
- `RESEND_API_KEY`: rigenerare dal pannello Resend in caso di sospetto.
- Password DB (`OPSCONSOLE_DB_PASSWORD`, `MARKETPLACE_DB_URL_RO`): documentate in 1Password, mai nel repo.

## 6. Aggiornamento Next.js / Prisma
1. Branch `chore/update-deps` → `npm outdated`.
2. Aggiorna minor patch, `npm run build && npm run typecheck && npm run test`.
3. Deploy in staging (TBD) o direttamente su prod fuori orario.
4. Rollback: come sopra.
