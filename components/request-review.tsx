"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { listReviewers, requestReview } from "@/lib/github/actions";
import type { PrDetail } from "@/lib/github/pull-request";

/** "Request review": the senior dev pinned first, then everyone else assignable in the repo. */
export function RequestReview({ pr, finalReviewer }: { pr: PrDetail; finalReviewer: string }) {
  const [people, setPeople] = useState<string[] | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const author = pr.author.login.toLowerCase();
  const requested = new Set(pr.reviewRequests.map((r) => r.toLowerCase()));
  const finalRequested = requested.has(finalReviewer.toLowerCase());
  const others = (people ?? []).filter((p) => {
    const l = p.toLowerCase();
    return l !== author && l !== finalReviewer.toLowerCase() && l !== "tvarreview" && !l.endsWith("[bot]"); // never the review bot
  });
  const verb = pr.isDraft ? "Mark ready & request" : "Request";

  const load = (open: boolean) => {
    if (open && people === null) void listReviewers(pr.repo).then(setPeople);
  };

  const ask = (login: string) =>
    start(async () => {
      const res = await requestReview(pr.repo, pr.number, pr.id, login, pr.isDraft);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${pr.isDraft ? "Marked ready and requested" : "Requested"} a review from ${login}.`);
      router.refresh();
    });

  const item = (login: string, note?: string) => (
    <DropdownMenuItem key={login} disabled={requested.has(login.toLowerCase())} onSelect={() => ask(login)}>
      {verb} {login}
      {note && <span className="ml-auto pl-3 text-xs text-muted-foreground">{note}</span>}
      {requested.has(login.toLowerCase()) && <span className="ml-auto pl-3 text-xs text-muted-foreground">requested</span>}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu onOpenChange={load}>
      <DropdownMenuTrigger asChild>
        <Button variant={finalRequested ? "outline" : "secondary"} size="sm" disabled={pending} aria-busy={pending}>
          <UserCheck className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {finalRequested ? `Review requested from ${finalReviewer}` : "Request review"}
          <ChevronDown className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-64">
        {author !== finalReviewer.toLowerCase() && (
          <>
            <DropdownMenuLabel className="text-xs text-muted-foreground">Final review before merge</DropdownMenuLabel>
            {item(finalReviewer, "senior dev")}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuLabel className="text-xs text-muted-foreground">Others</DropdownMenuLabel>
        {people === null ? (
          <DropdownMenuItem disabled>Loading…</DropdownMenuItem>
        ) : others.length === 0 ? (
          <DropdownMenuItem disabled>No one else can review here</DropdownMenuItem>
        ) : (
          others.map((p) => item(p))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
