import { test } from "node:test";
import assert from "node:assert/strict";
import { countTabs, tabsFor } from "./pr-status.ts";

const base = { isDraft: false, reviewDecision: null, author: { login: "ragav", avatarUrl: "" }, reviewRequests: [], latestReviews: [] };

test("my open PR with no review is waiting", () => {
  assert.deepEqual([...tabsFor(base, "ragav")], ["all", "waiting"]);
});

test("someone else's PR requesting me needs my review", () => {
  const pr = { ...base, author: { login: "yash", avatarUrl: "" }, reviewRequests: ["ragav"] };
  assert.deepEqual([...tabsFor(pr, "ragav")], ["all", "needs-review"]);
});

test("changes requested on my PR is returned, not waiting", () => {
  const pr = { ...base, reviewDecision: "CHANGES_REQUESTED" as const };
  assert.deepEqual([...tabsFor(pr, "ragav")], ["all", "returned"]);
});

test("drafts are never waiting", () => {
  assert.deepEqual([...tabsFor({ ...base, isDraft: true }, "ragav")], ["all", "drafts"]);
});

test("counts match the screenshot shape: 4 open, 2 waiting, 2 drafts", () => {
  const prs = [base, base, { ...base, isDraft: true }, { ...base, isDraft: true }];
  const c = countTabs(prs, "ragav");
  assert.equal(c.all, 4);
  assert.equal(c.waiting, 2);
  assert.equal(c.drafts, 2);
  assert.equal(c["needs-review"], 0);
});
