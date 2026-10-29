const NOISE_PATTERNS = [
  /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|Cargo\.lock|poetry\.lock|composer\.lock|Gemfile\.lock)$/,
  /\.(snap|min\.js|min\.css|map)$/,
  /(^|\/)(dist|build|\.next|out|coverage|node_modules)\//,
  /\.generated\.|\.g\.(ts|js|dart)$/,
];

/** Files that rarely need human attention: lockfiles, generated output, snapshots. Shown collapsed. */
export function isNoisePath(path: string): boolean {
  return NOISE_PATTERNS.some((re) => re.test(path));
}

export const LARGE_FILE_CHANGES = 1500;

export function isLargeFile(changes: number): boolean {
  return changes > LARGE_FILE_CHANGES;
}
