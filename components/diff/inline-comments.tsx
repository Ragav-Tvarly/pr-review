"use client";

import { createContext, useContext, useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewComment } from "@/lib/github/pull-request";
import { timeAgo } from "@/lib/format";
import { replyToReviewComment, setThreadResolved } from "@/lib/github/actions";

/** Which PR the threads belong to, for reply / resolve. Provided by FilesChanged. */
export const PrContext = createContext<{ repo: string; number: number } | null>(null);

export type Thread = {
  path: string;
  line: number;
  side: "LEFT" | "RIGHT";
  existing: ReviewComment[];
  pending: string | null;
};

export function threadKey(side: "LEFT" | "RIGHT", line: number): string {
  return `${side}:${line}`;
}

export function InlineCommentForm({ onSubmit, onCancel, initial = "", submitLabel = "Add comment", placeholder = "Leave a comment on this line… (⌘⏎ to add)" }: { onSubmit: (body: string) => void; onCancel: () => void; initial?: string; submitLabel?: string; placeholder?: string }) {
  const [body, setBody] = useState(initial);
  const id = useId();
  return (
    <form
      className="space-y-2 border-y border-border bg-background p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim()) onSubmit(body.trim());
      }}
    >
      <label htmlFor={id} className="sr-only">
        Comment on this line
      </label>
      <Textarea
        id={id}
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className="font-sans text-sm"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && body.trim()) onSubmit(body.trim());
          if (e.key === "Escape") onCancel();
        }}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!body.trim()}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function InlineThread({ thread, onRemovePending }: { thread: Thread; onRemovePending: () => void }) {
  const pr = useContext(PrContext);
  const router = useRouter();
  const [replying, setReplying] = useState(false);
  const [pending, start] = useTransition();
  const root = thread.existing.find((c) => c.inReplyTo === null) ?? thread.existing[0];
  const threadId = thread.existing.find((c) => c.threadId)?.threadId ?? null;
  const resolved = thread.existing.length > 0 && thread.existing.every((c) => c.resolved);
  const [open, setOpen] = useState(!resolved);

  const reply = (body: string) =>
    start(async () => {
      if (!pr || !root) return;
      const res = await replyToReviewComment(pr.repo, pr.number, root.id, body);
      if (!res.ok) return void toast.error(res.error);
      setReplying(false);
      router.refresh();
    });
  const toggleResolved = () =>
    start(async () => {
      if (!pr || !threadId) return;
      const res = await setThreadResolved(pr.repo, pr.number, threadId, !resolved);
      if (!res.ok) return void toast.error(res.error);
      setOpen(resolved); // reopening a resolved thread shows it; resolving collapses it
      router.refresh();
    });

  if (resolved && !open) {
    return (
      <div className="flex items-center gap-2 border-y border-border bg-background px-3 py-2 font-sans text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
        Resolved · {thread.existing.length} {thread.existing.length === 1 ? "comment" : "comments"} by {root?.author}
        <Button variant="ghost" size="sm" className="ml-auto h-6 text-xs" onClick={() => setOpen(true)}>
          Show
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-y border-border bg-background p-3 font-sans text-sm">
      {thread.existing.map((c) => (
        <article key={c.id} className="flex gap-2">
          <Avatar className="mt-0.5 h-5 w-5">
            <AvatarImage src={c.avatarUrl} alt="" />
            <AvatarFallback className="text-[10px]">{c.author.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{c.author}</span> ·{" "}
              <span suppressHydrationWarning>{timeAgo(c.createdAt)}</span>
            </p>
            <p className="whitespace-pre-wrap">{c.body}</p>
          </div>
        </article>
      ))}
      {thread.pending && (
        <div className="flex items-start gap-2 rounded-md border border-primary/40 bg-primary/5 p-2">
          <p className="min-w-0 flex-1 whitespace-pre-wrap">
            <span className="mr-1 rounded bg-primary/15 px-1 text-[10px] font-medium uppercase text-primary">pending</span>
            {thread.pending}
          </p>
          <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onRemovePending} aria-label="Remove pending comment">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      )}
      {pr && root && (replying ? (
        <div className="-mx-3 -mb-3">
          <InlineCommentForm onSubmit={reply} onCancel={() => setReplying(false)} submitLabel={pending ? "Replying…" : "Reply"} placeholder="Reply to this thread… (⌘⏎ to send)" />
        </div>
      ) : (
        <div className="flex gap-1 pt-1">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setReplying(true)} disabled={pending}>
            Reply
          </Button>
          {threadId && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={toggleResolved} disabled={pending}>
              {resolved ? "Unresolve" : "Resolve"}
            </Button>
          )}
          {resolved && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
              Hide
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
