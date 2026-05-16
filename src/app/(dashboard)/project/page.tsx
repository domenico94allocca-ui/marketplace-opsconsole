import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Sidebar } from "@/components/Sidebar";
import { audit } from "@/lib/audit/log";
import { listPublicPages, listApiEndpoints, readMarketplaceDoc } from "@/lib/project/scanner";
import { renderMarkdown } from "@/lib/markdown/renderer";

export const dynamic = "force-dynamic";

export default async function ProjectPage() {
  const s = await getSession();
  if (!s || !s.totpVerified) redirect("/login");
  await audit({ actor: s.user.email, action: "view.project" });

  const [pages, apis, productMd, featuresMd] = await Promise.all([
    listPublicPages().catch(() => null),
    listApiEndpoints().catch(() => null),
    readMarketplaceDoc("PRODUCT"),
    readMarketplaceDoc("FEATURES"),
  ]);

  const fsRoot = process.env.MARKETPLACE_FS_ROOT || "/marketplace";

  return (
    <div className="min-h-screen flex">
      <Sidebar email={s.user.email} />
      <main className="flex-1 p-8 max-w-6xl">
        <h1 className="text-2xl font-semibold mb-2">Progetto Marketplace</h1>
        <p className="text-sm text-neutral-500 mb-6">Panoramica prodotto + analisi automatica del codice live sul server.</p>

        {productMd && (
          <section className="card mb-8">
            <h2 className="text-lg font-semibold mb-3">Overview prodotto</h2>
            <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(productMd) }} />
          </section>
        )}

        <section className="card mb-8">
          <h2 className="text-lg font-semibold mb-3">Pagine pubbliche <span className="text-sm text-neutral-500 font-normal">({pages?.length ?? "—"})</span></h2>
          {!pages && <div className="text-neutral-500 text-sm">Codice marketplace non leggibile (mount RO {fsRoot} mancante?)</div>}
          {pages && (
            <table className="w-full text-sm">
              <thead className="text-neutral-500 text-left">
                <tr><th className="py-2">URL</th><th>File</th><th></th></tr>
              </thead>
              <tbody>
                {pages.map((p) => (
                  <tr key={p.url + p.file} className="border-t border-neutral-800">
                    <td className="py-1 font-mono text-xs">{p.url}{p.isDynamic && <span className="badge-warn text-[10px] ml-2">dyn</span>}</td>
                    <td className="text-neutral-500 text-xs font-mono">{p.file}</td>
                    <td className="text-right">
                      <a className="text-brand-light text-xs" href={`https://${process.env.MARKETPLACE_DOMAIN || "bacolionlife.it"}${p.url}`} target="_blank" rel="noopener">Apri →</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card mb-8">
          <h2 className="text-lg font-semibold mb-3">API endpoint <span className="text-sm text-neutral-500 font-normal">({apis?.length ?? "—"})</span></h2>
          {!apis && <div className="text-neutral-500 text-sm">backend/src/index.ts non leggibile</div>}
          {apis && (
            <table className="w-full text-sm">
              <thead className="text-neutral-500 text-left">
                <tr><th className="py-2">Metodo</th><th>Path</th><th>Source</th></tr>
              </thead>
              <tbody>
                {apis.map((a, idx) => (
                  <tr key={`${a.path}-${idx}`} className="border-t border-neutral-800">
                    <td className="py-1 text-xs"><span className={`badge ${a.method === "ALL" ? "bg-neutral-700 text-neutral-200" : "bg-brand/30 text-brand-light"}`}>{a.method}</span></td>
                    <td className="font-mono text-xs">{a.path}</td>
                    <td className="text-neutral-500 text-xs font-mono">{a.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {featuresMd && (
          <section className="card mb-8">
            <h2 className="text-lg font-semibold mb-3">Funzioni chiave</h2>
            <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(featuresMd) }} />
          </section>
        )}
      </main>
    </div>
  );
}
