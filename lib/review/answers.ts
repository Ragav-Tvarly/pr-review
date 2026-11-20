import type { ReviewComment } from "@/lib/github/pull-request";

export type Answer = { author: string; body: string; createdAt: string; url: string };

/**
 * Latest human reply per bot thread, keyed by the thread's root comment id (a finding's commentId).
 * Replies by the root comment's author (the bot) are ignored. Matches the rule in review/REVIEW.md:
 * the latest collaborator reply is the decision.
 */
export function askAnswers(comments: Pick<ReviewComment, "id" | "author" | "body" | "createdAt" | "url" | "inReplyTo">[]): Record<number, Answer> {
  const rootAuthor = new Map(comments.map((c) => [c.id, c.author]));
  const out: Record<number, Answer> = {};
  for (const c of comments) {
    if (c.inReplyTo == null || c.author === rootAuthor.get(c.inReplyTo)) continue;
    const prev = out[c.inReplyTo];
    if (!prev || c.createdAt >= prev.createdAt) out[c.inReplyTo] = { author: c.author, body: c.body, createdAt: c.createdAt, url: c.url };
  }
  return out;
}
