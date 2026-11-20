"use server";

import { revalidatePath, updateTag } from "next/cache";
import { PR_LIST_TAG } from "./pulls";
import { prTag } from "./pull-request";
import { graphql, rest, viewer, GitHubError } from "./client";
import { hasRepo } from "./access";
import { canSeePr, seniorsFor } from "@/lib/config";

type ActionResult = { ok: true; note?: string } | { ok: false; error: string };

/**
 * The dashboard's role rules, enforced here too and not only by which buttons are shown: the repo must be
 * enabled, devs may act only on PRs they opened, and merging is for the repo's seniors. GitHub cannot
 * enforce these for us (branch protection needs a paid plan on these private repos).
 */
async function denied(repo: string, number: number, need: "own-or-senior" | "senior" = "own-or-senior"): Promise<string | null> {
  const me = await viewer();
  if (!hasRepo(me.repos, repo)) return `${repo} is not enabled in tvar review`;
  const senior = canSeePr(me, repo, "");
  if (need === "senior") return senior ? null : "Only the senior reviewer of this repository can do this";
  if (senior) return null;
  const pr = await rest<{ user: { login: string } | null }>(`/repos/${repo}/pulls/${number}`);
  return canSeePr(me, repo, pr.user?.login ?? "") ? null : "You can only act on pull requests you opened";
}

function fail(e: unknown): ActionResult {
  return { ok: false, error: e instanceof GitHubError ? e.message : "Something went wrong" };
}

