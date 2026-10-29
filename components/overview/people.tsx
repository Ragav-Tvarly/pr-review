import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { PrDetail } from "@/lib/github/pull-request";
import { timeAgo } from "@/lib/format";
import { RISK_LABEL_PREFIX } from "@/lib/review/types";

const REVIEW_STATE: Record<string, string> = {
  APPROVED: "approved",
  CHANGES_REQUESTED: "requested changes",
  COMMENTED: "commented",
  DISMISSED: "dismissed",
  PENDING: "pending",
};

export function People({ pr }: { pr: PrDetail }) {
  const labels = pr.labels.filter((l) => !l.name.startsWith(RISK_LABEL_PREFIX));
  return (
    <section aria-labelledby="people-heading" className="rounded-lg border border-border">
      <h2 id="people-heading" className="border-b border-border px-4 py-2.5 text-sm font-medium">
        Reviewers
      </h2>
      <div className="space-y-3 px-4 py-3 text-sm">
        {pr.latestReviews.length === 0 && pr.reviewRequests.length === 0 && <p className="text-muted-foreground">No reviewers yet.</p>}
        {pr.latestReviews.length > 0 && (
          <ul className="space-y-2">
            {pr.latestReviews.map((r) => (
              <li key={r.author + r.submittedAt} className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={r.avatarUrl} alt="" />
                  <AvatarFallback className="text-[10px]">{r.author.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="truncate">
                  <span className="font-medium">{r.author}</span> {REVIEW_STATE[r.state] ?? r.state.toLowerCase()}
                </span>
                <time dateTime={r.submittedAt} className="ml-auto shrink-0 text-xs text-muted-foreground" suppressHydrationWarning>
                  {timeAgo(r.submittedAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
        {pr.reviewRequests.length > 0 && (
          <p className="text-muted-foreground">
            Awaiting review from <span className="text-foreground">{pr.reviewRequests.join(", ")}</span>
          </p>
        )}
        {labels.length > 0 && (
          <div>
            <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Labels</h3>
            <ul className="flex flex-wrap gap-1">
              {labels.map((l) => (
                <li key={l.name} className="rounded-full border px-2 py-0.5 text-xs" style={{ borderColor: `#${l.color}66`, backgroundColor: `#${l.color}1a` }}>
                  {l.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
