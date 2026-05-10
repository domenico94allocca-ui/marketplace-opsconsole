import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { withMarketplaceClient } from "@/lib/db/marketplace";
import { audit } from "@/lib/audit/log";
import { Sidebar } from "@/components/Sidebar";

export const dynamic = "force-dynamic";

type TableRow = { schema: string; name: string; rows: number };

async function loadTables(): Promise<TableRow[] | null> {
  try {
    return await withMarketplaceClient(async (c) => {
      const q = `
        SELECT n.nspname AS schema, c.relname AS name, c.reltuples::bigint AS rows
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog','information_schema')
        ORDER BY c.reltuples DESC
        LIMIT 200`;
      const res = await c.query(q);
      return res.rows.map((r) => ({ schema: r.schema, name: r.name, rows: Number(r.rows) }));
    });
  } catch { return null; }
}

async function loadMigrations() {
  try {
    return await withMarketplaceClient(async (c) => {
      const r = await c.query(`SELECT migration_name, finished_at, applied_steps_count
        FROM "_prisma_migrations" ORDER BY finished_at DESC NULLS LAST LIMIT 30`);
      return r.rows;
    });
  } catch { return null; }
}

export default async function DbPage() {
  const s = await getSession();
  if (!s || !s.totpVerified) redirect("/login");

  const [tables, migrations] = await Promise.all([loadTables(), loadMigrations()]);
  await audit({ actor: s.user.email, action: "view.db.tables" });

  return (
    <div className="min-h-screen flex">
      <Sidebar email={s.user.email} />
      <main className="flex-1 p-8 max-w-6xl">
        <h1 className="text-2xl font-semibold mb-6">Database (read-only)</h1>

        <h2 className="text-lg font-medium mb-3">Tabelle</h2>
        <div className="card mb-8">
          <table className="w-full text-sm">
            <thead className="text-neutral-500 text-left">
              <tr><th className="py-2">Schema</th><th>Tabella</th><th className="text-right">Righe (stimate)</th></tr>
            </thead>
            <tbody>
              {(tables ?? []).map((t) => (
                <tr key={`${t.schema}.${t.name}`} className="border-t border-neutral-800">
                  <td className="py-2 text-neutral-400">{t.schema}</td>
                  <td>{t.name}</td>
                  <td className="text-right tabular-nums">{t.rows.toLocaleString("it-IT")}</td>
                </tr>
              ))}
              {!tables && <tr><td colSpan={3} className="py-4 text-err">DB marketplace non raggiungibile o utente RO non configurato</td></tr>}
            </tbody>
          </table>
        </div>

        <h2 className="text-lg font-medium mb-3">Ultime migrazioni Prisma</h2>
        <div className="card">
          <table className="w-full text-sm">
            <thead className="text-neutral-500 text-left">
              <tr><th className="py-2">Migration</th><th>Finita il</th><th>Step</th></tr>
            </thead>
            <tbody>
              {(migrations ?? []).map((m: any) => (
                <tr key={m.migration_name} className="border-t border-neutral-800">
                  <td className="py-2">{m.migration_name}</td>
                  <td className="text-neutral-400">{m.finished_at ? new Date(m.finished_at).toLocaleString("it-IT") : "—"}</td>
                  <td>{m.applied_steps_count ?? "—"}</td>
                </tr>
              ))}
              {!migrations && <tr><td colSpan={3} className="py-4 text-err">Tabella _prisma_migrations non leggibile</td></tr>}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
