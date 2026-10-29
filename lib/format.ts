const rtf = new Intl.RelativeTimeFormat("en", { numeric: "always", style: "narrow" });

/** "25m ago", "4h ago", "22d ago" — the GitHub-style short relative time. */
export function timeAgo(iso: string, now = Date.now()): string {
  const diff = (new Date(iso).getTime() - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return "just now";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return rtf.format(Math.round(diff / (86400 * 30)), "month");
}

/** Deterministic tooltip text (same on server and client): "2026-10-29 11:00 UTC". */
export function utcStamp(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}
