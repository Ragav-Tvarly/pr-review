"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A titled panel that folds up from its header. Open or closed is remembered per section `id` in this
 * browser (so collapsing "Description" keeps it collapsed on every PR). `bare` drops the outer border
 * for a fold inside another card.
 */
export function CollapsibleSection({ id, title, children, defaultOpen = true, bare = false, className }: { id: string; title: ReactNode; children: ReactNode; defaultOpen?: boolean; bare?: boolean; className?: string }) {
  const key = `section-open:${id}`;
  // saved choice from this browser; the server render (and a browser without storage) uses defaultOpen
  const saved = useSyncExternalStore(subscribe, () => read(key), () => null);
  const [toggled, setToggled] = useState<boolean | null>(null);
  const open = toggled ?? (saved === null ? defaultOpen : saved === "1");

  return (
    <details
      open={open}
      onToggle={(e) => {
        const next = e.currentTarget.open;
        if (next === open) return;
        setToggled(next);
        try {
          localStorage.setItem(key, next ? "1" : "0");
        } catch {}
      }}
      className={cn("group", !bare && "rounded-lg border border-border", className)}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-1.5 px-4 py-2.5 text-sm font-medium hover:bg-muted/40 [&::-webkit-details-marker]:hidden",
          !bare && "rounded-lg group-open:rounded-b-none group-open:border-b group-open:border-border",
        )}
      >
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
        <h2 id={`${id}-heading`} className="min-w-0 flex-1">
          {title}
        </h2>
      </summary>
      {children}
    </details>
  );
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}
