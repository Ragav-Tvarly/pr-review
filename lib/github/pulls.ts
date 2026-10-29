import { cachedRead, graphql } from "./client";
import { OPEN_PULL_REQUESTS } from "./queries";
import { repos } from "@/lib/config";
import { riskFromLabels, type Risk } from "@/lib/review/types";

export type ReviewDecision = "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
export type CheckState = "SUCCESS" | "FAILURE" | "PENDING" | "ERROR" | "EXPECTED" | null;

export type PrSummary = {
  id: string;
  number: number;
  title: string;
  url: string;
  repo: string;
  isDraft: boolean;
  updatedAt: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  reviewDecision: ReviewDecision;
  baseRefName: string;
  headRefName: string;
  author: { login: string; avatarUrl: string };
  labels: { name: string; color: string }[];
  reviewRequests: string[];
  latestReviews: { author: string; state: string }[];
  checks: CheckState;
  risk: Risk | null;
};

type OpenPullRequestsData = {
  repository: {
    pullRequests: {
      nodes: Array<{
        id: string;
        number: number;
        title: string;
        url: string;
        isDraft: boolean;
        updatedAt: string;
        additions: number;
        deletions: number;
        changedFiles: number;
        reviewDecision: ReviewDecision;
        baseRefName: string;
        headRefName: string;
        author: { login: string; avatarUrl: string } | null;
        labels: { nodes: { name: string; color: string }[] };
        reviewRequests: { nodes: { requestedReviewer: { login?: string; name?: string } | null }[] };
        latestReviews: { nodes: { author: { login: string } | null; state: string }[] };
        commits: { nodes: { commit: { statusCheckRollup: { state: CheckState } | null } }[] };
      }>;
    };
  } | null;
};

export const PR_LIST_TAG = "pr-list";

export async function listOpenPRs(): Promise<PrSummary[]> {
  return cachedRead(["list", ...repos()], [PR_LIST_TAG], (token) => fetchOpenPRs(token));
}

async function fetchOpenPRs(token: string): Promise<PrSummary[]> {
  const perRepo = await Promise.all(
    repos().map(async (repo) => {
      const [owner, name] = repo.split("/");
      const data = await graphql<OpenPullRequestsData>(OPEN_PULL_REQUESTS, { owner, name }, token);
      const nodes = data.repository?.pullRequests.nodes ?? [];
      return nodes.map((pr): PrSummary => {
        const labels = pr.labels.nodes;
        return {
          id: pr.id,
          number: pr.number,
          title: pr.title,
          url: pr.url,
          repo,
          isDraft: pr.isDraft,
          updatedAt: pr.updatedAt,
          additions: pr.additions,
          deletions: pr.deletions,
          changedFiles: pr.changedFiles,
          reviewDecision: pr.reviewDecision,
          baseRefName: pr.baseRefName,
          headRefName: pr.headRefName,
          author: pr.author ?? { login: "ghost", avatarUrl: "" },
          labels,
          reviewRequests: pr.reviewRequests.nodes
            .map((n) => n.requestedReviewer?.login ?? n.requestedReviewer?.name ?? "")
            .filter(Boolean),
          latestReviews: pr.latestReviews.nodes.map((r) => ({ author: r.author?.login ?? "", state: r.state })),
          checks: pr.commits.nodes[0]?.commit.statusCheckRollup?.state ?? null,
          risk: riskFromLabels(labels.map((l) => l.name)),
        };
      });
    }),
  );
  return perRepo.flat().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
