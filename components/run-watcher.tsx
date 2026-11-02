"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Run = { at: number; mode: "review" | "fix"; score: number | null; seen?: string };
const key = (repo: string, number: number) => `tvar-run:${repo}#${number}`;
const MAX_MS = 25 * 60_000;

/** Called by the Run review / Review & fix buttons right after a successful fire. */
export function startRun(repo: string, number: number, mode: Run["mode"], score: number | null) {
  sessionStorage.setItem(key(repo, number), JSON.stringify({ at: Date.now(), mode, score } satisfies Run));
}

/**
 * While a bot run started from this tab is in progress, refresh the PR page every 20 s and toast when a
 * new review lands. Review mode ends at the first result; fix mode keeps watching until the score
 * reaches the bar, three rounds are posted, or 25 minutes pass.
 */
export function RunWatcher({ repo, number, reviewedAt, score, roundTimes, bar }: { repo: string; number: number; reviewedAt: string | null; score: number | null; roundTimes: string[]; bar: number }) {
  const router = useRouter();
  useEffect(() => {
    const raw = sessionStorage.getItem(key(repo, number));
    if (!raw) return;
    const run = JSON.parse(raw) as Run;
    const landed = reviewedAt && Date.parse(reviewedAt) > run.at && reviewedAt !== run.seen;
    if (landed) {
      const was = run.score !== null && run.score !== score ? ` (was ${run.score})` : "";
      const rounds = roundTimes.filter((t) => Date.parse(t) > run.at).length; // rounds of this run only
      const done = run.mode === "review" || (score ?? 0) >= bar || rounds >= 3;
      toast.success(`${run.mode === "fix" && !done ? "Fix round posted" : "Review done"}: score ${score}${was}.`);
      if (done) return void sessionStorage.removeItem(key(repo, number));
      sessionStorage.setItem(key(repo, number), JSON.stringify({ ...run, score, seen: reviewedAt }));
    }
    if (Date.now() - run.at > MAX_MS) return void sessionStorage.removeItem(key(repo, number));
    const t = setTimeout(() => router.refresh(), 20_000);
    return () => clearTimeout(t);
  }, [repo, number, reviewedAt, score, roundTimes, bar, router]);
  return null;
}
