"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addPrComment } from "@/lib/github/actions";
import type { PrDetail } from "@/lib/github/pull-request";
import { timeAgo } from "@/lib/format";
import { REVIEW_MARKER } from "@/lib/review/types";

/** The PR's general comments (minus the bot's summary, shown above) and a box to add one. */
export function Conversation({ pr }: { pr: PrDetail }) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const id = useId();
  const comments = pr.comments.filter((c) => !c.body.trimStart().startsWith(REVIEW_MARKER));

  const send = () =>
    start(async () => {
      const res = await addPrComment(pr.repo, pr.number, body);
      if (!res.ok) return void toast.error(res.error);
      setBody("");
      router.refresh();
    });

  return (
    <section aria-labelledby="conversation-heading" className="rounded-lg border border-border">
      <h2 id="conversation-heading" className="border-b border-border px-4 py-2.5 text-sm font-medium">
        Conversation <span className="text-muted-foreground">· {comments.length}</span>
      </h2>
      <ol className="divide-y divide-border">
        {comments.map((c) => (
          <li key={c.id} className="flex gap-3 px-4 py-3">
            <Avatar className="mt-0.5 h-6 w-6">
              <AvatarImage src={c.avatarUrl} alt="" />
              <AvatarFallback className="text-[10px]">{c.author.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{c.author}</span> · <span suppressHydrationWarning>{timeAgo(c.createdAt)}</span>
              </p>
              <div
                className="prose prose-sm mt-1 max-w-none dark:prose-invert prose-pre:bg-muted prose-pre:text-foreground prose-a:text-primary"
                // GitHub renders and sanitises bodyHTML server-side.
                dangerouslySetInnerHTML={{ __html: c.bodyHTML }}
              />
            </div>
          </li>
        ))}
      </ol>
      <form
        className="space-y-2 border-t border-border p-4"
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
    </section>
  );
}
