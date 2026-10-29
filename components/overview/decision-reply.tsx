"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { replyToReviewComment } from "@/lib/github/actions";

export function DecisionReply({ repo, number, commentId, options }: { repo: string; number: number; commentId: number; options: string[] }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const id = useId();
  if (done) return <p className="text-sm text-emerald-600 dark:text-emerald-400">Decision posted on the thread.</p>;
  const send = () =>
    start(async () => {
      const res = await replyToReviewComment(repo, number, commentId, text);
      if (!res.ok) return void toast.error(res.error);
      setDone(true);
      toast.success("Reply posted. The next review round will apply it.");
    });
  return (
    <div className="space-y-2">
      {options.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Suggested answers">
          {options.map((o) => (
            <Button key={o} type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setText(o)}>
              {o}
            </Button>
          ))}
        </div>
      )}
      <label htmlFor={id} className="sr-only">
        Your decision
      </label>
      <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Your decision, in a sentence…" className="text-sm" />
      <Button size="sm" onClick={send} disabled={pending || !text.trim()} aria-busy={pending}>
        {pending ? "Posting…" : "Post decision"}
      </Button>
    </div>
  );
}
