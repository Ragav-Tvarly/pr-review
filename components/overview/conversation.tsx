"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addPrComment } from "@/lib/github/actions";
import Link from "next/link";
import { fileAnchor } from "@/components/diff/types";
import type { PrDetail, PrReview, ReviewThread } from "@/lib/github/pull-request";
import { prPath } from "@/lib/paths";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import { REVIEW_MARKER } from "@/lib/review/types";
import { CollapsibleSection } from "@/components/collapsible-section";

const VERB: Record<PrReview["state"], { text: string; cls: string }> = {
  APPROVED: { text: "approved", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  CHANGES_REQUESTED: { text: "requested changes", cls: "bg-red-500/15 text-red-700 dark:text-red-300" },
  COMMENTED: { text: "reviewed", cls: "bg-muted text-muted-foreground" },
  DISMISSED: { text: "review dismissed", cls: "bg-muted text-muted-foreground" },
  PENDING: { text: "pending review", cls: "bg-muted text-muted-foreground" },
};

type Item = { kind: "comment"; at: string; c: PrDetail["comments"][number] } | { kind: "review"; at: string; r: PrReview };

/**
 * The PR's timeline, newest first: general comments and human reviews (verdict, summary and line
 * comments), like GitHub's Conversation tab. The bot's sticky summary and reviews are in the AI panel above.
 */
export function Conversation({ pr }: { pr: PrDetail }) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const id = useId();
  const items: Item[] = [
    ...pr.comments.filter((c) => !c.body.trimStart().startsWith(REVIEW_MARKER)).map((c) => ({ kind: "comment" as const, at: c.createdAt, c })),
    ...pr.reviews.map((r) => ({ kind: "review" as const, at: r.submittedAt, r })),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const filesHref = prPath(pr, "files");

  const send = () =>
    start(async () => {
      const res = await addPrComment(pr.repo, pr.number, body);
      if (!res.ok) return void toast.error(res.error);
      setBody("");
      router.refresh();
    });

  return (
    <CollapsibleSection
      id="conversation"
      title={
        <>
          Conversation <span className="text-muted-foreground">· {items.length}</span>
        </>
      }
    >
      <form
        className="space-y-2 border-b border-border p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) send();
        }}
      >
        <label htmlFor={id} className="sr-only">
          Add a comment
        </label>
        <Textarea
          id={id}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Add a comment… (Markdown, ⌘⏎ to send)"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && body.trim()) send();
          }}
        />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={!body.trim() || pending} aria-busy={pending}>
            {pending ? "Sending…" : "Comment"}
          </Button>
        </div>
      </form>
      <ol className="divide-y divide-border" aria-label="Comments, newest first">
        {items.map((it) =>
          it.kind === "comment" ? (
            <li key={`c${it.c.id}`} className="flex gap-3 px-4 py-3">
              <Who login={it.c.author} avatarUrl={it.c.avatarUrl} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{it.c.author}</span> · <span suppressHydrationWarning>{timeAgo(it.c.createdAt)}</span>
                </p>
                <Html html={it.c.bodyHTML} />
              </div>
            </li>
          ) : (
            <li key={`r${it.r.id}`} className="flex gap-3 px-4 py-3">
              <Who login={it.r.author} avatarUrl={it.r.avatarUrl} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{it.r.author}</span>
                  {it.r.bodyHTML.trim() || it.r.state !== "COMMENTED" ? (
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] font-medium", VERB[it.r.state].cls)}>{VERB[it.r.state].text}</span>
                  ) : (
                    <span>commented on the code</span>
                  )}
                  · <a href={it.r.url} target="_blank" rel="noopener noreferrer" className="hover:underline" suppressHydrationWarning>{timeAgo(it.r.submittedAt)}</a>
                </p>
                {it.r.bodyHTML.trim() && <Html html={it.r.bodyHTML} />}
                {it.r.threads.length > 0 && (
                  <ul className="mt-2 space-y-2">
                    {it.r.threads.map((t) => (
                      <li key={t.comments[0]!.id}>
                        <Thread thread={t} filesHref={filesHref} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ),
        )}
      </ol>
    </CollapsibleSection>
  );
}

function Who({ login, avatarUrl, small = false }: { login: string; avatarUrl: string; small?: boolean }) {
  return (
    <Avatar className={small ? "h-4 w-4" : "mt-0.5 h-6 w-6"}>
      <AvatarImage src={avatarUrl} alt="" />
      <AvatarFallback className="text-[10px]">{login.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}

function Html({ html }: { html: string }) {
  return (
    <div
      className="prose prose-sm mt-1 max-w-none dark:prose-invert prose-pre:bg-muted prose-pre:text-foreground prose-a:text-primary"
      // GitHub renders and sanitises bodyHTML server-side.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

/** One line-comment thread: where it is, the first comment, then the replies indented under it. Resolved threads start folded. */
function Thread({ thread, filesHref }: { thread: ReviewThread; filesHref: string }) {
  const [first, ...replies] = thread.comments;
  const where = (
    <Link href={`${filesHref}#${fileAnchor(thread.path)}`} className="truncate font-mono text-xs text-primary hover:underline">
      {thread.path}
      {thread.line ? `:${thread.line}` : ""}
    </Link>
  );
  const body = (
    <div className="space-y-2 px-3 pb-2.5">
      {first && <Html html={first.bodyHTML} />}
      {replies.length > 0 && (
        <ol className="space-y-2 border-l-2 border-border pl-3" aria-label="Replies">
          {replies.map((c) => (
            <li key={c.id}>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Who login={c.author} avatarUrl={c.avatarUrl} small />
                <span className="font-medium text-foreground">{c.author}</span> ·{" "}
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="hover:underline" suppressHydrationWarning>
                  {timeAgo(c.createdAt)}
                </a>
              </p>
              <Html html={c.bodyHTML} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
  const count = replies.length > 0 ? `${replies.length} ${replies.length === 1 ? "reply" : "replies"}` : null;
  if (thread.resolved)
    return (
      <details className="group/thread rounded-md border border-border bg-muted/20">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs [&::-webkit-details-marker]:hidden">
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">Resolved</span>
          {where}
          {count && <span className="text-muted-foreground">· {count}</span>}
          <span className="ml-auto text-muted-foreground group-open/thread:hidden">Show</span>
        </summary>
        {body}
      </details>
    );
  return (
    <div className="rounded-md border border-border bg-muted/30">
      <p className="flex items-center gap-2 px-3 pt-2 text-xs">
        {where}
        {count && <span className="text-muted-foreground">· {count}</span>}
      </p>
      {body}
    </div>
  );
}
