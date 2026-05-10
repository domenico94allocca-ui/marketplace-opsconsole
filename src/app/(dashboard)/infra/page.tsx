import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listContainers, dockerInfo } from "@/lib/docker/client";
import { audit } from "@/lib/audit/log";
import { Sidebar } from "@/components/Sidebar";

export const dynamic = "force-dynamic";

export default async function InfraPage() {
  const s = await getSession();
  if (!s || !s.totpVerified) redirect("/login");

  const [containers, info] = await Promise.all([
    safe(listContainers),
    safe(dockerInfo),
  ]);
  await audit({ actor: s.user.email, action: "view.infra.containers" });

  return (
    <div className="min-h-screen flex">
      <Sidebar email={s.user.email} />
      <main className="flex-1 p-8 max-w-6xl">
        <h1 className="text-2xl font-semibold mb-2">Infrastruttura</h1>
        <p className="text-sm text-neutral-500 mb-6">
          Host: {(info as any)?.Name ?? "n/d"} · Containers: {(info as any)?.Containers ?? "?"} · Running: {(info as any)?.ContainersRunning ?? "?"} · OS: {(info as any)?.OperatingSystem ?? "?"}
        </p>
        <div className="card">
          <table className="w-full text-sm">
            <thead className="text-neutral-500 text-left">
              <tr>
                <th className="py-2">Container</th><th>Stato</th><th>Image</th><th>Porte</th>
              </tr>
            </thead>
            <tbody>
              {(containers ?? []).map((c) => (
                <tr key={c.Id} className="border-t border-neutral-800">
                  <td className="py-2">{c.Names?.[0]?.replace(/^\//, "") ?? c.Id.slice(0, 12)}</td>
                  <td>
                    <span className={c.State === "running" ? "badge-ok" : "badge-err"}>{c.State}</span>
                  </td>
                  <td className="text-neutral-400">{c.Image}</td>
                  <td className="text-neutral-400">
                    {(c.Ports ?? []).map((p) => `${p.PublicPort ?? ""}${p.PublicPort ? "→" : ""}${p.PrivatePort}/${p.Type}`).filter(Boolean).join(", ")}
                  </td>
                </tr>
              ))}
              {!containers && <tr><td colSpan={4} className="py-4 text-err">Errore lettura docker socket-proxy</td></tr>}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch { return null; }
}
