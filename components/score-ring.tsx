import { grade } from "@/lib/review/types";
import { cn } from "@/lib/utils";

const TONE = (score: number) => (score >= 80 ? "text-emerald-600 dark:text-emerald-400" : score >= 60 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400");

/** 0–100 quality score as a ring with the bar marked. Pure SVG, no library. */
export function ScoreRing({ score, bar, size = 112, className }: { score: number; bar: number; size?: number; className?: string }) {
  const r = 44;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const barAngle = (bar / 100) * 360 - 90;
  const bx = 50 + 52 * Math.cos((barAngle * Math.PI) / 180);
  const by = 50 + 52 * Math.sin((barAngle * Math.PI) / 180);
  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }} role="img" aria-label={`Quality score ${score} of 100, grade ${grade(score)}, bar ${bar}`}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} className="fill-none stroke-muted" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} className={cn("fill-none transition-[stroke-dashoffset] duration-700 ease-out", TONE(score))} stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
        <circle cx={bx} cy={by} r="3" className="fill-foreground" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-3xl font-semibold leading-none tabular-nums", TONE(score))}>{score}</span>
        <span className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">grade {grade(score)}</span>
      </div>
    </div>
  );
}
