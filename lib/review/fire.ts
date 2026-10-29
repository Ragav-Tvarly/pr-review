"use server";

import { viewer } from "@/lib/github/client";

export type FireResult = { fired: number[]; failed: { number: number; error: string }[]; configured: boolean };

/**
 * Ask the Claude Code scheduled task (owned by admin@tvarlaunchpad.com) to review these PRs.
 * One fire per PR so each review runs in its own session. The task's prompt only accepts
 * "owner/repo#number" tokens from the fire payload, optionally followed by "fix".
 */
export async function fireReviews(repo: string, numbers: number[], mode: "review" | "fix" = "review"): Promise<FireResult> {
  await viewer(); // throws when not signed in
  const url = process.env.ROUTINE_FIRE_URL;
  const token = process.env.ROUTINE_FIRE_TOKEN;
  if (!url || !token) return { fired: [], failed: [], configured: false };
  const unique = [...new Set(numbers)].slice(0, 10);
  const results = await Promise.all(
    unique.map(async (number) => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "anthropic-beta": "experimental-cc-routine-2026-04-01" },
          body: JSON.stringify({ text: `${repo}#${number}${mode === "fix" ? " fix" : ""}` }),
          cache: "no-store",
        });
        if (!res.ok) return { number, error: `${res.status} ${(await res.text()).slice(0, 200)}` };
        return { number };
      } catch (e) {
        return { number, error: e instanceof Error ? e.message : "network error" };
      }
    }),
  );
  return {
    fired: results.filter((r) => !("error" in r)).map((r) => r.number),
    failed: results.filter((r): r is { number: number; error: string } => "error" in r),
    configured: true,
  };
}
