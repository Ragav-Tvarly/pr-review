import { cachedRead, graphql } from "./client";
import { repos } from "@/lib/config";
import { parseMarker } from "@/lib/review/parse";

export type PersonStats = { login: string; avatarUrl: string; reviews: number; approvals: number; merged: number; opened: number; scores: number[] };
export type WeekStats = { since: string; people: PersonStats[]; merged: number; opened: number; reviews: number; avgScore: number | null };

const SEARCH = /* GraphQL */ `
  query WeekActivity($q: String!) {
    search(query: $q, type: ISSUE, first: 60) {
      nodes {
        ... on PullRequest {
          number
          createdAt
          merged
          mergedAt
          mergedBy { login avatarUrl }
          author { login avatarUrl }
          reviews(first: 30) { nodes { author { login avatarUrl } state submittedAt } }
          comments(last: 30) { nodes { body createdAt } }
        }
      }
    }
  }
`;

type Node = {
  number: number;
  createdAt: string;
  merged: boolean;
  mergedAt: string | null;
  mergedBy: { login: string; avatarUrl: string } | null;
  author: { login: string; avatarUrl: string } | null;
  reviews: { nodes: { author: { login: string; avatarUrl: string } | null; state: string; submittedAt: string }[] };
  comments: { nodes: { body: string; createdAt: string }[] };
};

/** Monday 00:00 UTC of the current week. */
export function weekStart(now = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d;
}

export async function getWeekStats(): Promise<WeekStats> {
  return cachedRead(["week", ...repos()], ["pr-list"], (token) => fetchWeekStats(token), 300);
}

async function fetchWeekStats(token: string): Promise<WeekStats> {
  const since = weekStart();
  const sinceIso = since.toISOString().slice(0, 10);
  const people = new Map<string, PersonStats>();
  const person = (login: string, avatarUrl: string) => {
    let p = people.get(login);
    if (!p) people.set(login, (p = { login, avatarUrl, reviews: 0, approvals: 0, merged: 0, opened: 0, scores: [] }));
    return p;
  };
  let merged = 0;
  let opened = 0;
  let reviews = 0;
  const scores: number[] = [];

  for (const repo of repos()) {
    const data = await graphql<{ search: { nodes: Node[] } }>(SEARCH, { q: `repo:${repo} is:pr updated:>=${sinceIso}` }, token);
    for (const pr of data.search.nodes) {
      if (!pr?.number) continue;
      if (pr.createdAt >= since.toISOString() && pr.author) {
        opened += 1;
        person(pr.author.login, pr.author.avatarUrl).opened += 1;
      }
      if (pr.merged && pr.mergedAt && pr.mergedAt >= since.toISOString()) {
        merged += 1;
        if (pr.mergedBy) person(pr.mergedBy.login, pr.mergedBy.avatarUrl).merged += 1;
      }
      for (const r of pr.reviews.nodes) {
        if (!r.author || r.submittedAt < since.toISOString() || r.author.login === pr.author?.login) continue;
        if (r.author.login.endsWith("[bot]") || r.author.login === "tvar-review-bot") continue;
        reviews += 1;
        const p = person(r.author.login, r.author.avatarUrl);
        p.reviews += 1;
        if (r.state === "APPROVED") p.approvals += 1;
      }
      const latest = [...pr.comments.nodes].reverse().map((c) => parseMarker(c.body)).find(Boolean);
      if (latest && pr.author) {
        scores.push(latest.score);
        person(pr.author.login, pr.author.avatarUrl).scores.push(latest.score);
      }
    }
  }
  const ranked = [...people.values()].sort((a, b) => b.reviews + b.merged - (a.reviews + a.merged) || b.opened - a.opened);
  return { since: since.toISOString(), people: ranked, merged, opened, reviews, avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null };
}
