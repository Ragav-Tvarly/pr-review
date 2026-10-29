import { REVIEW_MARKER, RISKS, type TvarReview } from "./types.ts";

export type ParsedReview = { review: TvarReview; stale: boolean; commentId: number; url: string };

/** Pull the JSON block out of a sticky comment body. Returns null for anything that is not a v1 review. */
export function parseMarker(body: string): TvarReview | null {
  const start = body.indexOf(REVIEW_MARKER);
  if (start < 0) return null;
  const jsonStart = start + REVIEW_MARKER.length;
  const end = body.indexOf("-->", jsonStart);
  if (end < 0) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(body.slice(jsonStart, end).trim());
  } catch {
    return null;
  }
  if (!isReview(raw)) return null;
  return { ...raw, findings: raw.findings ?? [], files: raw.files ?? [], rounds: raw.rounds ?? [], scope: raw.scope ?? { skipped: [], skimmed: [], note: "" } };
}

function isReview(x: unknown): x is TvarReview {
  if (!x || typeof x !== "object") return false;
  const r = x as Record<string, unknown>;
  return (
    r.v === 1 &&
    typeof r.pr === "number" &&
    typeof r.headSha === "string" &&
    typeof r.score === "number" &&
    typeof r.risk === "string" &&
    (RISKS as readonly string[]).includes(r.risk) &&
    typeof r.verdict === "string" &&
    typeof r.summary === "string"
  );
}

/** The latest bot review on a PR (newest matching comment wins) and whether it predates the current head. */
export function findReview(
  comments: { id: number; body: string; url: string; createdAt: string }[],
  headSha: string,
): ParsedReview | null {
  const sorted = [...comments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const c of sorted) {
    const review = parseMarker(c.body);
    if (review) return { review, stale: review.headSha !== headSha, commentId: c.id, url: c.url };
  }
  return null;
}
