import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { PrHeader } from "@/components/pr-header";
import { PrTabsNav } from "@/components/pr-tabs-nav";
import { viewer } from "@/lib/github/client";
import { getPullRequest } from "@/lib/github/pull-request";

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
  const [me, pr] = await Promise.all([viewer(), getPullRequest(owner, repo, n)]);
  if (!pr) notFound();
  return (
    <>
      <SiteHeader viewer={me} />
      <div className="border-b border-border bg-card/40">
        <div className="mx-auto w-full max-w-7xl px-4 pt-6">
          <PrHeader pr={pr} />
          <PrTabsNav pr={pr} />
        </div>
      </div>
      <main className="mx-auto w-full max-w-7xl px-4 py-6">{children}</main>
    </>
  );
}
