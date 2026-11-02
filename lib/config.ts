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
 * Senior dev(s) who give the final review and merge (FINAL_REVIEWER, comma-separated; offered in
 * "Request review"). They see and act on every PR; everyone else sees only the PRs they opened.
 */
export function seniors(): string[] {
  const list = (process.env.FINAL_REVIEWER ?? "tvardev").split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : ["tvardev"];
}

export function isSenior(login: string): boolean {
  return seniors().some((s) => s.toLowerCase() === login.toLowerCase());
}

/** Devs only work on their own PRs; seniors on all. */
export function canSeePr(viewer: { login: string; isSenior: boolean }, author: string): boolean {
  return viewer.isSenior || viewer.login.toLowerCase() === author.toLowerCase();
}
