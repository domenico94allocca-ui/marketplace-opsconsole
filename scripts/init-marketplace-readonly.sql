-- =====================================================================
-- Crea il ruolo READ-ONLY usato da OpsConsole sul DB del marketplace.
-- Eseguire SUL marketplace-postgres (DB del marketplace), non su quello
-- della console. Sostituire la password e il nome del DB se diversi.
--
-- Esempio:
--   docker exec -i marketplace-postgres psql -U <admin> -d marketplace \
--     -v ro_pwd="'CHANGE_ME'" -f - < init-marketplace-readonly.sql
-- =====================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'opsconsole_ro') THEN
    EXECUTE format('CREATE ROLE opsconsole_ro LOGIN PASSWORD %L', current_setting('ro_pwd'));
  ELSE
    EXECUTE format('ALTER ROLE opsconsole_ro WITH LOGIN PASSWORD %L', current_setting('ro_pwd'));
  END IF;
END $$;

GRANT CONNECT ON DATABASE marketplace TO opsconsole_ro;

-- Permessi minimi: SELECT su tutto il pubblico (e _prisma_migrations) + USAGE schema.
GRANT USAGE ON SCHEMA public TO opsconsole_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO opsconsole_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO opsconsole_ro;

-- Limiti di sicurezza
ALTER ROLE opsconsole_ro SET statement_timeout = '5s';
ALTER ROLE opsconsole_ro SET idle_in_transaction_session_timeout = '10s';
ALTER ROLE opsconsole_ro SET search_path = public;

-- Verifica
SELECT rolname, rolcanlogin, rolconfig FROM pg_roles WHERE rolname = 'opsconsole_ro';
