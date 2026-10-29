import { cn } from "@/lib/utils";
import type { Risk } from "@/lib/review/types";

const STYLES: Record<Risk, string> = {
  critical: "border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300",
  high: "border-orange-500/40 bg-orange-500/15 text-orange-700 dark:text-orange-300",
  important: "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  normal: "border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-300",
  low: "border-slate-500/40 bg-slate-500/15 text-slate-700 dark:text-slate-300",
  safe: "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

export function RiskBadge({ risk, className }: { risk: Risk | null; className?: string }) {
  if (!risk) return <span className="text-xs text-muted-foreground">Not scored</span>;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
        STYLES[risk],
        className,
      )}
    >
      {risk}
    </span>
  );
}
