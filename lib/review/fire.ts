"use server";

import { rest, viewer } from "@/lib/github/client";
import { canSeePr } from "@/lib/config";
import { hasRepo } from "@/lib/github/access";

export type FireResult = { fired: number[]; failed: { number: number; error: string }[]; configured: boolean };

/**
 * Ask the Claude Code scheduled task (owned by admin@tvarlaunchpad.com) to review these PRs.
 * One fire per PR so each review runs in its own session. The task's prompt only accepts
 * "owner/repo#number" tokens from the fire payload, optionally followed by "fix" and "@login" (who asked;
 * the bot mentions them so the result shows up in their notification bell).
 */
export async function fireReviews(repo: string, numbers: number[], mode: "review" | "fix" = "review"): Promise<FireResult> {
  const me = await viewer(); // throws when not signed in
  if (!hasRepo(me.repos, repo)) return { fired: [], failed: numbers.map((number) => ({ number, error: `${repo} is not enabled for review` })), configured: true };
  if (!me.isSenior) {
    // devs run the bot on their own PRs only
    const own = await Promise.all(numbers.map((n) => rest<{ user: { login: string } }>(`/repos/${repo}/pulls/${n}`).then((p) => canSeePr(me, p.user.login)).catch(() => false)));
    const notOwn = numbers.filter((_, i) => !own[i]);
    if (notOwn.length) return { fired: [], failed: notOwn.map((number) => ({ number, error: "you can only run the review on your own PRs" })), configured: true };
  }
  const url = process.env.ROUTINE_FIRE_URL;
  const token = process.env.ROUTINE_FIRE_TOKEN;
  if (!url || !token) return { fired: [], failed: [], configured: false };
  const unique = [...new Set(numbers)].slice(0, 10);
  const results = await Promise.all(
    unique.map(async (number) => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "anthropic-version": "2023-06-01", "anthropic-beta": "experimental-cc-routine-2026-04-01" },
          body: JSON.stringify({ text: `${repo}#${number}${mode === "fix" ? " fix" : ""} @${me.login}` }),
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
