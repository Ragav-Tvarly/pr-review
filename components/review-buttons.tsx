"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { NOT_CONFIGURED } from "@/components/score-button";
import { fireReviews } from "@/lib/review/fire";

export function ReviewButtons({ repo, number, canPush, bar, hasReview, size = "sm" }: { repo: string; number: number; canPush: boolean; bar: number; hasReview: boolean; size?: "sm" | "default" }) {
  const [pending, start] = useTransition();
  const [confirmFix, setConfirmFix] = useState(false);
  const router = useRouter();

  const fire = (mode: "review" | "fix") =>
    start(async () => {
      const res = await fireReviews(repo, [number], mode);
      if (!res.configured) return void toast.error(NOT_CONFIGURED);
      const failed = res.failed[0];
      if (failed) return void toast.error(`Could not start: ${failed.error}`);
      toast.success(mode === "fix" ? `Review & fix started. The bot pushes fixes to this branch until the score reaches ${bar}.` : "Review started. Results land on this page in a few minutes.");
      router.refresh();
    });

  return (
    <>
      <Button size={size} variant={hasReview ? "outline" : "secondary"} onClick={() => fire("review")} disabled={pending} aria-busy={pending}>
        <Sparkles className="mr-1.5 h-4 w-4" aria-hidden="true" />
        {hasReview ? "Re-review" : "Run review"}
      </Button>
      {canPush && (
        <Button size={size} variant="outline" onClick={() => setConfirmFix(true)} disabled={pending}>
          <Wand2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Review & fix
        </Button>
      )}
      <AlertDialog open={confirmFix} onOpenChange={setConfirmFix}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Let the bot push fixes to this branch?</AlertDialogTitle>
            <AlertDialogDescription>
              The review bot will review, apply only clear-cut fixes, run checks, commit as TvarReview and push to this PR&apos;s branch, then re-score. It repeats until the score reaches {bar} or it runs out of rounds. Product decisions are left for you as questions on the thread. It stops if someone else pushes meanwhile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => fire("fix")}>Start review & fix</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
