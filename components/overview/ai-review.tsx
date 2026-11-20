import { AlertTriangle, CheckCircle2, Clock, HelpCircle, Sparkles, Vote } from "lucide-react";
import { Confetti } from "@/components/confetti";
import { DecisionReply } from "@/components/overview/decision-reply";
import { FindingHeader } from "@/components/overview/finding-header";
import { FindingReview } from "@/components/overview/finding-review";
import { ReviewButtons } from "@/components/review-buttons";
import { RunWatcher } from "@/components/run-watcher";
import { RiskBadge } from "@/components/risk-badge";
import { ScoreRing } from "@/components/score-ring";
import type { PrDetail } from "@/lib/github/pull-request";
import { timeAgo } from "@/lib/format";
import { prPath } from "@/lib/paths";
import type { Answer } from "@/lib/review/answers";
import type { Finding } from "@/lib/review/types";
import { cn } from "@/lib/utils";
import { CollapsibleSection } from "@/components/collapsible-section";

const VERDICT = {
  APPROVE: { text: "Approve", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  REQUEST_CHANGES: { text: "Changes requested", cls: "bg-red-500/15 text-red-700 dark:text-red-300" },
  COMMENT: { text: "Comments", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
};

export function AiReview({ pr, canPush, bar, answers = {}, isReviewer = false }: { pr: PrDetail; canPush: boolean; bar: number; answers?: Record<number, Answer>; isReviewer?: boolean }) {
  const parsed = pr.review;
  if (!parsed) {
    return (
      <section aria-labelledby="ai-heading" className="rounded-lg border border-dashed border-border p-6 text-center">
        <Sparkles className="mx-auto h-6 w-6 text-primary" aria-hidden="true" />
        <h2 id="ai-heading" className="mt-2 font-medium">
          Not reviewed yet
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Run the Claude review to get a quality score, risk rating and findings posted on this PR&apos;s thread.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <ReviewButtons repo={pr.repo} number={pr.number} canPush={canPush} bar={bar} hasReview={false} size="default" />
        </div>
        <div className="mx-auto mt-4 max-w-md">
          <RunWatcher repo={pr.repo} number={pr.number} reviewedAt={null} score={null} roundTimes={[]} bar={bar} />
        </div>
      </section>
    );
  }
  const { review, stale, url } = parsed;
  const verdict = VERDICT[review.verdict] ?? VERDICT.COMMENT;
  const filesHref = prPath(pr, "files");
  const answerOf = (f: Finding) => (f.commentId ? answers[f.commentId] : undefined);
  // rejected by a reviewer: by the bot on a later run, or already replied "Not an issue: …" on its thread
  const rejection = (f: Finding) => (f.status === "dismissed" ? (f.dismissal ?? "") : f.gate !== "ask" && /^not an issue\b/i.test(answerOf(f)?.body ?? "") ? answerOf(f)!.body.replace(/^not an issue:?\s*/i, "") : null);
  const dismissed = review.findings.filter((f) => rejection(f) !== null);
  const open = review.findings.filter((f) => f.status !== "fixed" && f.status !== "decided" && rejection(f) === null);
  const asks = open.filter((f) => f.gate === "ask");
  // answered on the thread, or already applied by the bot: shown with the decision so the senior sees what was chosen
  const decided = review.findings.filter((f) => f.gate === "ask" && (f.status === "decided" || (f.status === "fixed" && (f.decision || answerOf(f)))));

  return (
    <section aria-labelledby="ai-heading" className="space-y-4">
      {!stale && review.score >= bar && <Confetti once={`bar:${pr.repo}#${pr.number}:${review.headSha}`} />}
      {stale && (
        <p role="status" className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
          New commits since this review. Scores and findings may be out of date.
        </p>
      )}
      <div className="rounded-lg border border-border">
        <div className="flex flex-col gap-5 border-b border-border p-5 sm:flex-row sm:items-center">
          <ScoreRing score={review.score} bar={bar} className="self-center" />
          <div className="min-w-0 flex-1 space-y-2">
            <h2 id="ai-heading" className="flex flex-wrap items-center gap-2 text-base font-semibold">
              Claude review
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", verdict.cls)}>{verdict.text}</span>
              <RiskBadge risk={review.risk} />
              {review.score >= bar ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> above the bar ({bar})
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {bar - review.score} below the bar ({bar})
                </span>
              )}
            </h2>
            <p className="text-sm leading-relaxed">{review.summary}</p>
            <p className="text-xs text-muted-foreground">
              Reviewed {timeAgo(review.reviewedAt)} · {review.findings.length} findings ·{" "}
              <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
                full report on GitHub
              </a>
            </p>
            {review.rounds.length > 1 && <Trajectory rounds={review.rounds} bar={bar} />}
            <RunWatcher repo={pr.repo} number={pr.number} reviewedAt={review.reviewedAt} score={review.score} roundTimes={review.rounds.map((r) => r.at)} bar={bar} />
          </div>
          <div className="flex flex-wrap gap-2 sm:flex-col">
            <ReviewButtons repo={pr.repo} number={pr.number} canPush={canPush} bar={bar} hasReview score={review.score} />
          </div>
        </div>

        <CollapsibleSection id="ai-details" bare title={`Findings and decisions · ${open.length} open`}>
        {asks.length > 0 && (
          <div className="border-b border-border p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <HelpCircle className="h-4 w-4 text-sky-500" aria-hidden="true" />
              Decisions needed ({asks.length})
            </h3>
            <ol className="space-y-4">
              {asks.map((f) => (
                <li key={f.id} className="rounded-md border border-sky-500/30 bg-sky-500/5 p-3">
                  <FindingHeader filesHref={filesHref} f={f} />
                  {f.question && <p className="mt-1.5 text-sm">{f.question}</p>}
                  <div className="mt-3">
                    {answerOf(f) ? (
                      <PendingAnswer answer={answerOf(f)!} canPush={canPush} />
                    ) : f.commentId ? (
                      <DecisionReply repo={pr.repo} number={pr.number} commentId={f.commentId} options={f.options ?? []} />
                    ) : (
                      <p className="text-xs text-muted-foreground">Reply on the GitHub thread to decide.</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {decided.length > 0 && (
          <div className="border-b border-border p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Vote className="h-4 w-4 text-emerald-500" aria-hidden="true" />
              Decisions made ({decided.length})
            </h3>
            <ol className="space-y-3">
              {decided.map((f) => {
                const a = answerOf(f);
                return (
                  <li key={f.id} className="rounded-md border border-border p-3">
                    <FindingHeader filesHref={filesHref} f={f} />
                    {f.question && <p className="mt-1.5 text-sm text-muted-foreground">{f.question}</p>}
                    <p className="mt-1.5 text-sm">
                      <span className="font-medium">Decision:</span> {f.decision || a?.body}
                      {a && (
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          · <a href={a.url} target="_blank" rel="noopener noreferrer" className="underline">{a.author}, {timeAgo(a.createdAt)}</a>
                        </span>
                      )}
                      {f.status === "fixed" && <span className="text-xs text-emerald-600 dark:text-emerald-400"> · applied</span>}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        <div className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Findings</h3>
          <FindingReview findings={open.filter((f) => f.gate !== "ask")} filesHref={filesHref} curate={isReviewer && !stale} repo={pr.repo} number={pr.number} prId={pr.id} />
          {dismissed.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Not an issue, per reviewer ({dismissed.length})</h4>
              <ul className="space-y-1.5">
                {dismissed.map((f) => (
                  <li key={f.id} className="text-sm">
                    <span className="font-mono text-xs text-muted-foreground">{f.id}</span> <span className="line-through decoration-muted-foreground/60">{f.title}</span>
                    {rejection(f) && <span className="text-muted-foreground"> · {rejection(f)}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {review.findings.some((f) => f.status === "fixed" || f.status === "decided") && (
            <p className="mt-3 text-xs text-muted-foreground">
              Resolved: {review.findings.filter((f) => f.status === "fixed" || f.status === "decided").map((f) => f.id).join(", ")}
            </p>
          )}
          {(review.scope.note || review.scope.skipped.length > 0 || review.scope.skimmed.length > 0) && (
            <p className="mt-4 flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                {review.scope.note}
                {review.scope.skipped.length > 0 && <> Skipped: {review.scope.skipped.join(", ")}.</>}
                {review.scope.skimmed.length > 0 && <> Skimmed: {review.scope.skimmed.join(", ")}.</>}
              </span>
            </p>
          )}
        </div>
        </CollapsibleSection>
      </div>
    </section>
  );
}

function Trajectory({ rounds, bar }: { rounds: { n: number; score: number; fixed: string[] }[]; bar: number }) {
  return (
    <ol className="flex items-end gap-1.5" aria-label="Score per fix round">
      {rounds.map((r) => (
        <li key={r.n} className="flex flex-col items-center gap-1 text-[10px] text-muted-foreground">
          <div className="flex h-10 w-6 items-end rounded-sm bg-muted" title={`Round ${r.n}: ${r.score}${r.fixed.length ? ` (fixed ${r.fixed.join(", ")})` : ""}`}>
            <div className={cn("w-full rounded-sm", r.score >= bar ? "bg-emerald-500" : "bg-amber-500")} style={{ height: `${r.score}%` }} />
          </div>
          <span className="tabular-nums">{r.score}</span>
        </li>
      ))}
    </ol>
  );
}

/** An ask answered on the thread but not yet picked up by a bot run: show the answer instead of the reply box. */
function PendingAnswer({ answer, canPush }: { answer: Answer; canPush: boolean }) {
  return (
    <div className="space-y-1 text-sm">
      <p>
        <span className="font-medium">Answered:</span> {answer.body}{" "}
        <span className="text-xs text-muted-foreground">
          · <a href={answer.url} target="_blank" rel="noopener noreferrer" className="underline">{answer.author}, {timeAgo(answer.createdAt)}</a>
        </span>
      </p>
      <p className="text-xs text-muted-foreground">
        Not applied yet. {canPush ? "Run Review & fix to have the bot apply it, or make the change yourself and Re-review." : "The PR author can run Review & fix to apply it."} To change the answer, reply again on the GitHub thread; the latest reply counts.
      </p>
    </div>
  );
}
