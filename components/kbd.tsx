export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-mono text-[11px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}
