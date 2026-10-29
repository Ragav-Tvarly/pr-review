"use client";

import { Check, FileText, Folder } from "lucide-react";
import type { DiffFileItem } from "./types";
import { fileAnchor } from "./types";
import { cn } from "@/lib/utils";

type Node = { name: string; path: string; file?: DiffFileItem; children: Map<string, Node> };

function buildTree(files: DiffFileItem[]): Node {
  const root: Node = { name: "", path: "", children: new Map() };
  for (const file of files) {
    const parts = file.path.split("/");
    let node = root;
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join("/");
      let child = node.children.get(part);
      if (!child) {
        child = { name: part, path, children: new Map() };
        node.children.set(part, child);
      }
      node = child;
    });
    node.file = file;
  }
  return root;
}

/** Collapse single-child directory chains (a/b/c) the way GitHub's tree does. */
function compress(node: Node): Node {
  let current = node;
  while (!current.file && current.children.size === 1) {
    const only = [...current.children.values()][0]!;
    if (only.file) break;
    current = { ...only, name: `${current.name}/${only.name}` };
  }
  return { ...current, children: new Map([...current.children].map(([k, v]) => [k, compress(v)])) };
}

export function FileTree({ files, activePath, onSelect }: { files: DiffFileItem[]; activePath: string | null; onSelect: (path: string) => void }) {
  const tree = compress(buildTree(files));
  return (
    <nav aria-label="Changed files" className="text-sm">
      <TreeLevel node={tree} depth={0} activePath={activePath} onSelect={onSelect} />
    </nav>
  );
}

function TreeLevel({ node, depth, activePath, onSelect }: { node: Node; depth: number; activePath: string | null; onSelect: (path: string) => void }) {
  const entries = [...node.children.values()].sort((a, b) => Number(!!a.file) - Number(!!b.file) || a.name.localeCompare(b.name));
  return (
    <ul className={cn(depth > 0 && "ml-3 border-l border-border pl-1")}>
      {entries.map((child) =>
        child.file ? (
          <li key={child.path}>
            <a
              href={`#${fileAnchor(child.path)}`}
              onClick={(e) => {
                e.preventDefault();
                onSelect(child.path);
              }}
              aria-current={activePath === child.path ? "true" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-accent",
                activePath === child.path && "bg-accent font-medium",
                child.file.viewed && "text-muted-foreground",
              )}
            >
              {child.file.viewed ? (
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Viewed" />
              ) : (
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 truncate" title={child.path}>
                {child.name}
              </span>
              {child.file.importance !== undefined && (
                <span className="rounded bg-muted px-1 font-mono text-[10px] tabular-nums text-muted-foreground" title="Importance">
                  {child.file.importance}
                </span>
              )}
              <span className="shrink-0 font-mono text-[11px] tabular-nums">
                {child.file.additions > 0 && <span className="text-emerald-600 dark:text-emerald-400">+{child.file.additions}</span>}
                {child.file.deletions > 0 && <span className="ml-1 text-red-600 dark:text-red-400">−{child.file.deletions}</span>}
              </span>
            </a>
          </li>
        ) : (
          <li key={child.path}>
            <details open className="group">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded px-1.5 py-1 text-muted-foreground hover:bg-accent [&::-webkit-details-marker]:hidden">
                <Folder className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{child.name}</span>
              </summary>
              <TreeLevel node={child} depth={depth + 1} activePath={activePath} onSelect={onSelect} />
            </details>
          </li>
        ),
      )}
    </ul>
  );
}
