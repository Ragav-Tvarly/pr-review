"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Run = { at: number; mode: "review" | "fix"; score: number | null; seen?: string };
const key = (repo: string, number: number) => `tvar-run:${repo}#${number}`;
const RUN_EVENT = "tvar-run-change";
const SLOW_MS = 10 * 60_000; // most reviews land in 1–5 minutes
const MAX_MS = 25 * 60_000;

function save(repo: string, number: number, run: Run | null) {
  try {
    if (run) sessionStorage.setItem(key(repo, number), JSON.stringify(run));
    else sessionStorage.removeItem(key(repo, number));
  } catch {}
  window.dispatchEvent(new Event(RUN_EVENT));
}

/** Called by the Run review / Review & fix buttons right after a successful fire. */
export function startRun(repo: string, number: number, mode: Run["mode"], score: number | null) {
  save(repo, number, { at: Date.now(), mode, score });
}

export const RUN_MAX_MS = MAX_MS;

function allRuns(): string {
  try {
    const out: Record<string, number> = {};
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith("tvar-run:")) out[k.slice("tvar-run:".length)] = (JSON.parse(sessionStorage.getItem(k)!) as Run).at;
    }
    return JSON.stringify(out);
  } catch {
    return "{}";
  }
}

/** Start times of the bot runs fired from this tab, keyed "owner/repo#number" (for the PR list). */
export function useRunStarts(): Record<string, number> {
  const raw = useSyncExternalStore(subscribe, allRuns, () => "{}");
  return useMemo(() => JSON.parse(raw) as Record<string, number>, [raw]);
}

function subscribe(cb: () => void) {
  window.addEventListener(RUN_EVENT, cb);
  return () => window.removeEventListener(RUN_EVENT, cb);
}

/**
 * Shows the state of a bot run started from this tab, refreshes the PR page every 20 s until the result
 * lands, and toasts when it does. Review mode ends at the first result; fix mode keeps watching until the
 * score reaches the bar or three rounds are posted. The dashboard cannot see the run itself (it lives in
 * the admin's Claude account), only its result on GitHub, so a run with no result is reported as
 * probably failed after 25 minutes.
 */
export function RunWatcher({ repo, number, reviewedAt, score, roundTimes, bar }: { repo: string; number: number; reviewedAt: string | null; score: number | null; roundTimes: string[]; bar: number }) {
  const router = useRouter();
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return sessionStorage.getItem(key(repo, number));
      } catch {
        return null;
      }
    },
    () => null,
  );
  const run = raw ? (JSON.parse(raw) as Run) : null;
  const [now, setNow] = useState(() => Date.now());

  // result landed?
  useEffect(() => {
    if (!run) return;
    const landed = reviewedAt && Date.parse(reviewedAt) > run.at && reviewedAt !== run.seen;
    if (!landed) return;
    const was = run.score !== null && run.score !== score ? ` (was ${run.score})` : "";
    const rounds = roundTimes.filter((t) => Date.parse(t) > run.at).length; // rounds of this run only
    const done = run.mode === "review" || (score ?? 0) >= bar || rounds >= 3;
    toast.success(`${run.mode === "fix" && !done ? "Fix round posted" : "Review done"}: score ${score}${was}.`);
    save(repo, number, done ? null : { ...run, score, seen: reviewedAt });
  }, [raw, repo, number, reviewedAt, score, roundTimes, bar]); // eslint-disable-line react-hooks/exhaustive-deps

  // poll for the result and keep the elapsed time current
  const waiting = run !== null && now - run.at <= MAX_MS;
  useEffect(() => {
    if (!waiting) return;
    const refresh = setInterval(() => router.refresh(), 20_000);
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, [waiting, router]);

  if (!run) return null;
  const elapsed = now - run.at;
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  const label = run.mode === "fix" ? "Review & fix" : "Review";

  if (elapsed > MAX_MS) {
    return (
      <div role="alert" className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-left text-xs text-amber-800 dark:text-amber-200">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <p className="flex-1">
          <span className="font-medium">No result after 25 minutes.</span> The {label.toLowerCase()} run probably failed (for example, this repository is not attached to the review bot yet). Ask the admin to check the &ldquo;tvar PR review&rdquo; routine&apos;s runs, then try again.
        </p>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" aria-label="Dismiss" onClick={() => save(repo, number, null)}>
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </div>
    );
  }
  return (
    <p role="status" className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-left text-xs">
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
      <span>
        <span className="font-medium">{label} running</span> · started {minutes === 0 ? "just now" : `${minutes} min ago`}.{" "}
        {elapsed > SLOW_MS ? "Taking longer than usual; it gives up after 25 minutes." : "The result appears here on its own, usually within a few minutes."}
      </span>
    </p>
  );
}
