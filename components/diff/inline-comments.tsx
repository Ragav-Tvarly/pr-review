"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ReviewComment } from "@/lib/github/pull-request";
import { timeAgo } from "@/lib/format";

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

export function InlineCommentForm({ onSubmit, onCancel, initial = "" }: { onSubmit: (body: string) => void; onCancel: () => void; initial?: string }) {
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
        placeholder="Leave a comment on this line… (⌘⏎ to add)"
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
          Add comment
        </Button>
      </div>
    </form>
  );
}

export function InlineThread({ thread, onRemovePending }: { thread: Thread; onRemovePending: () => void }) {
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
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="hover:underline" suppressHydrationWarning>
                {timeAgo(c.createdAt)}
              </a>
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
    </div>
  );
}
