export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8" aria-busy="true" aria-live="polite">
      <div className="h-7 w-40 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-4 w-72 animate-pulse rounded bg-muted" />
      <div className="mt-6 flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-28 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
      <div className="mt-6 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-md bg-muted/70" />
        ))}
      </div>
    </div>
  );
}
