import Link from "next/link";
import { ArrowLeft, ExternalLink, GitMerge, GitPullRequest, GitPullRequestClosed, GitPullRequestDraft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RiskBadge } from "@/components/risk-badge";
import type { PrDetail } from "@/lib/github/pull-request";
import { timeAgo, utcStamp } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PrHeader({ pr }: { pr: PrDetail }) {
  return (
    <div className="space-y-3">
      <Link href="/" className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {pr.repo}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xl font-semibold leading-tight tracking-tight">
            <StateIcon pr={pr} />
            <span className="break-words">{pr.title}</span>
            <span className="font-normal text-muted-foreground">#{pr.number}</span>
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <StatePill pr={pr} />
            <Avatar className="h-5 w-5">
              <AvatarImage src={pr.author.avatarUrl} alt="" />
              <AvatarFallback className="text-[10px]">{pr.author.login.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="text-foreground">{pr.author.login}</span>
            wants to merge {pr.commitCount} {pr.commitCount === 1 ? "commit" : "commits"} into
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">{pr.baseRefName}</code>
            from
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">{pr.headRefName}</code>
            <span aria-hidden="true">·</span>
            <time dateTime={pr.updatedAt} title={utcStamp(pr.updatedAt)} suppressHydrationWarning>
              updated {timeAgo(pr.updatedAt)}
            </time>
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-mono">
              <span className="text-emerald-600 dark:text-emerald-400">+{pr.additions}</span>{" "}
              <span className="text-red-600 dark:text-red-400">−{pr.deletions}</span>
            </span>
            <span className="text-muted-foreground">
              {pr.changedFiles} {pr.changedFiles === 1 ? "file" : "files"} changed
            </span>
            <RiskBadge risk={pr.risk} />
            <a href={pr.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
              Open on GitHub
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function StateIcon({ pr }: { pr: PrDetail }) {
  const cls = "h-6 w-6 shrink-0";
  if (pr.state === "MERGED") return <GitMerge className={cn(cls, "text-violet-500")} aria-hidden="true" />;
  if (pr.state === "CLOSED") return <GitPullRequestClosed className={cn(cls, "text-red-500")} aria-hidden="true" />;
  if (pr.isDraft) return <GitPullRequestDraft className={cn(cls, "text-muted-foreground")} aria-hidden="true" />;
  return <GitPullRequest className={cn(cls, "text-primary")} aria-hidden="true" />;
}

function StatePill({ pr }: { pr: PrDetail }) {
  const base = "rounded-full px-2 py-0.5 text-xs font-medium";
  if (pr.state === "MERGED") return <span className={cn(base, "bg-violet-600 text-white")}>Merged</span>;
  if (pr.state === "CLOSED") return <span className={cn(base, "bg-red-600 text-white")}>Closed</span>;
  if (pr.isDraft) return <span className={cn(base, "bg-muted text-muted-foreground")}>Draft</span>;
  return <span className={cn(base, "bg-emerald-600 text-white")}>Open</span>;
}
