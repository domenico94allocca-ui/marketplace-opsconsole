import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit/log";
import { Sidebar } from "@/components/Sidebar";
import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

type Backup = { name: string; bucket: string; size: number; mtime: Date; path: string; relPath: string };

const BACKUP_EXT_RE = /\.(sql\.gz|sql|tar\.gz|tgz|tar|dump|zip)$/i;

async function listBackups(): Promise<Backup[] | null> {
  const dir = process.env.BACKUP_DIR || "/backups";
  try {
    const entries = await fs.readdir(dir, { recursive: true, withFileTypes: true });
    const out: Backup[] = [];
    for (const e of entries) {
      if (!e.isFile() || !BACKUP_EXT_RE.test(e.name)) continue;
      const parent = (e as any).parentPath ?? (e as any).path ?? dir;
      const full = path.join(parent, e.name);
      try {
        const st = await fs.stat(full);
        const rel = path.relative(dir, parent);
        out.push({
          name: e.name,
          bucket: rel === "" ? "(root)" : rel,
          size: st.size,
          mtime: st.mtime,
          path: full,
          relPath: path.relative(dir, full),
        });
      } catch {}
    }
    out.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    return out;
  } catch { return null; }
}

type DayCell = {
  date: Date;       // 00:00 locale del giorno
  label: string;    // "dd/MM"
  count: number;
  size: number;     // somma byte
  status: "ok" | "warn" | "err" | "missing";
};

function buildCalendar(all: Backup[]): { days: DayCell[]; streak: number; medianLast7: number } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days: DayCell[] = [];
  // 30 giorni: oggi-29 ... oggi
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000);
    const next = new Date(d.getTime() + 86_400_000);
    const inDay = all.filter((b) => b.mtime >= d && b.mtime < next);
    const totalSize = inDay.reduce((s, b) => s + b.size, 0);
    days.push({
      date: d,
      label: d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }),
      count: inDay.length,
      size: totalSize,
      status: "missing", // placeholder, set sotto
    });
  }
  // mediana totSize ultimi 7 giorni con backup
  const last7 = days.slice(-7).filter((d) => d.size > 0).map((d) => d.size).sort((a, b) => a - b);
  const median = last7.length === 0 ? 0 : last7[Math.floor(last7.length / 2)];
  for (const d of days) {
    if (d.count === 0) d.status = "missing";
    else if (median > 0 && d.size < median * 0.5) d.status = "warn";
    else d.status = "ok";
  }
  // Streak: giorni consecutivi (verso il passato) con backup OK partendo da oggi.
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) streak++;
    else break;
  }
  return { days, streak, medianLast7: median };
}

export default async function BackupsPage() {
  const s = await getSession();
  if (!s || !s.totpVerified) redirect("/login");
  const all = await listBackups();
  await audit({ actor: s.user.email, action: "view.backups" });

  const fresh = Number(process.env.BACKUP_FRESHNESS_HOURS || 26);
  const last = all?.[0];
  const ageH = last ? (Date.now() - last.mtime.getTime()) / 3_600_000 : null;
  const status = ageH == null ? "err" : ageH <= fresh ? "ok" : ageH <= fresh * 2 ? "warn" : "err";

  const cal = all ? buildCalendar(all) : null;
  const visible = (all ?? []).slice(0, 100);

  return (
    <div className="min-h-screen flex">
      <Sidebar email={s.user.email} />
      <main className="flex-1 p-8 max-w-6xl">
        <h1 className="text-2xl font-semibold mb-6">Backup</h1>

        <div className="card mb-6">
          <div className="flex flex-wrap gap-6 items-end justify-between">
            <div>
              <div className="text-sm text-neutral-500">Ultimo backup</div>
              <div className="text-xl mt-1">
                {last ? `${last.name}` : "Nessun backup trovato"}
              </div>
              <div className="text-sm text-neutral-400 mt-1">
                {last ? `${formatSize(last.size)} · ${ageH!.toFixed(1)}h fa · ${last.bucket}` : ""}
              </div>
            </div>
            <div className="text-right">
              <span className={status === "ok" ? "badge-ok" : status === "warn" ? "badge-warn" : "badge-err"}>{status.toUpperCase()}</span>
              {cal && (
                <div className="text-sm text-neutral-400 mt-2">
                  {cal.streak >= 7
                    ? <span className="text-ok">✅ {cal.streak} giorni consecutivi OK</span>
                    : cal.streak >= 1
                      ? <span>Streak: {cal.streak} {cal.streak === 1 ? "giorno" : "giorni"}</span>
                      : ageH != null
                        ? <span className="text-warn">⚠ ultimo backup {ageH.toFixed(0)}h fa</span>
                        : <span className="text-err">⚠ nessun backup</span>}
                </div>
              )}
            </div>
          </div>
        </div>

        {cal && (
          <div className="card mb-6">
            <div className="text-sm text-neutral-500 mb-3">Ultimi 30 giorni</div>
            <div className="grid grid-cols-10 gap-1.5">
              {cal.days.map((d) => (
                <div
                  key={d.date.toISOString()}
                  title={`${d.label} · ${d.count} backup · ${formatSize(d.size)}`}
                  className={`aspect-square rounded text-[10px] flex items-end justify-end p-1 font-mono ${
                    d.status === "ok"
                      ? "bg-ok/80 text-white"
                      : d.status === "warn"
                        ? "bg-warn/80 text-neutral-900"
                        : "bg-neutral-700 text-neutral-500"
                  }`}
                >
                  {d.label.slice(0, 2)}
                </div>
              ))}
            </div>
            <div className="flex gap-4 text-xs text-neutral-500 mt-3">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-ok/80 inline-block"></span> OK</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-warn/80 inline-block"></span> Sospetto (&lt;50% mediana)</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-neutral-700 inline-block"></span> Nessun backup</span>
            </div>
          </div>
        )}

        <div className="card">
          <div className="text-sm text-neutral-500 mb-3">Ultimi {visible.length} file</div>
          <table className="w-full text-sm">
            <thead className="text-neutral-500 text-left">
              <tr><th className="py-2">Categoria</th><th>File</th><th>Dimensione</th><th>Data</th><th></th></tr>
            </thead>
            <tbody>
              {visible.map((b) => (
                <tr key={b.path} className="border-t border-neutral-800">
                  <td className="py-2 text-neutral-400">{b.bucket}</td>
                  <td className="font-mono text-xs">{b.name}</td>
                  <td>{formatSize(b.size)}</td>
                  <td className="text-neutral-400">{b.mtime.toLocaleString("it-IT")}</td>
                  <td className="text-right">
                    <a
                      className="text-brand-light hover:underline text-xs"
                      href={`/api/backups/download?path=${encodeURIComponent(b.relPath)}`}
                      title={`Scarica ${b.name}`}
                    >
                      ↓ Scarica
                    </a>
                  </td>
                </tr>
              ))}
              {!all && <tr><td colSpan={5} className="py-4 text-err">Directory backup non leggibile ({process.env.BACKUP_DIR || "/backups"})</td></tr>}
              {all && visible.length === 0 && <tr><td colSpan={5} className="py-4 text-neutral-500">Nessun file di backup trovato.</td></tr>}
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
