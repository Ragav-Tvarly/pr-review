import Link from "next/link";
import { fileAnchor } from "@/components/diff/types";
import type { Finding } from "@/lib/review/types";
import { cn } from "@/lib/utils";

const SEVERITY = {
  critical: { text: "Critical", cls: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300" },
  warning: { text: "Warning", cls: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  suggestion: { text: "Suggestion", cls: "border-border bg-muted text-muted-foreground" },
};

/** ID, severity, category, title and a link to the line in Files. `filesHref` is the PR's /files path. */
export function FindingHeader({ filesHref, f }: { filesHref: string; f: Finding }) {
  const sev = SEVERITY[f.severity];
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-mono text-xs text-muted-foreground">{f.id}</span>
      <span className={cn("rounded border px-1.5 py-0.5 text-[11px] font-medium", sev.cls)}>{sev.text}</span>
      <span className="text-xs text-muted-foreground">{f.category}</span>
      <span className="font-medium">{f.title}</span>
      {f.path && (
        <Link href={`${filesHref}#${fileAnchor(f.path)}`} className="ml-auto truncate font-mono text-xs text-primary hover:underline">
          {f.path}
          {f.line ? `:${f.line}` : ""}
        </Link>
      )}
    </div>
  );
}
