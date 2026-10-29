"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { ExternalLink, GitPullRequest, GitPullRequestDraft, Moon, Sun } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { PrSummary } from "@/lib/github/pulls";
import { prPath } from "@/lib/paths";

export function CommandPalette({ prs }: { prs: PrSummary[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pull requests or commands…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Pull requests">
          {prs.map((pr) => (
            <CommandItem
              key={pr.id}
              value={`#${pr.number} ${pr.title} ${pr.author.login}`}
              onSelect={() => go(() => router.push(prPath(pr)))}
            >
              {pr.isDraft ? (
                <GitPullRequestDraft className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              ) : (
                <GitPullRequest className="mr-2 h-4 w-4 text-primary" aria-hidden="true" />
              )}
              <span className="truncate">{pr.title}</span>
              <span className="ml-auto pl-3 font-mono text-xs text-muted-foreground">#{pr.number}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Commands">
          <CommandItem onSelect={() => go(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}>
            {resolvedTheme === "dark" ? (
              <Sun className="mr-2 h-4 w-4" aria-hidden="true" />
            ) : (
              <Moon className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Toggle theme
          </CommandItem>
          {[...new Set(prs.map((p) => p.repo))].map((repo) => (
            <CommandItem key={repo} onSelect={() => go(() => window.open(`https://github.com/${repo}/pulls`, "_blank", "noopener"))}>
              <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
              Open {repo} on GitHub
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
