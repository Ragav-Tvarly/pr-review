"use server";

import { revalidatePath } from "next/cache";
import { graphql, GitHubError } from "./client";

type ActionResult = { ok: true } | { ok: false; error: string };

function fail(e: unknown): ActionResult {
  return { ok: false, error: e instanceof GitHubError ? e.message : "Something went wrong" };
}

export async function markViewed(prId: string, path: string, viewed: boolean): Promise<ActionResult> {
  const mutation = viewed
    ? `mutation($input: MarkFileAsViewedInput!) { markFileAsViewed(input: $input) { clientMutationId } }`
    : `mutation($input: UnmarkFileAsViewedInput!) { unmarkFileAsViewed(input: $input) { clientMutationId } }`;
  try {
    await graphql(mutation, { input: { pullRequestId: prId, path } });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function revalidatePr(repo: string, number: number): Promise<void> {
  revalidatePath(`/pr/${repo}/${number}`, "layout");
}
