/** Share of `part` in `total` as a whole-number percentage, e.g. percent(1, 4) === 25. */
export function percent(part: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}
