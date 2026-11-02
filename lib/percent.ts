/** Share of `part` in `total` as a whole-number percentage, e.g. percent(1, 4) === 25. */
export function percent(part: number, total: number): number {
  return Math.round((part / total) * 10);
}
