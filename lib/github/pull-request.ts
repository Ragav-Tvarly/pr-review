import { cache } from "react";
import { cachedRead, graphql, rest } from "./client";
import { PULL_REQUEST, PULL_REQUEST_FILES_PAGE } from "./queries";
import type { CheckState, ReviewDecision } from "./pulls";
import { riskFromLabels, type Risk } from "@/lib/review/types";
import { findReview, type ParsedReview } from "@/lib/review/parse";

export type ViewedState = "VIEWED" | "UNVIEWED" | "DISMISSED";
export type ChangeType = "ADDED" | "DELETED" | "MODIFIED" | "RENAMED" | "COPIED" | "CHANGED";

export type PrFile = { path: string; additions: number; deletions: number; changeType: ChangeType; viewed: ViewedState };

export type CheckContext = { name: string; state: "SUCCESS" | "FAILURE" | "PENDING" | "NEUTRAL" | "SKIPPED" | "OTHER"; url: string | null };

export type Commit = {
  oid: string;
  abbreviatedOid: string;
  headline: string;
  body: string;
  date: string;
  url: string;
  author: { name: string; login: string | null; avatarUrl: string | null };
};

export type PrDetail = {
  id: string;
  number: number;
  repo: string;
  title: string;
  url: string;
  bodyHTML: string;
  isDraft: boolean;
  state: "OPEN" | "CLOSED" | "MERGED";
  createdAt: string;
  updatedAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  reviewDecision: ReviewDecision;
  mergeable: "MERGEABLE" | "CONFLICTING" | "UNKNOWN";
  mergeStateStatus: "BEHIND" | "BLOCKED" | "CLEAN" | "DIRTY" | "DRAFT" | "HAS_HOOKS" | "UNKNOWN" | "UNSTABLE";
  viewerCanUpdate: boolean;
  headRefOid: string;
  baseRefName: string;
  headRefName: string;
  author: { login: string; avatarUrl: string };
  labels: { name: string; color: string }[];
  risk: Risk | null;
  reviewRequests: string[];
  latestReviews: { author: string; avatarUrl: string; state: string; submittedAt: string; url: string }[];
  files: PrFile[];
  comments: { id: number; author: string; body: string; createdAt: string; url: string }[];
  /** Latest bot review parsed from the sticky comment, if any. */
  review: ParsedReview | null;
  commits: Commit[];
  commitCount: number;
  checks: { state: CheckState; contexts: CheckContext[] };
  mergeMethods: ("MERGE" | "SQUASH" | "REBASE")[];
};

type FileNode = { path: string; additions: number; deletions: number; changeType: ChangeType; viewerViewedState: ViewedState };
type CheckNode =
  | { name: string; conclusion: string | null; status: string; detailsUrl: string | null }
  | { context: string; state: string; targetUrl: string | null };

type PullRequestData = {
  repository: {
    mergeCommitAllowed: boolean;
    squashMergeAllowed: boolean;
    rebaseMergeAllowed: boolean;
    pullRequest: {
      id: string;
      number: number;
      title: string;
      url: string;
      bodyHTML: string;
      isDraft: boolean;
      state: PrDetail["state"];
      createdAt: string;
      updatedAt: string;
      additions: number;
      deletions: number;
      changedFiles: number;
      reviewDecision: ReviewDecision;
      mergeable: PrDetail["mergeable"];
      mergeStateStatus: PrDetail["mergeStateStatus"];
      viewerCanUpdate: boolean;
      headRefOid: string;
      baseRefName: string;
      headRefName: string;
      author: { login: string; avatarUrl: string } | null;
      labels: { nodes: { name: string; color: string }[] };
      reviewRequests: { nodes: { requestedReviewer: { login?: string; name?: string } | null }[] };
      latestReviews: { nodes: { author: { login: string; avatarUrl: string } | null; state: string; submittedAt: string; url: string }[] };
      files: { totalCount: number; pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: FileNode[] } | null;
      comments: { nodes: { databaseId: number; author: { login: string } | null; body: string; createdAt: string; url: string }[] };
      commits: {
        totalCount: number;
        nodes: {
          commit: {
            oid: string;
            abbreviatedOid: string;
            messageHeadline: string;
            messageBody: string;
            committedDate: string;
            url: string;
            author: { name: string; user: { login: string; avatarUrl: string } | null } | null;
            statusCheckRollup: { state: CheckState; contexts: { nodes: CheckNode[] } } | null;
          };
        }[];
      };
    } | null;
  } | null;
};

