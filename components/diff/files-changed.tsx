"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { ChevronsDownUp, ChevronsUpDown, Columns2, Rows3 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Kbd } from "@/components/kbd";
import { FileDiff } from "./file-diff";
import { FileTree } from "./file-tree";
import type { DiffFileItem } from "./types";
import { markViewed } from "@/lib/github/actions";
import { cn } from "@/lib/utils";

type Sort = "path" | "importance";

// Split/unified preference lives in localStorage; useSyncExternalStore keeps SSR (split) and client in step.
const DIFF_MODE_EVENT = "diff-mode-change";
function readDiffMode(): "split" | "unified" {
  try {
    return localStorage.getItem("diff-mode") === "unified" ? "unified" : "split";
  } catch {
    return "split";
  }
}
function writeDiffMode(mode: "split" | "unified") {
  try {
    localStorage.setItem("diff-mode", mode);
  } catch {}
  window.dispatchEvent(new Event(DIFF_MODE_EVENT));
}
function subscribeDiffMode(cb: () => void) {
  window.addEventListener(DIFF_MODE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(DIFF_MODE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
const HUNK_SELECTOR = "td.diff-line-hunk-content";

export function FilesChanged({ prId, files: initial, canMarkViewed }: { prId: string; repo: string; number: number; files: DiffFileItem[]; canMarkViewed: boolean }) {
  const [files, setFiles] = useState(initial);
  const split = useSyncExternalStore(subscribeDiffMode, () => readDiffMode() === "split", () => true);
  const [sort, setSort] = useState<Sort>(initial.some((f) => f.importance !== undefined) ? "importance" : "path");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(initial.filter((f) => !f.noise).map((f) => f.path)));
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const refs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [, startTransition] = useTransition();

  const changeSplit = (next: boolean) => writeDiffMode(next ? "split" : "unified");

  const ordered = useMemo(() => {
    const list = [...files];
    if (sort === "importance") list.sort((a, b) => (b.importance ?? -1) - (a.importance ?? -1) || a.path.localeCompare(b.path));
    else list.sort((a, b) => a.path.localeCompare(b.path));
    return list;
  }, [files, sort]);

  const viewedCount = files.filter((f) => f.viewed).length;
  const focused = focusedIndex >= 0 ? ordered[focusedIndex] : undefined;

  const scrollTo = useCallback(
    (path: string) => {
      const idx = ordered.findIndex((f) => f.path === path);
      setFocusedIndex(idx);
      setExpanded((s) => new Set(s).add(path));
      const el = refs.current.get(path);
      el?.scrollIntoView({ block: "start", behavior: "smooth" });
      el?.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
    },
    [ordered],
  );

  const toggleViewed = useCallback(
    (path: string, viewed: boolean) => {
      setFiles((fs) => fs.map((f) => (f.path === path ? { ...f, viewed } : f)));
      if (viewed) setExpanded((s) => {
        const next = new Set(s);
        next.delete(path);
        return next;
      });
      startTransition(async () => {
        const res = await markViewed(prId, path, viewed);
        if (!res.ok) {
          setFiles((fs) => fs.map((f) => (f.path === path ? { ...f, viewed: !viewed } : f)));
          toast.error(`Could not update viewed state: ${res.error}`);
        }
      });
    },
    [prId],
  );

  const toggleExpanded = useCallback((path: string) => {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // Keyboard: j/k files, n/p hunks, v viewed, [ ] collapse/expand, x split/unified.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || target?.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      const move = (delta: number) => {
        e.preventDefault();
        const next = Math.min(ordered.length - 1, Math.max(0, (focusedIndex < 0 ? (delta > 0 ? -1 : 0) : focusedIndex) + delta));
        const f = ordered[next];
        if (f) scrollTo(f.path);
      };
      switch (e.key) {
        case "j":
          return move(1);
        case "k":
          return move(-1);
        case "n":
        case "p": {
          e.preventDefault();
          const hunks = [...document.querySelectorAll<HTMLElement>(HUNK_SELECTOR)].filter((h) => h.offsetParent !== null);
          const y = window.scrollY + 120;
          const next = e.key === "n" ? hunks.find((h) => h.getBoundingClientRect().top + window.scrollY > y + 4) : [...hunks].reverse().find((h) => h.getBoundingClientRect().top + window.scrollY < y - 4);
          if (next) next.scrollIntoView({ block: "start", behavior: "smooth" });
          else move(e.key === "n" ? 1 : -1); // diffs mount lazily, so fall through to the next file
          return;
        }
        case "v":
          if (focused && canMarkViewed) toggleViewed(focused.path, !focused.viewed);
          return;
        case "[":
          if (focused) setExpanded((s) => {
            const n = new Set(s);
            n.delete(focused.path);
            return n;
          });
          return;
        case "]":
          if (focused) setExpanded((s) => new Set(s).add(focused.path));
          return;
        case "x":
          changeSplit(!split);
          return;
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ordered, focusedIndex, focused, scrollTo, toggleViewed, canMarkViewed, split]);

  const allExpanded = ordered.every((f) => expanded.has(f.path));

  return (
    <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
        <div className="mb-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {files.length} {files.length === 1 ? "file" : "files"} changed
            </span>
            <span className="text-muted-foreground" role="status">
              {viewedCount}/{files.length} viewed
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${files.length ? (viewedCount / files.length) * 100 : 0}%` }} />
          </div>
        </div>
        <FileTree files={ordered} activePath={focused?.path ?? null} onSelect={scrollTo} />
      </aside>

      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
            <SelectTrigger className="h-8 w-44 text-xs" aria-label="Sort files">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="path">Sort by path</SelectItem>
              <SelectItem value="importance" disabled={!files.some((f) => f.importance !== undefined)}>
                Sort by importance
              </SelectItem>
            </SelectContent>
          </Select>
          <div role="group" aria-label="Diff layout" className="inline-flex overflow-hidden rounded-md border border-border">
            <Button variant="ghost" size="sm" className={cn("h-8 rounded-none text-xs", split && "bg-accent")} aria-pressed={split} onClick={() => changeSplit(true)}>
              <Columns2 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Split
            </Button>
            <Button variant="ghost" size="sm" className={cn("h-8 rounded-none text-xs", !split && "bg-accent")} aria-pressed={!split} onClick={() => changeSplit(false)}>
              <Rows3 className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
              Unified
            </Button>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setExpanded(allExpanded ? new Set() : new Set(ordered.map((f) => f.path)))}>
            {allExpanded ? <ChevronsDownUp className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" /> : <ChevronsUpDown className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />}
            {allExpanded ? "Collapse all" : "Expand all"}
          </Button>
          <p className="ml-auto hidden items-center gap-1 text-xs text-muted-foreground xl:flex">
            <Kbd>j</Kbd>
            <Kbd>k</Kbd> files <Kbd>n</Kbd>
            <Kbd>p</Kbd> hunks <Kbd>v</Kbd> viewed <Kbd>x</Kbd> layout
          </p>
        </div>

        {ordered.map((file) => (
          <FileDiff
            key={file.path}
            ref={(el) => {
              if (el) refs.current.set(file.path, el);
              else refs.current.delete(file.path);
            }}
            file={file}
            expanded={expanded.has(file.path)}
            split={split}
            focused={focused?.path === file.path}
            canMarkViewed={canMarkViewed}
            onToggleExpanded={() => toggleExpanded(file.path)}
            onToggleViewed={(v) => toggleViewed(file.path, v)}
            onFocus={() => setFocusedIndex(ordered.findIndex((f) => f.path === file.path))}
          />
        ))}
      </div>
    </div>
  );
}
