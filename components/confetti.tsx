"use client";

import { useEffect } from "react";

/**
 * A short confetti burst, fired once per `once` key (remembered in sessionStorage so a refresh
 * does not replay it). Pure canvas, ~1.2s, skipped when the user prefers reduced motion.
 */
export function Confetti({ once }: { once: string }) {
  useEffect(() => {
    const key = `confetti:${once}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "60" });
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const colors = ["#10b981", "#f59e0b", "#3b82f6", "#ec4899", "#8b5cf6"];
    const pieces = Array.from({ length: 140 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 120,
      y: innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 14 - 4,
      w: 6 + Math.random() * 6,
      h: 3 + Math.random() * 4,
      a: Math.random() * Math.PI,
      va: (Math.random() - 0.5) * 0.3,
      c: colors[Math.floor(Math.random() * colors.length)]!,
    }));
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = (now - start) / 1000;
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      for (const p of pieces) {
        p.vy += 0.35;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.99;
        p.a += p.va;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - t / 1.4);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.a);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (t < 1.5) raf = requestAnimationFrame(tick);
      else canvas.remove();
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      canvas.remove();
    };
  }, [once]);
  return null;
}
