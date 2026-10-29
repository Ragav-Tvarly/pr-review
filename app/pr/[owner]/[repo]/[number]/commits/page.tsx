import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getPullRequest } from "@/lib/github/pull-request";
import { timeAgo, utcStamp } from "@/lib/format";

type Params = Promise<{ owner: string; repo: string; number: string }>;

export default async function CommitsPage({ params }: { params: Params }) {
  const { owner, repo, number } = await params;
  const pr = (await getPullRequest(owner, repo, Number(number)))!;
  return (
    <section aria-labelledby="commits-heading" className="rounded-lg border border-border">
      <h2 id="commits-heading" className="border-b border-border px-4 py-2.5 text-sm font-medium">
        {pr.commitCount} {pr.commitCount === 1 ? "commit" : "commits"}
        {pr.commitCount > pr.commits.length && <span className="ml-2 font-normal text-muted-foreground">(showing the first {pr.commits.length})</span>}
      </h2>
      <ol className="divide-y divide-border">
        {pr.commits.map((c) => (
          <li key={c.oid} className="flex items-start gap-3 px-4 py-3">
            <Avatar className="mt-0.5 h-6 w-6">
              <AvatarImage src={c.author.avatarUrl ?? undefined} alt="" />
              <AvatarFallback className="text-[10px]">{(c.author.login ?? c.author.name).slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{c.headline}</p>
              {c.body && <pre className="mt-1 whitespace-pre-wrap font-sans text-sm text-muted-foreground">{c.body}</pre>}
              <p className="mt-1 text-xs text-muted-foreground">
                {c.author.login ?? c.author.name} committed{" "}
                <time dateTime={c.date} title={utcStamp(c.date)} suppressHydrationWarning>
                  {timeAgo(c.date)}
                </time>
              </p>
            </div>
            <a href={c.url} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded bg-muted px-2 py-0.5 font-mono text-xs hover:underline">
              {c.abbreviatedOid}
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
