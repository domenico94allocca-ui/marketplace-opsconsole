import { redirect } from "next/navigation";
import fs from "node:fs/promises";
import path from "node:path";
import { getSession } from "@/lib/auth/session";
import { Sidebar } from "@/components/Sidebar";
import { audit } from "@/lib/audit/log";
import { renderMarkdown } from "@/lib/markdown/renderer";
import Link from "next/link";

export const dynamic = "force-dynamic";

async function loadRoadmap(): Promise<{ done: string[]; doing: string[]; todo: string[]; raw: string } | null> {
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "ROADMAP.md"), "utf-8");
    const sections = { done: [] as string[], doing: [] as string[], todo: [] as string[] };
    const lines = raw.split("\n");
    let current: keyof typeof sections | null = null;
    for (const line of lines) {
      if (/^##\s/.test(line)) {
        const h = line.toLowerCase();
        if (h.includes("fatto") || h.includes("✅")) current = "done";
        else if (h.includes("corso") || h.includes("🟡")) current = "doing";
        else if (h.includes("da fare") || h.includes("📋")) current = "todo";
        else current = null;
      } else if (current && /^\s*-\s*\[[ xX]\]\s+/.test(line)) {
        sections[current].push(line.replace(/^\s*-\s*\[[ xX]\]\s+/, "").trim());
      }
    }
    return { ...sections, raw };
  } catch { return null; }
}

export default async function WorkPage() {
  const s = await getSession();
  if (!s || !s.totpVerified) redirect("/login");
  await audit({ actor: s.user.email, action: "view.work" });
  const r = await loadRoadmap();

  return (
    <div className="min-h-screen flex">
      <Sidebar email={s.user.email} />
      <main className="flex-1 p-8 max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Roadmap & Lavoro</h1>
          <Link href="/work/docs" className="btn-ghost text-sm">📚 Documenti →</Link>
        </div>

        {!r && <div className="card text-err">ROADMAP.md non trovato nel repo OpsConsole.</div>}

        {r && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
              <Column title="✅ Fatto" items={r.done} color="ok" />
              <Column title="🟡 In corso" items={r.doing} color="warn" />
              <Column title="📋 Da fare" items={r.todo} color="neutral" />
            </div>

            <details className="card">
              <summary className="cursor-pointer text-sm text-neutral-400 hover:text-neutral-200">Mostra ROADMAP.md completo</summary>
              <div className="prose prose-invert text-sm mt-4" dangerouslySetInnerHTML={{ __html: renderMarkdown(r.raw) }} />
            </details>
          </>
        )}
      </main>
    </div>
  );
}

function Column({ title, items, color }: { title: string; items: string[]; color: "ok" | "warn" | "neutral" }) {
  const headerCls = color === "ok" ? "text-ok" : color === "warn" ? "text-warn" : "text-neutral-400";
  return (
    <div className="card">
      <h2 className={`text-base font-semibold mb-3 ${headerCls}`}>{title}<span className="text-neutral-500 text-xs ml-2 font-normal">({items.length})</span></h2>
      <ul className="space-y-2 text-sm">
        {items.map((it, idx) => (
          <li key={idx} className="leading-snug border-b border-neutral-800/40 pb-2">{it}</li>
        ))}
        {items.length === 0 && <li className="text-neutral-500 text-xs">Nessuna voce</li>}
      </ul>
    </div>
  );
}
