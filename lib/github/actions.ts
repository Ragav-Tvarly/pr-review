"use server";

import { revalidatePath, updateTag } from "next/cache";
import { PR_LIST_TAG } from "./pulls";
import { prTag } from "./pull-request";
import { graphql, rest, GitHubError } from "./client";

type ActionResult = { ok: true } | { ok: false; error: string };

function fail(e: unknown): ActionResult {
  return { ok: false, error: e instanceof GitHubError ? e.message : "Something went wrong" };
}

export async function markViewed(repo: string, number: number, prId: string, path: string, viewed: boolean): Promise<ActionResult> {
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
  if (event !== "APPROVE" && !body.trim() && threads.length === 0) return { ok: false, error: "Write a comment or add an inline comment first" };
  try {
    await graphql(
      `mutation($input: AddPullRequestReviewInput!) { addPullRequestReview(input: $input) { pullRequestReview { id } } }`,
      { input: { pullRequestId: prId, event, body: body.trim() || undefined, threads: threads.map((t) => ({ path: t.path, line: t.line, side: t.side, body: t.body })) } },
    );
    await revalidatePr(repo, number);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export type MergeMethod = "MERGE" | "SQUASH" | "REBASE";

export async function mergePR(repo: string, number: number, prId: string, method: MergeMethod, expectedHeadOid: string): Promise<ActionResult> {
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

/** People who can be asked to review in this repo (GraphQL assignableUsers works with read access). */
export async function listReviewers(repo: string): Promise<string[]> {
  const [owner, name] = repo.split("/");
  try {
    const data = await graphql<{ repository: { assignableUsers: { nodes: { login: string }[] } } | null }>(
      `query($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { assignableUsers(first: 100) { nodes { login } } } }`,
      { owner, name },
    );
    return (data.repository?.assignableUsers.nodes ?? []).map((u) => u.login).sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

/** Ask someone to review; a draft is marked ready first so GitHub notifies them. Uses GitHub's own review requests. */
export async function requestReview(repo: string, number: number, prId: string, reviewer: string, markReady: boolean): Promise<ActionResult> {
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