export async function markViewed(repo: string, number: number, prId: string, path: string, viewed: boolean): Promise<ActionResult> {
  const no = await denied(repo, number);
  if (no) return { ok: false, error: no };
  const mutation = viewed
    ? `mutation($input: MarkFileAsViewedInput!) { markFileAsViewed(input: $input) { clientMutationId } }`
    : `mutation($input: UnmarkFileAsViewedInput!) { unmarkFileAsViewed(input: $input) { clientMutationId } }`;
  try {
    await graphql(mutation, { input: { pullRequestId: prId, path } });
    updateTag(prTag(repo, number));
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function revalidatePr(repo: string, number: number): Promise<void> {
  updateTag(prTag(repo, number));
  updateTag(PR_LIST_TAG);
  revalidatePath(`/pr/${repo}/${number}`, "layout");
  revalidatePath("/");
}

/** Reply on an inline review-comment thread (used for answering "ask" findings). */
export async function replyToReviewComment(repo: string, number: number, commentId: number, body: string): Promise<ActionResult> {
  const no = await denied(repo, number);
  if (no) return { ok: false, error: no };
  const text = body.trim();
  if (!text) return { ok: false, error: "Write a reply first" };
  try {
    await rest(`/repos/${repo}/pulls/${number}/comments/${commentId}/replies`, { method: "POST", body: JSON.stringify({ body: text }) });
    await revalidatePr(repo, number);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export type ReviewEvent = "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
export type DraftThread = { path: string; line: number; side: "LEFT" | "RIGHT"; body: string };

/** One GraphQL call submits the review body, the event and every pending inline comment. */
export async function submitReview(repo: string, number: number, prId: string, event: ReviewEvent, body: string, threads: DraftThread[]): Promise<ActionResult> {
  const no = await denied(repo, number);
  if (no) return { ok: false, error: no };
  if (event !== "APPROVE" && !body.trim() && threads.length === 0) return { ok: false, error: "Write a comment or add an inline comment first" };
  const send = (text: string, inline: DraftThread[]) =>
    graphql(
      `mutation($input: AddPullRequestReviewInput!) { addPullRequestReview(input: $input) { pullRequestReview { id } } }`,
      { input: { pullRequestId: prId, event, body: text.trim() || undefined, threads: inline.map((t) => ({ path: t.path, line: t.line, side: t.side, body: t.body })) } },
    );
  try {
    try {
      await send(body, threads);
    } catch (e) {
      // GitHub rejects the whole review if one line is outside the diff (e.g. a stale bot finding): post the comments in the summary instead
      if (threads.length === 0 || !(e instanceof GitHubError)) throw e;
      const listed = threads.map((t) => `**${t.path}:${t.line}**\n${t.body}`).join("\n\n");
      await send([body.trim(), listed].filter(Boolean).join("\n\n"), []);
      await revalidatePr(repo, number);
      return { ok: true, note: "Some lines were no longer in the diff, so the inline comments were added to the review summary instead." };
    }
    await revalidatePr(repo, number);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export type MergeMethod = "MERGE" | "SQUASH" | "REBASE";

export async function mergePR(repo: string, number: number, prId: string, method: MergeMethod, expectedHeadOid: string): Promise<ActionResult> {
  const no = await denied(repo, number, "senior");
  if (no) return { ok: false, error: no };
  try {
    await graphql(`mutation($input: MergePullRequestInput!) { mergePullRequest(input: $input) { pullRequest { merged } } }`, {
      input: { pullRequestId: prId, mergeMethod: method, expectedHeadOid },
    });
    await revalidatePr(repo, number);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setDraft(repo: string, number: number, prId: string, draft: boolean): Promise<ActionResult> {
  const no = await denied(repo, number);
  if (no) return { ok: false, error: no };
  const mutation = draft
    ? `mutation($input: ConvertPullRequestToDraftInput!) { convertPullRequestToDraft(input: $input) { pullRequest { isDraft } } }`
    : `mutation($input: MarkPullRequestReadyForReviewInput!) { markPullRequestReadyForReview(input: $input) { pullRequest { isDraft } } }`;
  try {
    await graphql(mutation, { input: { pullRequestId: prId } });
    await revalidatePr(repo, number);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Ask someone to review; a draft is marked ready first so GitHub notifies them. Uses GitHub's own review requests. */
export async function requestReview(repo: string, number: number, prId: string, reviewer: string, markReady: boolean): Promise<ActionResult> {
  const no = await denied(repo, number);
  if (no) return { ok: false, error: no };
  if (!seniorsFor(repo).some((s) => s.toLowerCase() === reviewer.toLowerCase())) return { ok: false, error: `${reviewer} is not a senior reviewer of ${repo}` };
  try {
    if (markReady) {
      await graphql(`mutation($input: MarkPullRequestReadyForReviewInput!) { markPullRequestReadyForReview(input: $input) { pullRequest { isDraft } } }`, {
        input: { pullRequestId: prId },
      });
    }
    await rest(`/repos/${repo}/pulls/${number}/requested_reviewers`, { method: "POST", body: JSON.stringify({ reviewers: [reviewer] }) });
    await revalidatePr(repo, number);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** A general comment on the PR conversation. */
export async function addPrComment(repo: string, number: number, body: string): Promise<ActionResult> {
  const no = await denied(repo, number);
  if (no) return { ok: false, error: no };
  const text = body.trim();
  if (!text) return { ok: false, error: "Write a comment first" };
  try {
    await rest(`/repos/${repo}/issues/${number}/comments`, { method: "POST", body: JSON.stringify({ body: text }) });
    await revalidatePr(repo, number);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function setThreadResolved(repo: string, number: number, threadId: string, resolved: boolean): Promise<ActionResult> {
  const no = await denied(repo, number);
  if (no) return { ok: false, error: no };
  const mutation = resolved
    ? `mutation($input: ResolveReviewThreadInput!) { resolveReviewThread(input: $input) { thread { isResolved } } }`
    : `mutation($input: UnresolveReviewThreadInput!) { unresolveReviewThread(input: $input) { thread { isResolved } } }`;
  try {
    await graphql(mutation, { input: { threadId } });
    await revalidatePr(repo, number);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Close without merging, or reopen. */
export async function setPrClosed(repo: string, number: number, prId: string, closed: boolean): Promise<ActionResult> {
  const no = await denied(repo, number);
  if (no) return { ok: false, error: no };
  const mutation = closed
    ? `mutation($input: ClosePullRequestInput!) { closePullRequest(input: $input) { pullRequest { state } } }`
    : `mutation($input: ReopenPullRequestInput!) { reopenPullRequest(input: $input) { pullRequest { state } } }`;
  try {
    await graphql(mutation, { input: { pullRequestId: prId } });
    await revalidatePr(repo, number);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Merge the base into the head ("Update branch"). GitHub does it asynchronously and refuses on conflicts. */
export async function updateBranch(repo: string, number: number, expectedHeadSha: string): Promise<ActionResult> {
  const no = await denied(repo, number);
  if (no) return { ok: false, error: no };
  try {
    await rest(`/repos/${repo}/pulls/${number}/update-branch`, { method: "PUT", body: JSON.stringify({ expected_head_sha: expectedHeadSha }) });
    await revalidatePr(repo, number);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
