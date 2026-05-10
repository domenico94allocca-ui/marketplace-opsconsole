import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/opsconsole";
import { Sidebar } from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function Home() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.user.totpEnabledAt && !s.totpVerified) redirect("/login/totp");
  if (!s.user.totpEnabledAt) redirect("/login/totp"); // forza enroll al primo accesso

  const [containers, lastBackup, lastRelease, lastHealth] = await Promise.all([
    safe(() => fetch(`http://${process.env.DOCKER_SOCKET_PROXY_HOST}:${process.env.DOCKER_SOCKET_PROXY_PORT}/containers/json?all=1`, { cache: "no-store" }).then(r => r.json())),
    prisma.backupSnapshot.findFirst({ orderBy: { takenAt: "desc" } }),
    prisma.releaseRecord.findFirst({ orderBy: { deployedAt: "desc" } }),
    prisma.healthSample.findFirst({ where: { target: "marketplace.health" }, orderBy: { capturedAt: "desc" } }),
  ]);

  const running = Array.isArray(containers) ? containers.filter((c: any) => c.State === "running").length : 0;
  const total   = Array.isArray(containers) ? containers.length : 0;

  return (
    <div className="min-h-screen flex">
      <Sidebar email={s.user.email} />
      <main className="flex-1 p-8 max-w-6xl">
        <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="Container running" value={`${running}/${total}`} status={running > 0 ? "ok" : "err"} href="/infra" />
          <Kpi label="Ultimo backup"       value={lastBackup ? formatAge(lastBackup.takenAt) : "n/d"} status={freshness(lastBackup?.takenAt)} href="/backups" />
          <Kpi label="Ultima release"      value={lastRelease?.tag ?? "n/d"} status={lastRelease ? "ok" : "warn"} href="/releases" />
          <Kpi label="Health marketplace"  value={lastHealth?.status ?? "n/d"} status={(lastHealth?.status as any) ?? "warn"} href="/infra" />
        </div>
        <p className="text-sm text-neutral-500 mt-8">
          OpsConsole v0.1 · single-tenant · {s.user.email}
        </p>
      </main>
    </div>
  );
}

function Kpi({ label, value, status, href }: { label: string; value: string; status: "ok" | "warn" | "err"; href: string }) {
  const cls = status === "ok" ? "badge-ok" : status === "warn" ? "badge-warn" : "badge-err";
  return (
    <a href={href} className="card hover:border-brand transition">
      <div className="text-sm text-neutral-500">{label}</div>
      <div className="text-2xl font-semibold mt-2">{value}</div>
      <span className={`${cls} mt-3`}>{status.toUpperCase()}</span>
    </a>
  );
}

function freshness(d?: Date | null): "ok" | "warn" | "err" {
  if (!d) return "err";
  const h = (Date.now() - new Date(d).getTime()) / 3_600_000;
  const limit = Number(process.env.BACKUP_FRESHNESS_HOURS || 26);
  if (h <= limit) return "ok";
  if (h <= limit * 2) return "warn";
  return "err";
}

function formatAge(d: Date): string {
  const h = Math.round((Date.now() - new Date(d).getTime()) / 3_600_000);
  if (h < 24) return `${h}h fa`;
  return `${Math.round(h / 24)}g fa`;
}

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch { return null; }
}
