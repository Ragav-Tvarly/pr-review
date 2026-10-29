"use client";

import { useEffect, useState } from "react";

/** Animates a number from 0 to `value` once on mount (skipped when the user prefers reduced motion). */
export function CountUp({ value, duration = 900, className }: { value: number; duration?: number; className?: string }) {
  const [shown, setShown] = useState(() => (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? value : 0));
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(value * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return (
    <span className={className} aria-hidden="true">
      {shown}
    </span>
  );
}
