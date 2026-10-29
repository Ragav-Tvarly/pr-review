import { AiReview } from "@/components/overview/ai-review";
import { Checks } from "@/components/overview/checks";
import { People } from "@/components/overview/people";
import { viewer } from "@/lib/github/client";
import { getPullRequest } from "@/lib/github/pull-request";
import { scoreBar } from "@/lib/config";

type Params = Promise<{ owner: string; repo: string; number: string }>;

export default async function OverviewPage({ params }: { params: Params }) {
  const { owner, repo, number } = await params;
  const [pr, me] = await Promise.all([getPullRequest(owner, repo, Number(number)), viewer()]);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <AiReview pr={pr!} canPush={me.canPush} bar={scoreBar()} />
        <article aria-labelledby="description-heading" className="rounded-lg border border-border">
          <h2 id="description-heading" className="border-b border-border px-4 py-2.5 text-sm font-medium">
            Description
          </h2>
          {pr!.bodyHTML ? (
            <div
              className="prose prose-sm max-w-none px-4 py-4 dark:prose-invert prose-pre:bg-muted prose-pre:text-foreground prose-a:text-primary"
              // GitHub renders and sanitises bodyHTML server-side.
              dangerouslySetInnerHTML={{ __html: pr!.bodyHTML }}
            />
          ) : (
            <p className="px-4 py-6 text-sm text-muted-foreground">No description provided.</p>
          )}
        </article>
      </div>
      <aside className="space-y-4">
        <Checks pr={pr!} />
        <People pr={pr!} />
      </aside>
    </div>
  );
}
