import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Octokit } from "octokit";
import { audit } from "@/lib/audit/log";
import { Sidebar } from "@/components/Sidebar";
import { getLiveVersion, type LiveInfo } from "@/lib/marketplace/version";

export const dynamic = "force-dynamic";

type GitData = {
  headSha: string;
  headMsg: string;
  headDate: string | null | undefined;
  releases: Array<{ id: number; tag_name: string; name: string | null; published_at: string | null; html_url: string }>;
  tags: Array<{ name: string; commit: { sha: string } }>;
  repoUrl: string;
  aheadFromLive: number | null;
  latestTag: string | null;
};

async function loadGit(live: LiveInfo): Promise<GitData | null> {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo  = process.env.GITHUB_REPO;
  if (!token || !owner || !repo) return null;
  const octo = new Octokit({ auth: token });
  const [main, releases, tags] = await Promise.all([
    octo.rest.repos.getBranch({ owner, repo, branch: "main" }),
    octo.rest.repos.listReleases({ owner, repo, per_page: 20 }),
    octo.rest.repos.listTags({ owner, repo, per_page: 20 }),
  ]);

  let aheadFromLive: number | null = null;
  if (live.commitSha) {
    try {
      const cmp = await octo.rest.repos.compareCommitsWithBasehead({
        owner, repo,
        basehead: `${live.commitSha}...${main.data.commit.sha}`,
      });
      aheadFromLive = cmp.data.ahead_by;
    } catch {
      aheadFromLive = null;
    }
  }

  return {
    headSha: main.data.commit.sha,
    headMsg: main.data.commit.commit.message.split("\n")[0],
    headDate: main.data.commit.commit.author?.date,
    releases: releases.data.map((r) => ({
      id: r.id, tag_name: r.tag_name, name: r.name, published_at: r.published_at, html_url: r.html_url,
    })),
    tags: tags.data.map((t) => ({ name: t.name, commit: { sha: t.commit.sha } })),
    repoUrl: `https://github.com/${owner}/${repo}`,
    aheadFromLive,
    latestTag: releases.data[0]?.tag_name ?? tags.data[0]?.name ?? null,
  };
}

function isLiveTag(tag: string, live: LiveInfo): boolean {
  if (!live.version) return false;
  return tag.replace(/^v/i, "") === live.version;
}

export default async function ReleasesPage() {
  const s = await getSession();
  if (!s || !s.totpVerified) redirect("/login");

  const live = await getLiveVersion();
  const git = await loadGit(live).catch(() => null);
  await audit({ actor: s.user.email, action: "view.releases" });

  return (
    <div className="min-h-screen flex">
      <Sidebar email={s.user.email} />
      <main className="flex-1 p-8 max-w-6xl">
        <h1 className="text-2xl font-semibold mb-6">Codice & Release</h1>

        {!git && <div className="card text-err">GitHub non configurato (GITHUB_TOKEN/OWNER/REPO).</div>}

        {git && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="card">
                <div className="text-sm text-neutral-500">LIVE sul server</div>
                <div className="text-2xl font-semibold mt-1">v{live.version ?? "?"}</div>
                <div className="text-xs text-neutral-400 mt-1 font-mono">{live.commitShaShort ?? "?"} {live.branch ? `· ${live.branch}` : ""}</div>
                <div className="text-xs text-neutral-500 mt-1">
                  {live.deployedAt ? `Deploy: ${live.deployedAt.toLocaleString("it-IT")}` : "Deploy: n/d"}
                </div>
              </div>
              <div className="card">
                <div className="text-sm text-neutral-500">Ultimo su GitHub</div>
                <div className="text-2xl font-semibold mt-1">{git.latestTag ?? "(no tag)"}</div>
                <div className="text-xs text-neutral-400 mt-1 font-mono">{git.headSha.slice(0,7)} · main</div>
                <div className="mt-2">
                  {git.aheadFromLive == null
                    ? <span className="badge-warn">Confronto non disponibile</span>
                    : git.aheadFromLive === 0
                      ? <span className="badge-ok">Sincronizzato</span>
                      : <span className="badge-warn">⬆ AGGIORNAMENTO DISPONIBILE — {git.aheadFromLive} commit dopo il LIVE</span>}
                </div>
              </div>
            </div>

            <div className="card mb-6">
              <div className="text-sm text-neutral-500">main · ultimo commit</div>
              <div className="font-mono text-sm mt-1">{git.headSha.slice(0, 12)}</div>
              <div className="mt-2">{git.headMsg}</div>
              <div className="text-xs text-neutral-500 mt-1">{git.headDate}</div>
              <a className="text-brand-light text-sm mt-3 inline-block" href={`${git.repoUrl}/commits/main`} target="_blank">Apri su GitHub →</a>
            </div>

            <h2 className="text-lg font-medium mb-3">Release</h2>
            <div className="card">
              <table className="w-full text-sm">
                <thead className="text-neutral-500 text-left">
                  <tr><th className="py-2">Tag</th><th>Pubblicata</th><th>Note</th></tr>
                </thead>
                <tbody>
                  {git.releases.map((r) => (
                    <tr key={r.id} className="border-t border-neutral-800 align-top">
                      <td className="py-2 font-mono">
                        {r.tag_name}
                        {isLiveTag(r.tag_name, live) && <span className="badge-ok ml-2">LIVE</span>}
                      </td>
                      <td className="text-neutral-400 whitespace-nowrap">{r.published_at?.slice(0, 10)}</td>
                      <td className="text-neutral-300 max-w-xl">
                        <a className="text-brand-light" href={r.html_url} target="_blank">{r.name || r.tag_name}</a>
                      </td>
                    </tr>
                  ))}
                  {git.releases.length === 0 && git.tags.length > 0 && git.tags.map((t) => (
                    <tr key={t.name} className="border-t border-neutral-800">
                      <td className="py-2 font-mono">
                        {t.name}
                        {isLiveTag(t.name, live) && <span className="badge-ok ml-2">LIVE</span>}
                      </td>
                      <td className="text-neutral-500">tag (no release)</td>
                      <td><a className="text-brand-light" href={`${git.repoUrl}/releases/tag/${t.name}`} target="_blank">{t.commit.sha.slice(0, 8)}</a></td>
                    </tr>
                  ))}
                  {git.releases.length === 0 && git.tags.length === 0 && (
                    <tr><td colSpan={3} className="py-4 text-neutral-500">Nessuna release o tag su GitHub.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
