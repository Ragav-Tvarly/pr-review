import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CountUp } from "@/components/count-up";
import type { WeekStats } from "@/lib/github/stats";

const LINES = [
  "Quiet week so far. The queue will not review itself.",
  "One down. Momentum is a thing.",
  "Reviews are flowing. Keep the queue short.",
  "Busy week. Someone deserves a coffee.",
];

export function WeekStatsStrip({ stats }: { stats: WeekStats }) {
  const top = stats.people.slice(0, 3);
  const line = LINES[Math.min(LINES.length - 1, Math.floor(stats.reviews / 3))]!;
  return (
    <section aria-labelledby="week-heading" className="rounded-lg border border-border bg-card/50 p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <h2 id="week-heading" className="text-sm font-medium">
          This week
        </h2>
        <Stat label="reviews" value={stats.reviews} />
        <Stat label="merged" value={stats.merged} />
        <Stat label="opened" value={stats.opened} />
        {stats.avgScore !== null && <Stat label="avg score" value={stats.avgScore} />}
        <p className="text-sm text-muted-foreground">{line}</p>
        {top.length > 0 && (
          <ol className="ml-auto flex items-center gap-3" aria-label="Most active this week">
            {top.map((p, i) => (
              <li key={p.login} className="flex items-center gap-1.5 text-xs">
                <span className="font-mono text-muted-foreground">{i + 1}</span>
                <Avatar className="h-5 w-5">
                  <AvatarImage src={p.avatarUrl} alt="" />
                  <AvatarFallback className="text-[10px]">{p.login.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="hidden sm:inline">{p.login}</span>
                <span className="text-muted-foreground">
                  {p.reviews} rev · {p.merged} merged
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <p className="text-sm">
      <CountUp value={value} className="text-lg font-semibold tabular-nums" />
      <span className="sr-only">{value}</span> <span className="text-muted-foreground">{label}</span>
    </p>
  );
}
