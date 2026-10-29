/** Repos shown on the dashboard, "owner/name" each. The first one gates sign-in. */
export function repos(): string[] {
  return (process.env.GITHUB_REPOS ?? "tvardev/tvar-business")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function primaryRepo(): string {
  return repos()[0] ?? "tvardev/tvar-business";
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
