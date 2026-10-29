export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="h-40 animate-pulse rounded-lg bg-muted/70" />
      <div className="h-64 animate-pulse rounded-lg bg-muted/50" />
    </div>
  );
}
