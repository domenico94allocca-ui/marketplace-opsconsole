import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Sidebar } from "@/components/Sidebar";
import { getLiveVersion } from "@/lib/marketplace/version";
import { Octokit } from "octokit";
import tls from "node:tls";
import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

async function getGitInfo(live: { commitSha: string | null; version: string | null }) {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (!token || !owner || !repo) return null;
  try {
    const octo = new Octokit({ auth: token });
    const [main, releases] = await Promise.all([
      octo.rest.repos.getBranch({ owner, repo, branch: "main" }),
      octo.rest.repos.listReleases({ owner, repo, per_page: 1 }),
    ]);
    let ahead: number | null = null;
    if (live.commitSha) {
      try {
        const cmp = await octo.rest.repos.compareCommitsWithBasehead({
          owner, repo,
          basehead: `${live.commitSha}...${main.data.commit.sha}`,
        });
        ahead = cmp.data.ahead_by;
      } catch {}
    }
    return {
      latestTag: releases.data[0]?.tag_name ?? null,
      latestDate: releases.data[0]?.published_at ?? null,
      headSha: main.data.commit.sha.slice(0, 7),
      ahead,
    };
  } catch { return null; }
}

async function getLastBackup() {
  const dir = process.env.BACKUP_DIR || "/backups";
  const re = /\.(sql\.gz|sql|tar\.gz|tgz|tar|dump|zip)$/i;
  try {
    const entries = await fs.readdir(dir, { recursive: true, withFileTypes: true });
    let best: { name: string; size: number; mtime: Date; bucket: string } | null = null;
    for (const e of entries) {
      if (!e.isFile() || !re.test(e.name)) continue;
      const parent = (e as any).parentPath ?? (e as any).path ?? dir;
      const full = path.join(parent, e.name);
      const st = await fs.stat(full);
      if (!best || st.mtime > best.mtime) {
        best = { name: e.name, size: st.size, mtime: st.mtime, bucket: path.relative(dir, parent) || "(root)" };
      }
    }
    return best;
  } catch { return null; }
}

async function getMarketplaceHealth() {
  const url = process.env.MARKETPLACE_HEALTH_URL;
  if (!url) return null;
  const t0 = Date.now();
  try {
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    const latency = Date.now() - t0;
    return { ok: r.ok, status: r.status, latency };
  } catch { return null; }
}

async function getTlsExpiry(host: string): Promise<Date | null> {
  return new Promise<Date | null>((resolve) => {
    let resolved = false;
    const done = (v: Date | null) => { if (!resolved) { resolved = true; resolve(v); } };
    const socket = tls.connect(
      { host, port: 443, servername: host, rejectUnauthorized: false, timeout: 3000 },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        done(cert?.valid_to ? new Date(cert.valid_to) : null);
      },
    );
    socket.on("error", () => done(null));
    socket.on("timeout", () => { socket.destroy(); done(null); });
  });
}

function formatAge(d: Date | null): string {
  if (!d) return "n/d";
  const h = (Date.now() - d.getTime()) / 3_600_000;
  if (h < 1) return `${Math.round(h * 60)}m fa`;
  if (h < 24) return `${h.toFixed(1)}h fa`;
  return `${(h / 24).toFixed(0)}g fa`;
}

