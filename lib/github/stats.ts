import { cachedRead, graphql, viewer } from "./client";
import { parseMarker } from "@/lib/review/parse";

export type WeekStats = { since: string; merged: number; opened: number; reviews: number; avgScore: number | null };

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
          reviews(first: 30) { nodes { author { __typename login avatarUrl } state submittedAt } }
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
  reviews: { nodes: { author: { __typename: string; login: string; avatarUrl: string } | null; state: string; submittedAt: string }[] };
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
  const me = await viewer();
  const author = me.isSenior ? null : me.login;
  return cachedRead(["week", "v3", author ?? "*", ...me.repos], ["pr-list"], (token) => fetchWeekStats(token, me.repos, author), 300);
}

async function fetchWeekStats(token: string, repos: string[], author: string | null): Promise<WeekStats> {
  const since = weekStart();
  const sinceIso = since.toISOString().slice(0, 10);
  let merged = 0;
  let opened = 0;
  let reviews = 0;
  const scores: number[] = [];

  for (const repo of repos) {
    const data = await graphql<{ search: { nodes: Node[] } }>(SEARCH, { q: `repo:${repo} is:pr updated:>=${sinceIso}${author ? ` author:${author}` : ""}` }, token);
    for (const pr of data.search.nodes) {
      if (!pr?.number) continue;
      if (pr.createdAt >= since.toISOString() && pr.author) opened += 1;
      if (pr.merged && pr.mergedAt && pr.mergedAt >= since.toISOString()) merged += 1;
      for (const r of pr.reviews.nodes) {
        if (!r.author || r.submittedAt < since.toISOString() || r.author.login === pr.author?.login) continue;
        if (r.author.__typename === "Bot" || r.author.login.endsWith("[bot]") || r.author.login === "TvarReview") continue;
        reviews += 1;
      }
      const latest = [...pr.comments.nodes].reverse().map((c) => parseMarker(c.body)).find(Boolean);
      if (latest) scores.push(latest.score);
    }
  }
  return { since: since.toISOString(), merged, opened, reviews, avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null };
}
