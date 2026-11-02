"use server";

import { cachedRead, rest, viewer } from "./client";
import { hasRepo } from "./access";
import { parseMarker } from "@/lib/review/parse";
import { canSeePr } from "@/lib/config";

/** One PR notification from the user's own GitHub inbox, worded for the dashboard. GitHub keeps read state. */
export type Notice = { id: string; repo: string; number: number; title: string; text: string; unread: boolean; updatedAt: string };

type Thread = {
  id: string;
  unread: boolean;
  reason: string;
  updated_at: string;
  repository: { full_name: string };
  subject: { type: string; title: string; url: string | null; latest_comment_url: string | null };
};
type Item = { user?: { login: string }; body?: string | null; state?: string; html_url?: string; merged?: boolean };

const LIMIT = 30;

export async function listNotifications(): Promise<Notice[]> {
  const me = await viewer();
  const since = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const threads = await rest<Thread[]>(`/notifications?all=true&per_page=50&since=${since}`);
  let prs = threads.filter((t) => t.subject.type === "PullRequest" && t.subject.url && hasRepo(me.repos, t.repository.full_name));
  if (!me.isSenior) {
    // devs: only notifications about PRs they opened (others' PRs are not visible to them)
    const authors = await Promise.all(prs.map((t) => prAuthor(t.subject.url!)));
    prs = prs.filter((_, i) => canSeePr(me, authors[i] ?? ""));
  }
  prs = prs.slice(0, LIMIT);
  return Promise.all(
    prs.map(async (t) => {
      const number = Number(t.subject.url!.split("/").pop());
      return { id: t.id, repo: t.repository.full_name, number, title: t.subject.title, unread: t.unread, updatedAt: t.updated_at, text: await describe(t, number) };
    }),
  );
}

/** PR author never changes, so cache it long. */
async function prAuthor(url: string): Promise<string | null> {
  const path = new URL(url).pathname;
  return cachedRead(["pr-author", path], [], (token) => rest<{ user: { login: string } | null }>(path, { token }).then((p) => p.user?.login ?? null).catch(() => null), 86_400);
}

/** What happened, from the latest comment/review GitHub points at (cached per item version). */
async function describe(t: Thread, n: number): Promise<string> {
  const url = t.subject.latest_comment_url;
  const generic = () => {
    if (t.reason === "review_requested") return `Your review was requested on #${n}`;
    if (t.reason === "author") return `Activity on your PR #${n}`;
    return `Activity on #${n}`;
  };
  if (!url) {
    // GitHub leaves latest_comment_url empty for review events: use the PR's newest review if it is this update
    const prPath = new URL(t.subject.url!).pathname;
    const reviews = await cachedRead(["notice-reviews", prPath, t.updated_at], [], (token) => rest<(Item & { submitted_at?: string })[]>(`${prPath}/reviews?per_page=100`, { token }).catch(() => []), 3600);
    const last = reviews.at(-1);
    if (!last?.submitted_at || Math.abs(Date.parse(last.submitted_at) - Date.parse(t.updated_at)) > 5 * 60_000) return generic();
    return describeReview(last, n);
  }
  const path = url.replace("https://api.github.com", "");
  const item = await cachedRead(["notice", path, t.updated_at], [], (token) => rest<Item>(path, { token }).catch(() => null), 3600);
  if (!item) return generic();
  const who = item.user?.login ?? "Someone";
  if (path === new URL(t.subject.url!).pathname) {
    // points at the PR itself: a state change
    if (item.merged) return `#${n} was merged`;
    if (item.state === "closed") return `#${n} was closed`;
    return generic();
  }
  const review = item.body ? parseMarker(item.body) : null;
  if (review) return `${who} reviewed #${n} · score ${review.score} · ${review.risk} risk`;
  if (path.includes("/reviews/")) return describeReview(item, n);
  if (path.includes("/pulls/comments/")) return `${who} commented on a line in #${n}`;
  if (t.reason === "mention") return `${who} mentioned you on #${n}`;
  return `${who} commented on #${n}`;
}

function describeReview(item: Item, n: number): string {
  const who = item.user?.login ?? "Someone";
  if (item.state === "APPROVED") return `${who} approved #${n}`;
  if (item.state === "CHANGES_REQUESTED") return `${who} requested changes on #${n}`;
  // the review bot ends its body with "Requested by @x · score S · risk R"
  const m = item.body?.match(/score (\d+) · risk (\w+)/);
  return m ? `${who} reviewed #${n} · score ${m[1]} · ${m[2]} risk` : `${who} reviewed #${n}`;
}

export async function markNoticeRead(id: string): Promise<void> {
  await rest(`/notifications/threads/${encodeURIComponent(id)}`, { method: "PATCH" }).catch(() => undefined);
}

/** Marks read only in the enabled repos this user sees, not their whole GitHub inbox. */
export async function markAllNoticesRead(): Promise<void> {
  const me = await viewer();
  const at = new Date().toISOString();
  await Promise.all(me.repos.map((r) => rest(`/repos/${r}/notifications`, { method: "PUT", body: JSON.stringify({ last_read_at: at }) }).catch(() => undefined)));
}
