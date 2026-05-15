import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { audit } from "@/lib/audit/log";
import fs from "node:fs";
import path from "node:path";

/**
 * GET /api/backups/download?path=<relpath>
 *
 * Streama un file backup. Sicurezza:
 *  - sessione richiesta (cookie ops_session + totpVerified)
 *  - path traversal bloccato (resolve + check prefisso BACKUP_DIR)
 *  - whitelist estensioni
 *  - audit log su ogni richiesta
 */

const BACKUP_EXT_RE = /\.(sql\.gz|sql|tar\.gz|tgz|tar|dump|zip|rdb)$/i;
const ROOT = path.resolve(process.env.BACKUP_DIR || "/backups");

export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s || !s.totpVerified) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rel = req.nextUrl.searchParams.get("path");
  if (!rel || rel.includes("\0")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // Risolvi path candidato e verifica che resti DENTRO ROOT (no traversal).
  const candidate = path.resolve(ROOT, rel.replace(/^\/+/, ""));
  if (candidate !== ROOT && !candidate.startsWith(ROOT + path.sep)) {
    await audit({
      actor: s.user.email,
      action: "backup.download.denied",
      target: rel,
      payload: { reason: "path_traversal" },
    });
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!BACKUP_EXT_RE.test(path.basename(candidate))) {
    return NextResponse.json({ error: "not_a_backup" }, { status: 400 });
  }

  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(candidate);
    if (!stat.isFile()) throw new Error("not_file");
  } catch {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ua = req.headers.get("user-agent") || undefined;
  await audit({
    actor: s.user.email,
    action: "backup.download",
    target: path.basename(candidate),
    payload: { sizeBytes: stat.size, path: path.relative(ROOT, candidate) },
    ip: ip || undefined,
    userAgent: ua,
  });

  // Streaming via Web ReadableStream da Node stream
  const nodeStream = fs.createReadStream(candidate);
  const webStream = new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer | string) => {
        const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        controller.enqueue(new Uint8Array(buf));
      });
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (e) => controller.error(e));
    },
    cancel() { nodeStream.destroy(); },
  });

  const filename = path.basename(candidate);
  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(stat.size),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
