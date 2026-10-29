"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { DiffModeEnum, DiffView, getLang } from "@git-diff-view/react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { DiffFileItem } from "./types";
import { fileAnchor } from "./types";
import { cn } from "@/lib/utils";

export type FileDiffProps = {
  file: DiffFileItem;
  expanded: boolean;
  split: boolean;
  focused: boolean;
  canMarkViewed: boolean;
  onToggleExpanded: () => void;
  onToggleViewed: (viewed: boolean) => void;
  onFocus: () => void;
};

const STATUS: Partial<Record<DiffFileItem["status"], { text: string; cls: string }>> = {
  added: { text: "Added", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  removed: { text: "Deleted", cls: "bg-red-500/15 text-red-700 dark:text-red-300" },
  renamed: { text: "Renamed", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  copied: { text: "Copied", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
};

/** GitHub's REST `patch` starts at the first `@@`; the parser needs the ---/+++ file headers in front. */
function withFileHeaders(file: DiffFileItem): string {
  const oldName = file.status === "added" ? "/dev/null" : `a/${file.previousPath ?? file.path}`;
  const newName = file.status === "removed" ? "/dev/null" : `b/${file.path}`;
  return `--- ${oldName}\n+++ ${newName}\n${file.patch ?? ""}`;
}

export const FileDiff = forwardRef<HTMLDivElement, FileDiffProps>(function FileDiff(
  { file, expanded, split, focused, canMarkViewed, onToggleExpanded, onToggleViewed, onFocus },
  ref,
) {
  const { resolvedTheme } = useTheme();
  const bodyRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [forceLarge, setForceLarge] = useState(false);
  const id = fileAnchor(file.path);
  const status = STATUS[file.status];

  // Mount the (expensive) diff only once the file is near the viewport.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || near) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  const showDiff = expanded && near && file.patch && (!file.large || forceLarge);

  return (
    <section
      id={id}
      ref={ref}
      aria-labelledby={`${id}-path`}
      data-focused={focused || undefined}
      className={cn("scroll-mt-28 rounded-lg border border-border bg-card", focused && "ring-2 ring-ring")}
      onFocusCapture={onFocus}
    >
      <header className="sticky top-14 z-10 flex items-center gap-2 rounded-t-lg border-b border-border bg-card/95 px-2 py-1.5 backdrop-blur">
        <Button variant="ghost" size="icon" className="h-7 w-7" aria-expanded={expanded} aria-controls={`${id}-body`} onClick={onToggleExpanded}>
          {expanded ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
          <span className="sr-only">{expanded ? "Collapse" : "Expand"} diff</span>
        </Button>
        <h3 id={`${id}-path`} className="min-w-0 flex-1 truncate font-mono text-[13px]" title={file.path}>
          {file.previousPath && file.previousPath !== file.path && (
            <>
              <span className="text-muted-foreground">{file.previousPath}</span> <span aria-hidden="true">→</span>{" "}
            </>
          )}
          {file.path}
        </h3>
        {status && <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", status.cls)}>{status.text}</span>}
        {file.noise && <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">Generated</span>}
        <span className="hidden font-mono text-xs tabular-nums sm:inline">
          <span className="text-emerald-600 dark:text-emerald-400">+{file.additions}</span>{" "}
          <span className="text-red-600 dark:text-red-400">−{file.deletions}</span>
        </span>
        <a href={file.blobUrl} target="_blank" rel="noopener noreferrer" className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label={`Open ${file.path} on GitHub`}>
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
        <label className={cn("ml-1 flex items-center gap-1.5 rounded px-1.5 py-1 text-xs", canMarkViewed ? "cursor-pointer hover:bg-accent" : "opacity-60")}>
          <Checkbox checked={file.viewed} onCheckedChange={(v) => onToggleViewed(v === true)} disabled={!canMarkViewed} />
          Viewed
        </label>
      </header>
      <div id={`${id}-body`} ref={bodyRef} hidden={!expanded}>
        {!file.patch && (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            {file.changes === 0 ? "Binary file not shown." : "Diff too large to display here."}{" "}
            <a href={file.blobUrl} className="underline" target="_blank" rel="noopener noreferrer">
              View on GitHub
            </a>
            .
          </p>
        )}
        {file.patch && file.large && !forceLarge && (
          <p className="flex flex-wrap items-center gap-3 px-4 py-6 text-sm text-muted-foreground">
            Large diff ({file.changes.toLocaleString()} changed lines) hidden to keep the page fast.
            <Button variant="outline" size="sm" onClick={() => setForceLarge(true)}>
              Load diff
            </Button>
          </p>
        )}
        {showDiff && (
          <DiffView
            data={{
              oldFile: { fileName: file.previousPath ?? file.path, fileLang: getLang(file.previousPath ?? file.path) },
              newFile: { fileName: file.path, fileLang: getLang(file.path) },
              hunks: [withFileHeaders(file)],
            }}
            diffViewMode={split ? DiffModeEnum.Split : DiffModeEnum.Unified}
            diffViewTheme={resolvedTheme === "dark" ? "dark" : "light"}
            diffViewHighlight
            diffViewFontSize={12}
            diffViewAddWidget={false}
          />
        )}
        {expanded && !near && file.patch && <div className="h-24 animate-pulse bg-muted/30" aria-hidden="true" />}
      </div>
    </section>
  );
});
