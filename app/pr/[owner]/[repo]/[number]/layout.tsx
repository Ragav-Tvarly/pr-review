import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { PrActions } from "@/components/pr-actions";
import { PrHeader } from "@/components/pr-header";
import { PrTabsNav } from "@/components/pr-tabs-nav";
import { viewer } from "@/lib/github/client";
import { getPullRequest } from "@/lib/github/pull-request";
import { hasRepo } from "@/lib/github/access";
import { canSeePr, seniors } from "@/lib/config";

export const dynamic = "force-dynamic";

type Params = Promise<{ owner: string; repo: string; number: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { owner, repo, number } = await params;
  const pr = await getPullRequest(owner, repo, Number(number)).catch(() => null);
  return { title: pr ? `#${pr.number} ${pr.title}` : `#${number}` };
}

export default async function PrLayout({ params, children }: { params: Params; children: React.ReactNode }) {
  const { owner, repo, number } = await params;
  const n = Number(number);
  if (!Number.isInteger(n) || n <= 0) notFound();
  const me = await viewer();
  // only repos enabled for the bot that this user can access; anything else is a 404
  if (!hasRepo(me.repos, `${owner}/${repo}`)) notFound();
  const pr = await getPullRequest(owner, repo, n);
  if (!pr || !canSeePr(me, pr.author.login)) notFound(); // devs: only their own PRs
  return (
    <>
      <SiteHeader viewer={me} />
      <div className="border-b border-border bg-card/40">
        <div className="mx-auto w-full max-w-7xl px-4 pt-6">
          <PrHeader pr={pr} />
          <PrTabsNav pr={pr} actions={<PrActions pr={pr} viewer={me.login} canPush={hasRepo(me.pushRepos, pr.repo)} canMerge={me.isSenior} reviewers={seniors()} />} />
        </div>
      </div>
      <main className="mx-auto w-full max-w-7xl px-4 py-6">{children}</main>
    </>
  );
}
