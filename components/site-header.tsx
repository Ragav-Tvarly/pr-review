import Link from "next/link";
import { GitPullRequest } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { Kbd } from "@/components/kbd";
import type { Viewer } from "@/lib/github/client";

export function SiteHeader({ viewer }: { viewer: Viewer }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 rounded-md font-semibold tracking-tight">
          <GitPullRequest className="h-5 w-5 text-primary" aria-hidden="true" />
          tvar review
        </Link>
        <div className="ml-auto flex items-center gap-1">
          <p className="mr-2 hidden items-center gap-1 text-xs text-muted-foreground sm:flex">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
            <span className="ml-1">to search</span>
          </p>
          <ThemeToggle />
          <UserMenu login={viewer.login} />
        </div>
      </div>
    </header>
  );
}
