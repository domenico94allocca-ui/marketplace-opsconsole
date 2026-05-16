import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Sidebar } from "@/components/Sidebar";
import { audit } from "@/lib/audit/log";
import { fetchRows, countRows, type FilterOp } from "@/lib/db/explorer";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ALLOWED_OPS: FilterOp[] = ["=", "!=", "ILIKE", ">", "<", "IS NULL", "IS NOT NULL"];

export default async function TableViewer({
  params,
  searchParams,
}: {
  params: Promise<{ schema: string; table: string }>;
  searchParams: Promise<{ col?: string; op?: string; val?: string; ob?: string; od?: "ASC" | "DESC"; offset?: string }>;
}) {
  const s = await getSession();
  if (!s || !s.totpVerified) redirect("/login");
  const { schema, table } = await params;
  const sp = await searchParams;

  const tableName = decodeURIComponent(table);
  const filter = sp.col && ALLOWED_OPS.includes(sp.op as FilterOp)
    ? { column: sp.col, op: sp.op as FilterOp, value: sp.val }
    : undefined;
  const offset = Math.max(0, Number(sp.offset || 0));

  let result: Awaited<ReturnType<typeof fetchRows>> | null = null;
  let total: number | null = null;
  let error: string | null = null;
  try {
    result = await fetchRows({
      schema, table: tableName, limit: 100, offset,
      filter, orderBy: sp.ob, orderDir: sp.od,
    });
    total = await countRows(schema, tableName);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  await audit({
    actor: s.user.email,
    action: "view.db.table",
    target: `${schema}.${tableName}`,
    payload: { offset, filter: filter ?? null, orderBy: sp.ob ?? null },
  });

  return (
    <div className="min-h-screen flex">
      <Sidebar email={s.user.email} />
      <main className="flex-1 p-8 max-w-full overflow-x-auto">
        <div className="mb-4">
          <Link href="/database" className="text-brand-light text-sm">← Tutte le tabelle</Link>
        </div>
        <h1 className="text-2xl font-semibold mb-1">
          <span className="text-neutral-500 text-sm">{schema}.</span>{tableName}
        </h1>
        <div className="text-sm text-neutral-500 mb-6">
          {total != null ? `${total.toLocaleString("it-IT")} righe totali` : "conteggio non disponibile"}
          {result ? ` · ${result.columns.length} colonne` : ""}
        </div>

        {error && <div className="card text-err mb-4">Errore: {error}</div>}

        {result && (
          <>
            <FilterBar columns={result.columns.map((c) => c.name)} current={filter} schema={schema} table={tableName} />

            <div className="card mb-4">
              <h2 className="text-sm font-medium text-neutral-500 mb-3">Schema colonne</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 text-xs">
                {result.columns.map((c) => (
                  <div key={c.name} className="flex items-center justify-between border-b border-neutral-800/40 py-1">
                    <span className="font-mono">{c.name} {c.isMasked && <span className="badge-warn text-[10px] ml-1">PII</span>}</span>
                    <span className="text-neutral-500">{c.type}{c.nullable ? " ?" : ""}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="text-neutral-500 text-left sticky top-0 bg-neutral-900">
                  <tr>
                    {result.columns.map((c) => (
                      <th key={c.name} className="py-2 px-2 whitespace-nowrap">
                        <Link
                          href={`?ob=${encodeURIComponent(c.name)}&od=${sp.ob === c.name && sp.od === "ASC" ? "DESC" : "ASC"}${filter ? `&col=${filter.column}&op=${encodeURIComponent(filter.op)}&val=${encodeURIComponent(filter.value ?? "")}` : ""}`}
                          className="hover:text-brand-light"
                        >
                          {c.name}
                          {sp.ob === c.name && <span className="text-brand-light ml-1">{sp.od === "DESC" ? "↓" : "↑"}</span>}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, idx) => (
                    <tr key={idx} className="border-t border-neutral-800 hover:bg-neutral-900/50">
                      {result.columns.map((c) => (
                        <td key={c.name} className="py-1 px-2 whitespace-nowrap font-mono">
                          {formatCell(row[c.name])}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {result.rows.length === 0 && (
                    <tr><td className="py-4 text-neutral-500 text-center" colSpan={result.columns.length}>Nessuna riga corrisponde al filtro</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4 text-xs text-neutral-500">
              <div>Mostrate righe {offset + 1}–{offset + result.rows.length}{result.truncated ? " (troncato a 100)" : ""}</div>
              <div className="flex gap-2">
                {offset > 0 && (
                  <Link className="btn-ghost px-3 py-1" href={`?offset=${Math.max(0, offset - 100)}${filter ? `&col=${filter.column}&op=${encodeURIComponent(filter.op)}&val=${encodeURIComponent(filter.value ?? "")}` : ""}${sp.ob ? `&ob=${sp.ob}&od=${sp.od ?? "ASC"}` : ""}`}>← Precedenti</Link>
                )}
                {result.truncated && (
                  <Link className="btn-ghost px-3 py-1" href={`?offset=${offset + 100}${filter ? `&col=${filter.column}&op=${encodeURIComponent(filter.op)}&val=${encodeURIComponent(filter.value ?? "")}` : ""}${sp.ob ? `&ob=${sp.ob}&od=${sp.od ?? "ASC"}` : ""}`}>Successivi →</Link>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function FilterBar({ columns, current, schema, table }: { columns: string[]; current?: { column: string; op: FilterOp; value?: string }; schema: string; table: string }) {
  return (
    <form className="card mb-4 flex flex-wrap items-end gap-2" action={`/database/${schema}/${encodeURIComponent(table)}`} method="GET">
      <div>
        <label className="block text-xs text-neutral-500">Colonna</label>
        <select name="col" className="input py-1" defaultValue={current?.column ?? ""}>
          <option value="">— nessun filtro —</option>
          {columns.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-neutral-500">Operatore</label>
        <select name="op" className="input py-1" defaultValue={current?.op ?? "="}>
          {ALLOWED_OPS.map((op) => <option key={op} value={op}>{op}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-neutral-500">Valore</label>
        <input name="val" className="input py-1" defaultValue={current?.value ?? ""} placeholder="(vuoto per IS NULL/NOT NULL)" />
      </div>
      <button className="btn-primary py-1 px-4" type="submit">Applica</button>
      {current && (
        <a href={`/database/${schema}/${encodeURIComponent(table)}`} className="text-xs text-neutral-500 hover:text-err">Pulisci</a>
      )}
    </form>
  );
}

function formatCell(v: unknown): string {
  if (v == null) return "—";
  if (v instanceof Date) return v.toISOString().replace("T", " ").slice(0, 19);
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return s.length > 120 ? s.slice(0, 117) + "…" : s;
}