function toContext(node: CheckNode): CheckContext {
  if ("context" in node) {
    const s = node.state;
    return { name: node.context, state: s === "SUCCESS" || s === "FAILURE" || s === "PENDING" ? s : "OTHER", url: node.targetUrl };
  }
  const c = node.conclusion;
  const state: CheckContext["state"] =
    node.status !== "COMPLETED" ? "PENDING"
    : c === "SUCCESS" ? "SUCCESS"
    : c === "FAILURE" || c === "TIMED_OUT" || c === "CANCELLED" || c === "ACTION_REQUIRED" || c === "STARTUP_FAILURE" ? "FAILURE"
    : c === "NEUTRAL" ? "NEUTRAL"
    : c === "SKIPPED" ? "SKIPPED"
    : "OTHER";
  return { name: node.name, state, url: node.detailsUrl };
}

export function prTag(repo: string, number: number): string {
  return `pr:${repo}:${number}`;
}

/** Cached per request (react cache) and for 30s across requests per user (unstable_cache). */
export const getPullRequest = cache((owner: string, name: string, number: number): Promise<PrDetail | null> =>
  cachedRead(["pr", owner, name, String(number)], [prTag(`${owner}/${name}`, number)], (token) => fetchPullRequest(token, owner, name, number)),
);

async function fetchPullRequest(token: string, owner: string, name: string, number: number): Promise<PrDetail | null> {
  const data = await graphql<PullRequestData>(PULL_REQUEST, { owner, name, number }, token);
  const repo = data.repository;
  const pr = repo?.pullRequest;
  if (!repo || !pr) return null;

  const files: FileNode[] = [...(pr.files?.nodes ?? [])];
  let page = pr.files?.pageInfo;
  while (page?.hasNextPage) {
    const more = await graphql<{ repository: { pullRequest: { files: NonNullable<PullRequestData["repository"]>["pullRequest"] extends infer P ? (P extends { files: infer F } ? F : never) : never } } }>(
      PULL_REQUEST_FILES_PAGE,
      { owner, name, number, after: page.endCursor },
      token,
    );
    const f = more.repository.pullRequest.files;
    if (!f) break;
    files.push(...f.nodes);
    page = f.pageInfo;
  }

  const last = pr.commits.nodes[pr.commits.nodes.length - 1]?.commit.statusCheckRollup ?? null;
  const labels = pr.labels.nodes;
  const mergeMethods: PrDetail["mergeMethods"] = [];
  if (repo.squashMergeAllowed) mergeMethods.push("SQUASH");
  if (repo.mergeCommitAllowed) mergeMethods.push("MERGE");
  if (repo.rebaseMergeAllowed) mergeMethods.push("REBASE");

  const comments = pr.comments.nodes.map((c) => ({ id: c.databaseId, author: c.author?.login ?? "", body: c.body, createdAt: c.createdAt, url: c.url }));

  return {
    id: pr.id,
    number: pr.number,
    repo: `${owner}/${name}`,
    title: pr.title,
    url: pr.url,
    bodyHTML: pr.bodyHTML,
    isDraft: pr.isDraft,
    state: pr.state,
    createdAt: pr.createdAt,
    updatedAt: pr.updatedAt,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFiles: pr.changedFiles,
    reviewDecision: pr.reviewDecision,
    mergeable: pr.mergeable,
    mergeStateStatus: pr.mergeStateStatus,
    viewerCanUpdate: pr.viewerCanUpdate,
    headRefOid: pr.headRefOid,
    baseRefName: pr.baseRefName,
    headRefName: pr.headRefName,
    author: pr.author ?? { login: "ghost", avatarUrl: "" },
    labels,
    risk: riskFromLabels(labels.map((l) => l.name)),
    reviewRequests: pr.reviewRequests.nodes.map((n) => n.requestedReviewer?.login ?? n.requestedReviewer?.name ?? "").filter(Boolean),
    latestReviews: pr.latestReviews.nodes.map((r) => ({
      author: r.author?.login ?? "",
      avatarUrl: r.author?.avatarUrl ?? "",
      state: r.state,
      submittedAt: r.submittedAt,
      url: r.url,
    })),
    files: files.map((f) => ({ path: f.path, additions: f.additions, deletions: f.deletions, changeType: f.changeType, viewed: f.viewerViewedState })),
    comments,
    review: findReview(comments, pr.headRefOid),
    commits: pr.commits.nodes.map(({ commit: c }) => ({
      oid: c.oid,
      abbreviatedOid: c.abbreviatedOid,
      headline: c.messageHeadline,
      body: c.messageBody,
      date: c.committedDate,
      url: c.url,
      author: { name: c.author?.name ?? "", login: c.author?.user?.login ?? null, avatarUrl: c.author?.user?.avatarUrl ?? null },
    })),
    commitCount: pr.commits.totalCount,
    checks: { state: last?.state ?? null, contexts: (last?.contexts.nodes ?? []).map(toContext) },
    mergeMethods,
  };
}

