import type { PrSummary } from "./github/pulls";

export const TABS = [
  { id: "all", label: "All open" },
  { id: "needs-review", label: "Needs your review" },
  { id: "returned", label: "Returned to you" },
  { id: "to-send", label: "To send" },
  { id: "waiting", label: "Waiting for review" },
  { id: "approved", label: "Approved" },
  { id: "drafts", label: "Drafts" },
] as const;

export type Tab = (typeof TABS)[number]["id"];

type Input = Pick<PrSummary, "isDraft" | "reviewDecision" | "author" | "reviewRequests" | "latestReviews">;

/**
 * Which dashboard tabs a PR belongs to for the given viewer. A PR can be in several.
 * The author's own open PR is in exactly one of: returned (changes requested, not re-sent),
 * to-send (nobody asked to review yet), waiting (a reviewer is asked), approved.
 */
export function tabsFor(pr: Input, viewer: string): Set<Tab> {
  const tabs = new Set<Tab>(["all"]);
  const mine = pr.author.login === viewer;
  const requested = pr.reviewRequests.length > 0;
  if (pr.isDraft) tabs.add("drafts");
  if (pr.reviewDecision === "APPROVED") tabs.add("approved");
  if (!mine && pr.reviewRequests.includes(viewer)) tabs.add("needs-review");
  if (mine && !pr.isDraft && pr.reviewDecision !== "APPROVED") {
    if (requested) tabs.add("waiting"); // also after changes requested once the author asks again
    else tabs.add(pr.reviewDecision === "CHANGES_REQUESTED" ? "returned" : "to-send");
  }
  return tabs;
}

const OWN_PR_TABS = new Set<Tab>(["returned", "to-send", "waiting", "drafts"]);

/**
 * Tabs to show. Devs only work on their own PRs and are never asked to review, so they do not get
 * "Needs your review". Seniors review everyone's PRs; their own-PR tabs show only when non-empty.
 */
export function visibleTabs(counts: Record<Tab, number>, isSenior: boolean): Tab[] {
  return TABS.map((t) => t.id).filter((id) => {
    if (id === "needs-review") return isSenior;
    if (OWN_PR_TABS.has(id)) return !isSenior || counts[id] > 0;
    return true;
  });
}

export function countTabs(prs: Input[], viewer: string): Record<Tab, number> {
  const counts = Object.fromEntries(TABS.map((t) => [t.id, 0])) as Record<Tab, number>;
  for (const pr of prs) for (const tab of tabsFor(pr, viewer)) counts[tab] += 1;
  return counts;
}
