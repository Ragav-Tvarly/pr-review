"use client";

import { useId, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ReviewDialog } from "@/components/review-dialog";
import { FindingHeader } from "@/components/overview/finding-header";
import { replyToReviewComment, type DraftThread, type ReviewEvent } from "@/lib/github/actions";
import type { Finding } from "@/lib/review/types";
import { cn } from "@/lib/utils";

type Choice = { kind: "include"; text: string } | { kind: "dismiss"; text: string };

const ORDER = { critical: 0, warning: 1, suggestion: 2 } as const;

/**
 * The bot's open findings. For a reviewer (not the author) each one can be included in their own review,
 * with the wording edited, or rejected as not an issue with a reason; they can also add points the bot
 * missed. "Post review" opens the usual review dialog prefilled with all of it.
 */
export function FindingReview({ findings, filesHref, curate, repo, number, prId }: { findings: Finding[]; filesHref: string; curate: boolean; repo: string; number: number; prId: string }) {
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [own, setOwn] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0); // remounts the dialog with fresh prefill each time it opens
  const ownId = useId();
  const sorted = [...findings].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);

  if (sorted.length === 0 && !curate) return <p className="text-sm text-muted-foreground">No open findings.</p>;

  const set = (id: string, c: Choice | null) =>
    setChoices((all) => {
      const next = { ...all };
      if (c) next[id] = c;
      else delete next[id];
      return next;
    });

  const included = sorted.filter((f) => choices[f.id]?.kind === "include");
  const dismissed = sorted.filter((f) => choices[f.id]?.kind === "dismiss");
  const missingReason = dismissed.some((f) => !choices[f.id]!.text.trim());
  const count = included.length + dismissed.length + own.length;

  // findings with a line become inline comments under the reviewer's name; the rest go in the summary
  const threads: DraftThread[] = included.filter((f) => f.path && f.line).map((f) => ({ path: f.path!, line: f.line!, side: f.side ?? "RIGHT", body: choices[f.id]!.text.trim() }));
  const inBody = included.filter((f) => !(f.path && f.line));
  const body = [
    inBody.length > 0 && `From the Claude review:\n${inBody.map((f) => `- ${choices[f.id]!.text.trim().replace(/\n+/g, " ")}`).join("\n")}`,
    dismissed.length > 0 && `Not an issue (Claude review findings I disagree with):\n${dismissed.map((f) => `- ${f.id} ${f.title}: ${choices[f.id]!.text.trim()}`).join("\n")}`,
    own.length > 0 && `Also:\n${own.map((o) => `- ${o}`).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const blocking = included.some((f) => f.severity !== "suggestion") || own.length > 0;
  const event: ReviewEvent = blocking ? "REQUEST_CHANGES" : included.length > 0 ? "COMMENT" : "APPROVE";

  // tell the bot on its own thread, so the next run drops the finding and does not raise it again
  const afterSubmit = async () => {
    await Promise.all(dismissed.filter((f) => f.commentId).map((f) => replyToReviewComment(repo, number, f.commentId!, `Not an issue: ${choices[f.id]!.text.trim()}`)));
    setChoices({});
    setOwn([]);
  };

  const addOwn = () => {
    const t = draft.trim();
    if (!t) return;
    setOwn((o) => [...o, t]);
    setDraft("");
  };

  return (
    <div className="space-y-4">
      {curate && (
        <p className="text-xs text-muted-foreground">
          Check each finding. <span className="font-medium text-foreground">Include</span> the ones you agree with (edit the wording if you like) and mark wrong ones <span className="font-medium text-foreground">Not an issue</span> with a reason. Then post them as your review.
        </p>
      )}
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open findings.</p>
      ) : (
        <ol className="space-y-2">
          {sorted.map((f) => {
            const c = choices[f.id];
            return (
              <li key={f.id} className={cn("rounded-md border border-border p-3", c?.kind === "include" && "border-primary/40 bg-primary/5", c?.kind === "dismiss" && "opacity-80")}>
                <FindingHeader filesHref={filesHref} f={f} />
                {f.fix && <p className={cn("mt-1 text-sm text-muted-foreground", c?.kind === "dismiss" && "line-through")}>{f.fix}</p>}
                {curate && (
                  <div className="mt-2.5 space-y-2">
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Your call on ${f.id}`}>
                      <Button
                        type="button"
                        size="sm"
                        variant={c?.kind === "include" ? "default" : "outline"}
                        className="h-7 text-xs"
                        aria-pressed={c?.kind === "include"}
                        onClick={() => set(f.id, c?.kind === "include" ? null : { kind: "include", text: `${f.title}${f.fix ? `\n\nSuggested fix: ${f.fix}` : ""}` })}
                      >
                        <Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        Include
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className={cn("h-7 text-xs", c?.kind === "dismiss" && "border-red-500/50 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:text-red-300")}
                        aria-pressed={c?.kind === "dismiss"}
                        onClick={() => set(f.id, c?.kind === "dismiss" ? null : { kind: "dismiss", text: "" })}
                      >
                        <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                        Not an issue
                      </Button>
                    </div>
                    {c && (
                      <Textarea
                        id={`finding-${f.id}`}
                        aria-label={c.kind === "include" ? `Your comment for ${f.id}` : `Why ${f.id} is not an issue`}
                        value={c.text}
                        onChange={(e) => set(f.id, { ...c, text: e.target.value })}
                        rows={c.kind === "include" ? 3 : 2}
                        placeholder={c.kind === "dismiss" ? "Why it is not an issue (required, the bot reads this)…" : undefined}
                        className="text-sm"
                      />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {curate && (
        <div className="space-y-3 rounded-md border border-dashed border-border p-3">
          <label htmlFor={ownId} className="text-sm font-medium">
            Something the bot missed?
          </label>
          {own.length > 0 && (
            <ul className="space-y-1.5">
              {own.map((o, i) => (
                <li key={i} className="flex items-start gap-2 rounded bg-muted/50 px-2.5 py-1.5 text-sm">
                  <span className="flex-1 whitespace-pre-wrap">{o}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" aria-label="Remove this comment" onClick={() => setOwn((all) => all.filter((_, j) => j !== i))}>
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Textarea id={ownId} value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} placeholder="Describe the problem and what to change…" className="text-sm" />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={addOwn} disabled={!draft.trim()}>
              <Plus className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Add to my review
            </Button>
            <span className="text-xs text-muted-foreground">For a comment on a specific line, use Files.</span>
          </div>
        </div>
      )}

      {curate && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => {
              setRound((r) => r + 1);
              setOpen(true);
            }}
            disabled={count === 0 || missingReason}
          >
            Post review{count > 0 ? ` (${count})` : ""}
          </Button>
          <span className="text-xs text-muted-foreground">
            {missingReason
              ? "Give a reason for each finding marked Not an issue."
              : count === 0
                ? "Include or reject findings, or add your own, to post them."
                : [included.length && `${included.length} included`, dismissed.length && `${dismissed.length} not an issue`, own.length && `${own.length} of your own`].filter(Boolean).join(" · ")}
          </span>
        </div>
      )}
      {curate && (
        <ReviewDialog key={round} open={open} onOpenChange={setOpen} repo={repo} number={number} prId={prId} isAuthor={false} threads={threads} initialBody={body} initialEvent={event} onSubmitted={afterSubmit} />
      )}
    </div>
  );
}
