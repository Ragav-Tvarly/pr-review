import { Suspense } from "react";
import { CommandPalette } from "@/components/command-palette";
import { PrTable } from "@/components/pr-table";
import { SiteHeader } from "@/components/site-header";
import { viewer } from "@/lib/github/client";
import { listOpenPRs } from "@/lib/github/pulls";
import { repos } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [me, prs] = await Promise.all([viewer(), listOpenPRs()]);
  return (
    <>
      <SiteHeader viewer={me} />
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Pull requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">Open pull requests in {repos().join(", ")}.</p>
        </div>
        <Suspense>
          <PrTable prs={prs} viewer={me.login} />
        </Suspense>
      </main>
      <CommandPalette prs={prs} />
    </>
  );
}
