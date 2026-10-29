import { AlertTriangle, CheckCircle2, CircleDashed, GitMerge, MinusCircle, XCircle } from "lucide-react";
import type { PrDetail } from "@/lib/github/pull-request";
import { cn } from "@/lib/utils";

const MERGE_STATE: Record<PrDetail["mergeStateStatus"], { text: string; tone: "ok" | "warn" | "bad" | "muted" }> = {
  CLEAN: { text: "Ready to merge", tone: "ok" },
  HAS_HOOKS: { text: "Ready to merge (hooks pending)", tone: "ok" },
  UNSTABLE: { text: "Mergeable, but checks are failing", tone: "warn" },
  BEHIND: { text: "Branch is behind the base", tone: "warn" },
  BLOCKED: { text: "Blocked by branch protection", tone: "bad" },
  DIRTY: { text: "Merge conflicts", tone: "bad" },
  DRAFT: { text: "Draft pull request", tone: "muted" },
  UNKNOWN: { text: "Mergeability not computed yet", tone: "muted" },
};

const TONE = {
  ok: "text-emerald-600 dark:text-emerald-400",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
  muted: "text-muted-foreground",
};

export function Checks({ pr }: { pr: PrDetail }) {
  const merge = MERGE_STATE[pr.mergeStateStatus];
  return (
    <section aria-labelledby="checks-heading" className="rounded-lg border border-border">
      <h2 id="checks-heading" className="border-b border-border px-4 py-2.5 text-sm font-medium">
        Checks and mergeability
      </h2>
      <ul className="divide-y divide-border text-sm">
        <li className="flex items-center gap-2 px-4 py-2.5">
          <GitMerge className={cn("h-4 w-4 shrink-0", TONE[merge.tone])} aria-hidden="true" />
          <span>{merge.text}</span>
        </li>
        {pr.checks.contexts.length === 0 && <li className="px-4 py-2.5 text-muted-foreground">No checks reported on the latest commit.</li>}
        {pr.checks.contexts.map((c) => (
          <li key={c.name} className="flex items-center gap-2 px-4 py-2.5">
            <CheckIcon state={c.state} />
            {c.url ? (
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="truncate hover:underline">
                {c.name}
              </a>
            ) : (
              <span className="truncate">{c.name}</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CheckIcon({ state }: { state: PrDetail["checks"]["contexts"][number]["state"] }) {
  const cls = "h-4 w-4 shrink-0";
  switch (state) {
    case "SUCCESS":
      return <CheckCircle2 className={cn(cls, TONE.ok)} aria-label="Passed" />;
    case "FAILURE":
      return <XCircle className={cn(cls, TONE.bad)} aria-label="Failed" />;
    case "PENDING":
      return <CircleDashed className={cn(cls, TONE.warn)} aria-label="Pending" />;
    case "SKIPPED":
    case "NEUTRAL":
      return <MinusCircle className={cn(cls, TONE.muted)} aria-label="Skipped" />;
    default:
      return <AlertTriangle className={cn(cls, TONE.muted)} aria-label="Unknown" />;
  }
}
