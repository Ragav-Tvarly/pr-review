"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, GitMerge, MessageSquarePlus } from "lucide-react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ReviewDialog } from "@/components/review-dialog";
import { RequestReview } from "@/components/request-review";
import { mergePR, setDraft, type MergeMethod } from "@/lib/github/actions";
import type { PrDetail } from "@/lib/github/pull-request";

const METHOD_LABEL: Record<MergeMethod, string> = { SQUASH: "Squash and merge", MERGE: "Create a merge commit", REBASE: "Rebase and merge" };

export function PrActions({ pr, viewer, canPush, finalReviewer }: { pr: PrDetail; viewer: string; canPush: boolean; finalReviewer: string }) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [mergeMethod, setMergeMethod] = useState<MergeMethod | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const isAuthor = pr.author.login === viewer;
  const mergeable = ["CLEAN", "HAS_HOOKS", "UNSTABLE"].includes(pr.mergeStateStatus) && pr.state === "OPEN" && !pr.isDraft;
  const mergeHint = pr.isDraft ? "Mark the PR ready for review first" : pr.mergeStateStatus === "DIRTY" ? "Resolve merge conflicts first" : pr.mergeStateStatus === "BLOCKED" ? "Blocked by branch protection" : pr.mergeStateStatus === "BEHIND" ? "Update the branch first" : !canPush ? "You need push access to merge" : undefined;

  const toggleDraft = () =>
    start(async () => {
      const res = await setDraft(pr.repo, pr.number, pr.id, !pr.isDraft);
      if (!res.ok) return void toast.error(res.error);
      toast.success(pr.isDraft ? "Ready for review." : "Converted to draft.");
      router.refresh();
    });

  const merge = () => {
    const method = mergeMethod;
    if (!method) return;
    setMergeMethod(null);
    start(async () => {
      const res = await mergePR(pr.repo, pr.number, pr.id, method, pr.headRefOid);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Merged #${pr.number}. Ship it.`);
      router.refresh();
    });
  };

  if (pr.state !== "OPEN") return null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setReviewOpen(true)}>
        <MessageSquarePlus className="mr-1.5 h-4 w-4" aria-hidden="true" />
        Review changes
      </Button>
      {pr.viewerCanUpdate && <RequestReview pr={pr} finalReviewer={finalReviewer} />}
      {pr.viewerCanUpdate && (
        <Button variant="outline" size="sm" onClick={toggleDraft} disabled={pending}>
          {pr.isDraft ? "Ready for review" : "Convert to draft"}
        </Button>
      )}
      {canPush && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" disabled={!mergeable || pending} title={mergeHint} aria-describedby={mergeHint ? "merge-hint" : undefined}>
              <GitMerge className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Merge
              <ChevronDown className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {pr.mergeMethods.map((m) => (
              <DropdownMenuItem key={m} onSelect={() => setMergeMethod(m)}>
                {METHOD_LABEL[m]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {mergeHint && (
        <span id="merge-hint" className="sr-only">
          {mergeHint}
        </span>
      )}
      <ReviewDialog open={reviewOpen} onOpenChange={setReviewOpen} repo={pr.repo} number={pr.number} prId={pr.id} isAuthor={isAuthor} threads={[]} />
      <AlertDialog open={mergeMethod !== null} onOpenChange={(o) => !o && setMergeMethod(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{mergeMethod ? METHOD_LABEL[mergeMethod] : "Merge"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This merges <span className="font-mono">{pr.headRefName}</span> into <span className="font-mono">{pr.baseRefName}</span> at commit <span className="font-mono">{pr.headRefOid.slice(0, 7)}</span>.
              {pr.mergeStateStatus === "UNSTABLE" && " Checks are failing on this commit."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={merge}>Merge</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
