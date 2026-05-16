import { redirect, notFound } from "next/navigation";
import fs from "node:fs/promises";
import path from "node:path";
import { getSession } from "@/lib/auth/session";
import { Sidebar } from "@/components/Sidebar";
import { audit } from "@/lib/audit/log";
import { renderMarkdown } from "@/lib/markdown/renderer";
import Link from "next/link";

export const dynamic = "force-dynamic";

const ROOT = path.resolve(process.cwd());

export default async function DocView({ params }: { params: Promise<{ name: string }> }) {
  const s = await getSession();
  if (!s || !s.totpVerified) redirect("/login");
  const { name } = await params;
  const rel = decodeURIComponent(name);

  const target = path.resolve(ROOT, rel);
  if (target !== ROOT && !target.startsWith(ROOT + path.sep)) return notFound();
  if (!target.toLowerCase().endsWith(".md")) return notFound();

  let body = "";
  try { body = await fs.readFile(target, "utf-8"); }
  catch { return notFound(); }

  await audit({ actor: s.user.email, action: "view.docs.read", target: rel });
  const html = renderMarkdown(body);

  return (
    <div className="min-h-screen flex">
      <Sidebar email={s.user.email} />
      <main className="flex-1 p-8 max-w-4xl">
        <div className="mb-4">
          <Link href="/work/docs" className="text-brand-light text-sm">← Tutti i documenti</Link>
        </div>
        <div className="text-xs text-neutral-500 mb-2 font-mono">{rel}</div>
        <article className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
      </main>
    </div>
  );
}
