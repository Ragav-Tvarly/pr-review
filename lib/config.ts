/**
 * Repos enabled for the review bot, "owner/name" each. A repo is enabled once the Claude GitHub App is
 * installed on it, TvarReview is a Write collaborator and it is attached to the routine (review/README.md).
 * Each user sees only the enabled repos they can access; sign-in needs at least one.
 */
export function repos(): string[] {
  return (process.env.GITHUB_REPOS ?? "tvardev/tvar-business")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * ponytail: dev-only bypass so the UI can be exercised with real data before a
 * GitHub OAuth App exists. Pass it in the shell env (`GITHUB_DEV_TOKEN=$(gh auth token) npm run dev`);
 * never write it to a file. Ignored in production builds.
 */
export function devToken(): string | undefined {
  if (process.env.NODE_ENV === "production") return undefined;
  return process.env.GITHUB_DEV_TOKEN || undefined;
}

/** Quality score a PR must reach before the fix loop stops (0–100). */
export function scoreBar(): number {
  const n = Number(process.env.REVIEW_SCORE_BAR);
  return Number.isFinite(n) && n > 0 && n <= 100 ? n : 80;
}

/**
 * Senior dev(s): they see and act on every PR in a repo, do the final review and merge; everyone else sees
 * only the PRs they opened. FINAL_REVIEWER is comma-separated: a bare login is a default senior for every
 * repo, "owner/repo=login" sets the senior(s) of that repo instead (e.g. "tvardev,Tvar-Launchpad/tecoloti=Ragav-Tvarly").
 */
export function seniorsFor(repo: string): string[] {
  const entries = (process.env.FINAL_REVIEWER ?? "tvardev").split(",").map((s) => s.trim()).filter(Boolean);
  const own = entries.filter((e) => e.includes("=") && e.split("=")[0]!.trim().toLowerCase() === repo.toLowerCase()).map((e) => e.split("=")[1]!.trim());
  if (own.length) return own;
  const defaults = entries.filter((e) => !e.includes("="));
  return defaults.length ? defaults : ["tvardev"];
}

/** The repos (of those given) where this login is a senior. */
export function seniorRepos(login: string, repoList: string[]): string[] {
  return repoList.filter((r) => seniorsFor(r).some((s) => s.toLowerCase() === login.toLowerCase()));
}

/** Seniors of the repo see every PR there; others only their own. */
export function canSeePr(viewer: { login: string; seniorRepos: string[] }, repo: string, author: string): boolean {
  return viewer.seniorRepos.some((r) => r.toLowerCase() === repo.toLowerCase()) || viewer.login.toLowerCase() === author.toLowerCase();
}
