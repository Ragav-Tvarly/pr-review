"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { submitReview, type DraftThread, type ReviewEvent } from "@/lib/github/actions";

export function ReviewDialog({
  open,
  onOpenChange,
  repo,
  number,
  prId,
  isAuthor,
  threads,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repo: string;
  number: number;
  prId: string;
  isAuthor: boolean;
  threads: DraftThread[];
  onSubmitted?: () => void;
}) {
  const [event, setEvent] = useState<ReviewEvent>(isAuthor ? "COMMENT" : "APPROVE");
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const bodyId = useId();

  const submit = () =>
    start(async () => {
      const res = await submitReview(repo, number, prId, event, body, threads);
      if (!res.ok) return void toast.error(res.error);
      toast.success(event === "APPROVE" ? "Approved. Nice one." : event === "REQUEST_CHANGES" ? "Changes requested." : "Review posted.");
      setBody("");
      onOpenChange(false);
      onSubmitted?.();
      router.refresh();
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Review changes</DialogTitle>
          <DialogDescription>
            {threads.length > 0 ? `${threads.length} inline ${threads.length === 1 ? "comment" : "comments"} will be posted with this review.` : "Leave a summary and pick a verdict."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor={bodyId}>Summary</Label>
            <Textarea id={bodyId} value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="What stood out, what to change…" className="mt-1.5" />
          </div>
          <RadioGroup value={event} onValueChange={(v) => setEvent(v as ReviewEvent)} aria-label="Verdict" className="gap-2">
            <RadioRow value="COMMENT" label="Comment" hint="Feedback without a verdict." />
            <RadioRow value="APPROVE" label="Approve" hint="Good to merge." disabled={isAuthor} />
            <RadioRow value="REQUEST_CHANGES" label="Request changes" hint="Must be addressed before merging." disabled={isAuthor} />
          </RadioGroup>
          {isAuthor && <p className="text-xs text-muted-foreground">GitHub does not let authors approve or request changes on their own PR.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending} aria-busy={pending}>
            {pending ? "Submitting…" : "Submit review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RadioRow({ value, label, hint, disabled }: { value: ReviewEvent; label: string; hint: string; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3 rounded-md border border-border p-3 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
      <RadioGroupItem value={value} id={id} disabled={disabled} className="mt-0.5" />
      <Label htmlFor={id} className="flex-1 cursor-pointer font-normal">
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </Label>
    </div>
  );
}
