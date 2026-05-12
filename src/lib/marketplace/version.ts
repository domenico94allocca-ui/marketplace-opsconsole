import fs from "node:fs/promises";
import path from "node:path";

const MK = process.env.MARKETPLACE_PATH || "/marketplace";

export type LiveInfo = {
  version: string | null;
  commitSha: string | null;
  commitShaShort: string | null;
  branch: string | null;
  deployedAt: Date | null;
  source: string | null; // da quale package.json arriva la version
};

async function readJson(p: string): Promise<any | null> {
  try {
    return JSON.parse(await fs.readFile(p, "utf8"));
  } catch {
    return null;
  }
}

async function statMtime(p: string): Promise<Date | null> {
  try {
    return (await fs.stat(p)).mtime;
  } catch {
    return null;
  }
}

async function resolveGit(): Promise<{ sha: string | null; branch: string | null; refMtime: Date | null }> {
  try {
    const headPath = `${MK}/.git/HEAD`;
    const head = (await fs.readFile(headPath, "utf8")).trim();
    if (!head.startsWith("ref:")) {
      // Detached HEAD
      return { sha: head, branch: null, refMtime: await statMtime(headPath) };
    }
    const ref = head.slice(4).trim();
    const branch = ref.replace(/^refs\/heads\//, "");
    const refPath = `${MK}/.git/${ref}`;
    try {
      const sha = (await fs.readFile(refPath, "utf8")).trim();
      return { sha, branch, refMtime: await statMtime(refPath) };
    } catch {
      // Try packed-refs
      try {
        const packed = await fs.readFile(`${MK}/.git/packed-refs`, "utf8");
        for (const line of packed.split("\n")) {
          if (line.startsWith("#") || !line.trim()) continue;
          const [sha, packedRef] = line.split(/\s+/);
          if (packedRef === ref) {
            return { sha, branch, refMtime: await statMtime(`${MK}/.git/packed-refs`) };
          }
        }
      } catch {}
      return { sha: null, branch, refMtime: null };
    }
  } catch {
    return { sha: null, branch: null, refMtime: null };
  }
}

async function findVersion(): Promise<{ version: string | null; source: string | null }> {
  // Cerca prima nei subdir tipici di un monorepo, poi root.
  const candidates = [
    "frontend/package.json",
    "backend/package.json",
    "mobile/package.json",
    "package.json",
  ];
  for (const rel of candidates) {
    const pkg = await readJson(path.join(MK, rel));
    if (pkg?.version) return { version: pkg.version, source: rel };
  }
  return { version: null, source: null };
}

export async function getLiveVersion(): Promise<LiveInfo> {
  const [release, ver, git] = await Promise.all([
    readJson(`${MK}/RELEASE.json`),
    findVersion(),
    resolveGit(),
  ]);

  const sha = release?.commitSha ?? git.sha;
  const deployedAt = release?.deployedAt
    ? new Date(release.deployedAt)
    : git.refMtime ?? null;

  return {
    version: release?.version ?? ver.version,
    commitSha: sha,
    commitShaShort: sha ? sha.slice(0, 7) : null,
    branch: git.branch,
    deployedAt,
    source: release ? "RELEASE.json" : ver.source,
  };
}
