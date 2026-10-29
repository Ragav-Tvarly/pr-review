"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Kbd } from "@/components/kbd";
import type { PrDetail } from "@/lib/github/pull-request";
import { prPath } from "@/lib/paths";
import { cn } from "@/lib/utils";

export function PrTabsNav({
  pr,
  actions,
}: {
  pr: PrDetail;
  actions?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const tabs = [
    { href: prPath(pr), label: "Overview", key: "o", count: null },
    {
      href: prPath(pr, "commits"),
      label: "Commits",
      key: "c",
      count: pr.commitCount,
    },
    {
      href: prPath(pr, "files"),
      label: "Files changed",
      key: "f",
      count: pr.changedFiles,
    },
  ];

  // "g" then o / c / f jumps between sections (same chords as GitHub and Graphene).
  useEffect(() => {
    let pendingG = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        target?.closest("input, textarea, select, [contenteditable=true]")
      )
        return;
      if (e.key === "g") {
        pendingG = true;
        clearTimeout(timer);
        timer = setTimeout(() => (pendingG = false), 1000);
        return;
      }
      if (!pendingG) return;
      pendingG = false;
      const tab = tabs.find((t) => t.key === e.key);
      if (tab) router.push(tab.href);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pr.id]);

  return (
    <div className="mt-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <nav
        aria-label="Pull request sections"
        className="-mb-px flex gap-1 overflow-x-auto"
      >
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors",
                active
                  ? "border-primary font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
              )}
            >
              {t.label}
              {t.count !== null && (
                <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                  {t.count}
                </span>
              )}
              <span
                className="hidden items-center gap-0.5 lg:inline-flex"
                aria-hidden="true"
              >
                <Kbd>g</Kbd>
                <Kbd>{t.key}</Kbd>
              </span>
            </Link>
          );
        })}
      </nav>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 pb-2">{actions}</div>
      )}
    </div>
  );
}