function formatSize(b: number): string {
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function freshness(d: Date | null, limitH: number): "ok" | "warn" | "err" {
  if (!d) return "err";
  const h = (Date.now() - d.getTime()) / 3_600_000;
  if (h <= limitH) return "ok";
  if (h <= limitH * 2) return "warn";
  return "err";
}

export default async function Home() {
  const s = await getSession();
  if (!s || !s.totpVerified) redirect("/login");

  const live = await getLiveVersion();
  const marketplaceDomain = process.env.MARKETPLACE_DOMAIN || "bacolionlife.it";
  const [git, lastBackup, health, tlsExpiry] = await Promise.all([
    getGitInfo(live),
    getLastBackup(),
    getMarketplaceHealth(),
    getTlsExpiry(marketplaceDomain),
  ]);

  const fresh = Number(process.env.BACKUP_FRESHNESS_HOURS || 26);
  const backupStatus = freshness(lastBackup?.mtime ?? null, fresh);
  const healthStatus: "ok" | "warn" | "err" = !health
    ? "err"
    : !health.ok ? "err" : health.latency > 1500 ? "warn" : "ok";
  const certDaysLeft = tlsExpiry ? Math.floor((tlsExpiry.getTime() - Date.now()) / 86_400_000) : null;
  const certStatus: "ok" | "warn" | "err" = certDaysLeft == null
    ? "warn"
    : certDaysLeft < 7 ? "err" : certDaysLeft < 30 ? "warn" : "ok";

  return (
    <div className="min-h-screen flex">
      <Sidebar email={s.user.email} />
      <main className="flex-1 p-8 max-w-6xl">
        <h1 className="text-2xl font-semibold mb-1">Dashboard</h1>
        <p className="text-sm text-neutral-500 mb-6">Marketplace BacoliOnLife · stato live a colpo d&apos;occhio.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* LIVE sul server */}
          <a href="/releases" className="card hover:border-brand transition">
            <div className="text-sm text-neutral-500">LIVE sul server</div>
            <div className="text-3xl font-bold mt-2">v{live.version ?? "?"}</div>
            <div className="text-sm text-neutral-400 mt-2">
              {live.commitShaShort
                ? <span className="font-mono">{live.commitShaShort}</span>
                : <span className="text-err">commit n/d</span>}
              {live.branch ? <span className="text-neutral-500"> · {live.branch}</span> : null}
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              {live.deployedAt ? `Deploy: ${formatAge(live.deployedAt)}` : "Deploy: n/d"}
            </div>
          </a>

          {/* Ultima su Git */}
          <a href="/releases" className="card hover:border-brand transition">
            <div className="text-sm text-neutral-500">Ultima su Git</div>
            <div className="text-3xl font-bold mt-2">{git?.latestTag ?? "(no tag)"}</div>
            <div className="text-xs text-neutral-400 mt-2">
              {git?.latestDate ? new Date(git.latestDate).toLocaleDateString("it-IT") : "—"}
              {git ? <span className="font-mono text-neutral-500"> · {git.headSha}</span> : null}
            </div>
            <div className="mt-2">
              {!git
                ? <span className="badge-warn">GitHub non configurato</span>
                : git.ahead == null
                  ? <span className="badge-warn">Confronto n/d</span>
                  : git.ahead === 0
                    ? <span className="badge-ok">Sincronizzata</span>
                    : <span className="badge-warn">⬆ {git.ahead} commit avanti</span>}
            </div>
          </a>

          {/* Ultimo backup */}
          <a href="/backups" className="card hover:border-brand transition">
            <div className="text-sm text-neutral-500">Ultimo backup</div>
            <div className="text-3xl font-bold mt-2">{lastBackup ? formatAge(lastBackup.mtime) : "n/d"}</div>
            <div className="text-xs text-neutral-400 mt-2">
              {lastBackup ? `${formatSize(lastBackup.size)} · ${lastBackup.bucket}` : "Nessun backup trovato"}
            </div>
            <div className="mt-2">
              <span className={backupStatus === "ok" ? "badge-ok" : backupStatus === "warn" ? "badge-warn" : "badge-err"}>
                {backupStatus.toUpperCase()}
              </span>
            </div>
          </a>

          {/* Marketplace health + TLS */}
          <a href="/infra" className="card hover:border-brand transition">
            <div className="text-sm text-neutral-500">Marketplace</div>
            <div className="text-3xl font-bold mt-2">
              {health?.ok ? `${health.latency}ms` : health ? `HTTP ${health.status}` : "DOWN"}
            </div>
            <div className="text-xs text-neutral-400 mt-2">
              {certDaysLeft != null ? `Cert TLS: scade in ${certDaysLeft}g` : "Cert TLS: n/d"}
            </div>
            <div className="mt-2 flex gap-2 flex-wrap">
              <span className={healthStatus === "ok" ? "badge-ok" : healthStatus === "warn" ? "badge-warn" : "badge-err"}>
                {healthStatus.toUpperCase()}
              </span>
              <span className={certStatus === "ok" ? "badge-ok" : certStatus === "warn" ? "badge-warn" : "badge-err"}>
                TLS {certStatus.toUpperCase()}
              </span>
            </div>
          </a>
        </div>

        <p className="text-sm text-neutral-500 mt-8">OpsConsole · {s.user.email}</p>
      </main>
    </div>
  );
}
