import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit/log";
import { Sidebar } from "@/components/Sidebar";
import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

type Backup = { name: string; size: number; mtime: Date; path: string };

async function listBackups(): Promise<Backup[] | null> {
  const dir = process.env.BACKUP_DIR || "/backups";
  try {
    const entries = await fs.readdir(dir);
    const out: Backup[] = [];
    for (const e of entries) {
      const p = path.join(dir, e);
      try {
        const st = await fs.stat(p);
        if (st.isFile()) out.push({ name: e, size: st.size, mtime: st.mtime, path: p });
      } catch {}
    }
    return out.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
  } catch { return null; }
}

export default async function BackupsPage() {
  const s = await getSession();
  if (!s || !s.totpVerified) redirect("/login");
  const backups = await listBackups();
  await audit({ actor: s.user.email, action: "view.backups" });

  const fresh = Number(process.env.BACKUP_FRESHNESS_HOURS || 26);
  const last = backups?.[0];
  const ageH = last ? (Date.now() - last.mtime.getTime()) / 3_600_000 : null;
  const status = ageH == null ? "err" : ageH <= fresh ? "ok" : ageH <= fresh * 2 ? "warn" : "err";

  return (
    <div className="min-h-screen flex">
      <Sidebar email={s.user.email} />
      <main className="flex-1 p-8 max-w-6xl">
        <h1 className="text-2xl font-semibold mb-6">Backup</h1>

        <div className="card mb-6">
          <div className="text-sm text-neutral-500">Ultimo backup</div>
          <div className="text-xl mt-1">
            {last ? `${last.name} — ${formatSize(last.size)} — ${ageH!.toFixed(1)}h fa` : "Nessun backup trovato"}
          </div>
          <span className={status === "ok" ? "badge-ok mt-3" : status === "warn" ? "badge-warn mt-3" : "badge-err mt-3"}>{status.toUpperCase()}</span>
        </div>

        <div className="card">
          <table className="w-full text-sm">
            <thead className="text-neutral-500 text-left">
              <tr><th className="py-2">File</th><th>Dimensione</th><th>Data</th></tr>
            </thead>
            <tbody>
              {(backups ?? []).map((b) => (
                <tr key={b.path} className="border-t border-neutral-800">
                  <td className="py-2 font-mono text-xs">{b.name}</td>
                  <td>{formatSize(b.size)}</td>
                  <td className="text-neutral-400">{b.mtime.toLocaleString("it-IT")}</td>
                </tr>
              ))}
              {!backups && <tr><td colSpan={3} className="py-4 text-err">Directory backup non leggibile ({process.env.BACKUP_DIR || "/backups"})</td></tr>}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function formatSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}
