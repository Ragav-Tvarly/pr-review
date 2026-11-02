"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { requestReview } from "@/lib/github/actions";
import type { PrDetail } from "@/lib/github/pull-request";

/** "Request review" from the senior dev(s) (FINAL_REVIEWER): the final review before merge. */
export function RequestReview({ pr, reviewers }: { pr: PrDetail; reviewers: string[] }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const requested = new Set(pr.reviewRequests.map((r) => r.toLowerCase()));
  const options = reviewers.filter((r) => r.toLowerCase() !== pr.author.login.toLowerCase());
  const asked = options.find((r) => requested.has(r.toLowerCase()));
  if (options.length === 0) return null; // a senior's own PR: nobody to ask here

  const ask = (login: string) =>
    start(async () => {
      const res = await requestReview(pr.repo, pr.number, pr.id, login, pr.isDraft);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${pr.isDraft ? "Marked ready and requested" : "Requested"} a review from ${login}.`);
      router.refresh();
    });

  const label = asked ? `Review requested from ${asked}` : "Request review";
  if (options.length === 1) {
    const only = options[0]!;
    return (
      <Button variant={asked ? "outline" : "secondary"} size="sm" disabled={pending || Boolean(asked)} aria-busy={pending} onClick={() => ask(only)} title={pr.isDraft ? `Mark ready and ask ${only} for the final review` : `Ask ${only} for the final review`}>
        <UserCheck className="mr-1.5 h-4 w-4" aria-hidden="true" />
        {label}
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={asked ? "outline" : "secondary"} size="sm" disabled={pending} aria-busy={pending}>
          <UserCheck className="mr-1.5 h-4 w-4" aria-hidden="true" />
          {label}
          <ChevronDown className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Final review before merge</DropdownMenuLabel>
        {options.map((r) => (
          <DropdownMenuItem key={r} disabled={requested.has(r.toLowerCase())} onSelect={() => ask(r)}>
            {pr.isDraft ? "Mark ready & request" : "Request"} {r}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
