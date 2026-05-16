/**
 * Scanner del codice marketplace (montato RO su /marketplace).
 * Estrae:
 *  - Pagine pubbliche Next.js (frontend/src/app/**\/page.tsx → URL)
 *  - API endpoint Express (backend/src/index.ts → /api/*)
 */
import fs from "node:fs/promises";
import path from "node:path";

const MARKETPLACE_ROOT = process.env.MARKETPLACE_FS_ROOT || "/marketplace";

export type PublicPage = { url: string; file: string; isDynamic: boolean };
export type ApiEndpoint = { path: string; method: string; source: string };

async function exists(p: string) {
  try { await fs.access(p); return true; } catch { return false; }
}

export async function listPublicPages(): Promise<PublicPage[] | null> {
  const root = path.join(MARKETPLACE_ROOT, "frontend/src/app");
  if (!(await exists(root))) return null;
  const out: PublicPage[] = [];
  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        // Salta directory speciali ((auth), (admin), api, _components, ecc.)
        if (e.name === "api" || e.name.startsWith("_")) continue;
        await walk(full);
      } else if (e.name === "page.tsx" || e.name === "page.jsx") {
        let rel = path.relative(root, path.dirname(full));
        // Rimuovi segmenti di route group "(group)" che non influenzano l'URL
        rel = rel.split(path.sep).filter((seg) => !(seg.startsWith("(") && seg.endsWith(")"))).join("/");
        const url = "/" + rel;
        const cleanUrl = url === "/" ? "/" : url.replace(/\/+/g, "/").replace(/\/$/, "");
        out.push({
          url: cleanUrl || "/",
          file: path.relative(MARKETPLACE_ROOT, full),
          isDynamic: /\[[^\]]+\]/.test(cleanUrl),
        });
      }
    }
  }
  await walk(root);
  return out.sort((a, b) => a.url.localeCompare(b.url));
}

export async function listApiEndpoints(): Promise<ApiEndpoint[] | null> {
  const file = path.join(MARKETPLACE_ROOT, "backend/src/index.ts");
  if (!(await exists(file))) return null;
  const src = await fs.readFile(file, "utf-8");
  const out: ApiEndpoint[] = [];
  // Match: app.use('/api/xxx', ...)
  for (const m of src.matchAll(/app\.use\(\s*['"]([^'"]+)['"]/g)) {
    if (m[1].startsWith("/api/") || m[1] === "/uploads") {
      out.push({ path: m[1], method: "ALL", source: "backend/src/index.ts" });
    }
  }
  // Match: app.get('/path', ...) , app.post(...) ecc.
  for (const m of src.matchAll(/app\.(get|post|put|patch|delete)\(\s*['"]([^'"]+)['"]/g)) {
    out.push({ path: m[2], method: m[1].toUpperCase(), source: "backend/src/index.ts" });
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export async function readMarketplaceDoc(name: "PRODUCT" | "FEATURES"): Promise<string | null> {
  // Cerca prima nel marketplace (se documenti lì), poi nella console
  const candidates = [
    path.join(MARKETPLACE_ROOT, "docs", `${name}.md`),
    path.join(process.cwd(), "docs", "marketplace", `${name}.md`),
  ];
  for (const c of candidates) {
    if (await exists(c)) return fs.readFile(c, "utf-8");
  }
  return null;
}
