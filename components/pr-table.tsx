"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, CircleDashed, GitPullRequest, GitPullRequestDraft, Search, XCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RiskBadge } from "@/components/risk-badge";
import type { PrSummary } from "@/lib/github/pulls";
import { countTabs, TABS, tabsFor, type Tab } from "@/lib/pr-status";
import { timeAgo, utcStamp } from "@/lib/format";
import { prPath } from "@/lib/paths";
import { RISK_LABEL_PREFIX } from "@/lib/review/types";
import { cn } from "@/lib/utils";

const TAB_IDS = new Set<string>(TABS.map((t) => t.id));

export function PrTable({ prs, viewer, toolbar }: { prs: PrSummary[]; viewer: string; toolbar?: (selected: PrSummary[]) => React.ReactNode }) {
  const router = useRouter();
  const params = useSearchParams();
  const tabParam = params.get("tab") ?? "all";
  const tab: Tab = (TAB_IDS.has(tabParam) ? tabParam : "all") as Tab;
  const [query, setQuery] = useState("");
  const [author, setAuthor] = useState("all");
  const [repo, setRepo] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const counts = useMemo(() => countTabs(prs, viewer), [prs, viewer]);
  const authors = useMemo(() => [...new Set(prs.map((p) => p.author.login))].sort(), [prs]);
  const repos = useMemo(() => [...new Set(prs.map((p) => p.repo))].sort(), [prs]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prs.filter(
      (pr) =>
        tabsFor(pr, viewer).has(tab) &&
        (author === "all" || pr.author.login === author) &&
        (repo === "all" || pr.repo === repo) &&
        (!q || pr.title.toLowerCase().includes(q) || String(pr.number).includes(q) || pr.headRefName.toLowerCase().includes(q)),
    );
  }, [prs, viewer, tab, author, repo, query]);

  const setTab = (next: Tab) => {
    const sp = new URLSearchParams(params.toString());
    if (next === "all") sp.delete("tab");
    else sp.set("tab", next);
    router.replace(sp.size ? `/?${sp}` : "/", { scroll: false });
  };

  const allVisibleSelected = visible.length > 0 && visible.every((p) => selected.has(p.id));
  const toggleAll = () =>
    setSelected((s) => {
      const next = new Set(s);
      if (allVisibleSelected) visible.forEach((p) => next.delete(p.id));
      else visible.forEach((p) => next.add(p.id));
      return next;
    });
  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const selectedPrs = prs.filter((p) => selected.has(p.id));

  return (
    <div className="space-y-4">
      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Button
            key={t.id}
            type="button"
            variant={tab === t.id ? "secondary" : "outline"}
            size="sm"
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn("gap-2", tab === t.id && "border-primary/40 ring-1 ring-primary/30")}
          >
            {t.label}
            <span
              className={cn(
                "inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                counts[t.id] > 0 ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              {counts[t.id]}
            </span>
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:max-w-sm">
          <label htmlFor="pr-filter" className="sr-only">
            Filter pull requests by title, number or branch
          </label>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id="pr-filter" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter pull requests…" className="pl-8" />
        </div>
        {repos.length > 1 && (
          <Select value={repo} onValueChange={setRepo}>
            <SelectTrigger className="w-44" aria-label="Repository">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All repos</SelectItem>
              {repos.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={author} onValueChange={setAuthor}>
          <SelectTrigger className="w-44" aria-label="Author">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All authors</SelectItem>
            {authors.map((a) => (
              <SelectItem key={a} value={a}>
                {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground" role="status">
          {visible.length === prs.length ? `${prs.length} open` : `${visible.length} of ${prs.length}`}
          {selected.size > 0 && ` · ${selected.size} selected`}
        </p>
        {toolbar && <div className="ml-auto">{toolbar(selectedPrs)}</div>}
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <Table>
          <caption className="sr-only">Open pull requests</caption>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead scope="col" className="w-10">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={toggleAll}
                  aria-label={allVisibleSelected ? "Deselect all visible pull requests" : "Select all visible pull requests"}
                  disabled={visible.length === 0}
                />
              </TableHead>
              <TableHead scope="col">Title</TableHead>
              <TableHead scope="col" className="hidden md:table-cell">Author</TableHead>
              <TableHead scope="col">Risk</TableHead>
              <TableHead scope="col" className="hidden lg:table-cell">Labels</TableHead>
              <TableHead scope="col" className="hidden sm:table-cell">Status</TableHead>
              <TableHead scope="col" className="text-right">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  No pull requests match these filters.
                </TableCell>
              </TableRow>
            )}
            {visible.map((pr) => {
              const labels = pr.labels.filter((l) => !l.name.startsWith(RISK_LABEL_PREFIX));
              return (
                <TableRow key={pr.id} data-state={selected.has(pr.id) ? "selected" : undefined} className="group">
                  <TableCell>
                    <Checkbox checked={selected.has(pr.id)} onCheckedChange={() => toggle(pr.id)} aria-label={`Select #${pr.number} ${pr.title}`} />
                  </TableCell>
                  <TableCell className="max-w-[28rem]">
                    <div className="flex items-start gap-2">
                      {pr.isDraft ? (
                        <GitPullRequestDraft className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      ) : (
                        <GitPullRequest className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      )}
                      <div className="min-w-0">
                        <Link href={prPath(pr)} className="block truncate font-medium hover:underline">
                          {pr.title}
                        </Link>
                        <p className="truncate text-xs text-muted-foreground">
                          <span className="font-mono">#{pr.number}</span> opened by {pr.author.login}
                          <span className="hidden sm:inline">
                            {" "}
                            · <span className="font-mono">{pr.headRefName}</span> → <span className="font-mono">{pr.baseRefName}</span>
                          </span>
                          <span className="ml-2 font-mono text-emerald-600 dark:text-emerald-400">+{pr.additions}</span>{" "}
                          <span className="font-mono text-red-600 dark:text-red-400">−{pr.deletions}</span>
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={pr.author.avatarUrl} alt="" />
                        <AvatarFallback className="text-[10px]">{pr.author.login.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="truncate text-sm">{pr.author.login}</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <RiskBadge risk={pr.risk} />
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <span className="flex flex-wrap gap-1">
                      {labels.map((l) => (
                        <span
                          key={l.name}
                          className="rounded-full border px-2 py-0.5 text-[11px]"
                          style={{ borderColor: `#${l.color}66`, backgroundColor: `#${l.color}1a` }}
                        >
                          {l.name}
                        </span>
                      ))}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="flex items-center gap-2">
                      <StatusPill pr={pr} />
                      <ChecksIcon state={pr.checks} />
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right text-sm text-muted-foreground">
                    <time dateTime={pr.updatedAt} title={utcStamp(pr.updatedAt)} suppressHydrationWarning>
                      {timeAgo(pr.updatedAt)}
                    </time>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatusPill({ pr }: { pr: PrSummary }) {
  if (pr.isDraft) return <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">Draft</span>;
  if (pr.reviewDecision === "APPROVED")
    return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">Approved</span>;
  if (pr.reviewDecision === "CHANGES_REQUESTED")
    return <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300">Changes requested</span>;
  return <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">Open</span>;
}

function ChecksIcon({ state }: { state: PrSummary["checks"] }) {
  if (!state) return null;
  const map = {
    SUCCESS: { Icon: CheckCircle2, cls: "text-emerald-600 dark:text-emerald-400", text: "Checks passed" },
    FAILURE: { Icon: XCircle, cls: "text-red-600 dark:text-red-400", text: "Checks failed" },
    ERROR: { Icon: XCircle, cls: "text-red-600 dark:text-red-400", text: "Checks errored" },
    PENDING: { Icon: CircleDashed, cls: "text-amber-600 dark:text-amber-400", text: "Checks pending" },
    EXPECTED: { Icon: CircleDashed, cls: "text-amber-600 dark:text-amber-400", text: "Checks expected" },
  }[state];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex" tabIndex={0}>
          <map.Icon className={cn("h-4 w-4", map.cls)} aria-hidden="true" />
          <span className="sr-only">{map.text}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{map.text}</TooltipContent>
    </Tooltip>
  );
}
