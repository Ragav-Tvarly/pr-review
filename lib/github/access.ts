import { repos } from "@/lib/config";

export type RepoAccess = { repos: string[]; pushRepos: string[] };

/**
 * Which of the bot-enabled repos (GITHUB_REPOS) this GitHub token can read, and which it can push to.
 * Repos the user cannot see are simply left out, so each person only gets the enabled repos they belong to.
 */
export async function repoAccess(token: string): Promise<RepoAccess> {
  const results = await Promise.all(
    repos().map(async (repo) => {
      const res = await fetch(`https://api.github.com/repos/${repo}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
        cache: "no-store",
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { permissions?: { push?: boolean } };
      return { repo, push: Boolean(json.permissions?.push) };
    }),
  );
  const ok = results.filter((r) => r !== null);
  return { repos: ok.map((r) => r.repo), pushRepos: ok.filter((r) => r.push).map((r) => r.repo) };
}

/** Case-insensitive membership, since URLs and GitHub may differ in case. */
export function hasRepo(list: string[], repo: string): boolean {
  const r = repo.toLowerCase();
  return list.some((x) => x.toLowerCase() === r);
}