export type FilePatch = {
  path: string;
  previousPath: string | null;
  status: "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unchanged";
  additions: number;
  deletions: number;
  changes: number;
  /** Unified diff hunks for this file; absent for binary or very large files. */
  patch: string | null;
  blobUrl: string;
};

type RestFile = {
  filename: string;
  previous_filename?: string;
  status: FilePatch["status"];
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  blob_url: string;
};

/** Per-file patches from REST, already split per file (so no diff parser). Paginates past 100 files. */
export const getFilePatches = cache((owner: string, name: string, number: number): Promise<FilePatch[]> =>
  cachedRead(["files", owner, name, String(number)], [prTag(`${owner}/${name}`, number)], (token) => fetchFilePatches(token, owner, name, number), 120),
);

async function fetchFilePatches(token: string, owner: string, name: string, number: number): Promise<FilePatch[]> {
  const out: FilePatch[] = [];
  for (let page = 1; page <= 30; page++) {
    const batch = await rest<RestFile[]>(`/repos/${owner}/${name}/pulls/${number}/files?per_page=100&page=${page}`, { token });
    out.push(
      ...batch.map((f) => ({
        path: f.filename,
        previousPath: f.previous_filename ?? null,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
        patch: f.patch ?? null,
        blobUrl: f.blob_url,
      })),
    );
    if (batch.length < 100) break;
  }
  return out;
}

export type ReviewComment = { id: number; path: string; line: number | null; side: "LEFT" | "RIGHT"; body: string; author: string; avatarUrl: string; createdAt: string; url: string; inReplyTo: number | null };

/** Existing inline review comments (all reviewers, including the bot), newest last. */
export const getReviewComments = cache((owner: string, name: string, number: number): Promise<ReviewComment[]> =>
  cachedRead(["review-comments", owner, name, String(number)], [prTag(`${owner}/${name}`, number)], (token) => fetchReviewComments(token, owner, name, number)),
);

async function fetchReviewComments(token: string, owner: string, name: string, number: number): Promise<ReviewComment[]> {
  type Raw = { id: number; path: string; line: number | null; original_line: number | null; side: "LEFT" | "RIGHT"; body: string; user: { login: string; avatar_url: string } | null; created_at: string; html_url: string; in_reply_to_id?: number };
  const out: ReviewComment[] = [];
  for (let page = 1; page <= 10; page++) {
    const batch = await rest<Raw[]>(`/repos/${owner}/${name}/pulls/${number}/comments?per_page=100&page=${page}`, { token });
    out.push(
      ...batch.map((c) => ({
        id: c.id,
        path: c.path,
        line: c.line ?? c.original_line,
        side: c.side,
        body: c.body,
        author: c.user?.login ?? "",
        avatarUrl: c.user?.avatar_url ?? "",
        createdAt: c.created_at,
        url: c.html_url,
        inReplyTo: c.in_reply_to_id ?? null,
      })),
    );
    if (batch.length < 100) break;
  }
  return out;
}
