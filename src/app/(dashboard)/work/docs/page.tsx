import { redirect } from "next/navigation";
import fs from "node:fs/promises";
import path from "node:path";
import { getSession } from "@/lib/auth/session";
import { Sidebar } from "@/components/Sidebar";
import { audit } from "@/lib/audit/log";
import Link from "next/link";

export const dynamic = "force-dynamic";

type DocFile = { name: string; relPath: string; size: number; mtime: Date; preview: string };

async function listDocs(): Promise<DocFile[]> {
  const roots = [
    path.join(process.cwd(), "docs"),
    path.join(process.cwd()),  // per ROADMAP.md, README.md, CHANGELOG.md
  ];
  const out: DocFile[] = [];
  for (const root of roots) {
    try {
      const entries = await fs.readdir(root, { recursive: true, withFileTypes: true });
      for (const e of entries) {
        if (!e.isFile() || !e.name.toLowerCase().endsWith(".md")) continue;
        const parent = (e as any).parentPath ?? (e as any).path ?? root;
        const full = path.join(parent, e.name);
        // Solo top-level del cwd: evita di prendere node_modules ecc.
        if (root === process.cwd() && path.relative(root, full).includes(path.sep)) continue;
        try {
          const st = await fs.stat(full);
          const text = await fs.readFile(full, "utf-8");
          const preview = text.split("\n").slice(0, 3).join(" ").slice(0, 180);
          out.push({
            name: e.name,
            relPath: path.relative(process.cwd(), full),
            size: st.size,
            mtime: st.mtime,
            preview,
          });
        } catch {}
      }
    } catch {}
  }
  // Dedup
  const seen = new Set<string>();
  return out.filter((d) => { if (seen.has(d.relPath)) return false; seen.add(d.relPath); return true; })
            .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
}

export default async function DocsPage() {
  const s = await getSession();
  if (!s || !s.totpVerified) redirect("/login");
  await audit({ actor: s.user.email, action: "view.docs.list" });
  const docs = await listDocs();

  return (
    <div className="min-h-screen flex">
      <Sidebar email={s.user.email} />
      <main className="flex-1 p-8 max-w-5xl">
        <div className="mb-4"><Link href="/work" className="text-brand-light text-sm">← Roadmap</Link></div>
        <h1 className="text-2xl font-semibold mb-6">Documentazione</h1>

        <div className="grid gap-3">
          {docs.map((d) => (
            <Link
              key={d.relPath}
              href={`/work/docs/${encodeURIComponent(d.relPath)}`}
              className="card hover:border-brand transition block"
            >
              <div className="flex items-baseline justify-between gap-4">
                <div className="font-mono text-sm">{d.relPath}</div>
                <div className="text-xs text-neutral-500 whitespace-nowrap">{d.mtime.toLocaleDateString("it-IT")} · {Math.round(d.size / 1024)} KB</div>
              </div>
              <div className="text-xs text-neutral-400 mt-2 line-clamp-2">{d.preview}</div>
            </Link>
          ))}
          {docs.length === 0 && <div className="card text-neutral-500">Nessun documento trovato</div>}
        </div>
      </main>
    </div>
  );
}
