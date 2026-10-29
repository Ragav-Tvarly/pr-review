"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PrSummary } from "@/lib/github/pulls";
import { fireReviews } from "@/lib/review/fire";

export const NOT_CONFIGURED = "The review task is not connected yet. Set ROUTINE_FIRE_URL and ROUTINE_FIRE_TOKEN from the scheduled task owned by admin@tvarlaunchpad.com.";

/** "Score all PRs" (unscored, non-draft) or "Score N selected", firing the review task once per PR. */
export function ScoreButton({ selected, all }: { selected: PrSummary[]; all: PrSummary[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const targets = selected.length > 0 ? selected : all.filter((p) => !p.isDraft && !p.risk);
  const label = selected.length > 0 ? `Score ${selected.length} selected` : "Score all PRs";

  const run = () =>
    start(async () => {
      const byRepo = new Map<string, number[]>();
      for (const pr of targets) byRepo.set(pr.repo, [...(byRepo.get(pr.repo) ?? []), pr.number]);
      let fired = 0;
      for (const [repo, numbers] of byRepo) {
        const res = await fireReviews(repo, numbers);
        if (!res.configured) {
          toast.error(NOT_CONFIGURED);
          return;
        }
        fired += res.fired.length;
        for (const f of res.failed) toast.error(`#${f.number}: ${f.error}`);
      }
      if (fired > 0) {
        toast.success(`Review started for ${fired} ${fired === 1 ? "PR" : "PRs"}. Results land on GitHub in a few minutes.`);
        router.refresh();
      }
    });

  return (
    <Button size="sm" variant="secondary" onClick={run} disabled={pending || targets.length === 0} aria-busy={pending}>
      <Sparkles className="mr-1.5 h-4 w-4" aria-hidden="true" />
      {pending ? "Starting…" : label}
    </Button>
  );
}
