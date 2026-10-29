export const RISKS = ["critical", "high", "important", "normal", "low", "safe"] as const;
export type Risk = (typeof RISKS)[number];

export const RISK_LABEL_PREFIX = "risk: ";
export const REVIEW_MARKER = "<!-- tvar-review:v1";

export function riskFromLabels(labels: string[]): Risk | null {
  for (const label of labels) {
    if (!label.startsWith(RISK_LABEL_PREFIX)) continue;
    const value = label.slice(RISK_LABEL_PREFIX.length) as Risk;
    if (RISKS.includes(value)) return value;
  }
  return null;
}

export type Severity = "critical" | "warning" | "suggestion" | "none";
export type Gate = "auto-fix" | "ask" | "skip";
export type Verdict = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";

export type Finding = {
  id: string; // C1, W2, S3 — stable across rounds
  severity: Exclude<Severity, "none">;
  category: string;
  path?: string;
  line?: number;
  side?: "LEFT" | "RIGHT";
  title: string;
  fix?: string;
  gate: Gate;
  /** ask-gated findings: the product question and the options the bot sees */
  question?: string;
  options?: string[];
  /** GitHub review-comment id, filled by post-review.sh so the dashboard can reply on the thread */
  commentId?: number;
  /** set in later rounds */
  status?: "open" | "fixed" | "partially-fixed" | "not-fixed" | "decided";
  decision?: string;
};

export type FileScore = { path: string; importance: number; severity: Severity; reason: string; noise: boolean };

export type Round = { n: number; headSha: string; score: number; fixed: string[]; at: string };

export type TvarReview = {
  v: 1;
  pr: number;
  headSha: string;
  reviewedAt: string;
  mode: "review" | "fix";
  risk: Risk;
  score: number; // 0–100, 100 = safest
  verdict: Verdict;
  summary: string;
  scope: { skipped: string[]; skimmed: string[]; note: string };
  findings: Finding[];
  files: FileScore[];
  rounds: Round[];
};

export function grade(score: number): "A" | "B" | "C" | "D" | "F" {
  return score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
}
