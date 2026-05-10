import { Pool, type PoolClient } from "pg";

/**
 * Pool READ-ONLY verso il DB del marketplace.
 * - User: opsconsole_ro (creato da scripts/init-marketplace-readonly.sql)
 * - statement_timeout 5s, idle_in_transaction_session_timeout 10s
 * - Nessuna scrittura: il ruolo non ha grant INSERT/UPDATE/DELETE/TRUNCATE.
 */

const url = process.env.MARKETPLACE_DB_URL_RO;
if (!url && process.env.NODE_ENV === "production") {
  console.warn("[ops] MARKETPLACE_DB_URL_RO non impostata: viste DB disabilitate");
}

export const marketplacePool = url
  ? new Pool({
      connectionString: url,
      max: 4,
      idleTimeoutMillis: 30_000,
      statement_timeout: 5_000,
      query_timeout: 6_000,
    })
  : null;

export async function withMarketplaceClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  if (!marketplacePool) throw new Error("Marketplace DB non configurato");
  const client = await marketplacePool.connect();
  try {
    await client.query("SET statement_timeout = 5000");
    return await fn(client);
  } finally {
    client.release();
  }
}
