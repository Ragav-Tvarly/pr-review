import type { PrSummary } from "./github/pulls";

export const TABS = [
  { id: "all", label: "All open" },
  { id: "needs-review", label: "Needs your review" },
  { id: "returned", label: "Returned to you" },
  { id: "waiting", label: "Waiting for review" },
  { id: "approved", label: "Approved" },
  { id: "drafts", label: "Drafts" },
] as const;

export type Tab = (typeof TABS)[number]["id"];

type Input = Pick<PrSummary, "isDraft" | "reviewDecision" | "author" | "reviewRequests" | "latestReviews">;

/** Which dashboard tabs a PR belongs to for the given viewer. A PR can be in several. */
export function tabsFor(pr: Input, viewer: string): Set<Tab> {
  const tabs = new Set<Tab>(["all"]);
  const mine = pr.author.login === viewer;
  if (pr.isDraft) tabs.add("drafts");
  if (pr.reviewDecision === "APPROVED") tabs.add("approved");
  if (!mine && pr.reviewRequests.includes(viewer)) tabs.add("needs-review");
  if (mine && pr.reviewDecision === "CHANGES_REQUESTED") tabs.add("returned");
  if (mine && !pr.isDraft && pr.reviewDecision !== "APPROVED" && pr.reviewDecision !== "CHANGES_REQUESTED") {
    tabs.add("waiting");
  }
  return tabs;
}

export function countTabs(prs: Input[], viewer: string): Record<Tab, number> {
  const counts = Object.fromEntries(TABS.map((t) => [t.id, 0])) as Record<Tab, number>;
  for (const pr of prs) for (const tab of tabsFor(pr, viewer)) counts[tab] += 1;
  return counts;
}
