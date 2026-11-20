import { test } from "node:test";
import assert from "node:assert/strict";
import { countTabs, tabsFor, visibleTabs } from "./pr-status.ts";

const base = { isDraft: false, reviewDecision: null, author: { login: "ragav", avatarUrl: "" }, reviewRequests: [], latestReviews: [] };

test("my open PR nobody was asked to review is to send", () => {
  assert.deepEqual([...tabsFor(base, "ragav")], ["all", "to-send"]);
});

test("my PR with a senior requested is waiting", () => {
  assert.deepEqual([...tabsFor({ ...base, reviewRequests: ["tvardev"] }, "ragav")], ["all", "waiting"]);
});

test("changes requested and re-sent to the senior is waiting again, not returned", () => {
  const pr = { ...base, reviewDecision: "CHANGES_REQUESTED" as const, reviewRequests: ["tvardev"] };
  assert.deepEqual([...tabsFor(pr, "ragav")], ["all", "waiting"]);
});

test("devs never see Needs your review; seniors see own-PR tabs only when non-empty", () => {
  const counts = countTabs([base], "ragav");
  assert.deepEqual(visibleTabs(counts, false), ["all", "returned", "to-send", "waiting", "approved", "drafts"]);
  assert.deepEqual(visibleTabs(counts, true), ["all", "needs-review", "to-send", "approved"]);
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
  const sent = { ...base, reviewRequests: ["tvardev"] };
  const prs = [sent, sent, { ...base, isDraft: true }, { ...base, isDraft: true }];
  const c = countTabs(prs, "ragav");
  assert.equal(c.all, 4);
  assert.equal(c.waiting, 2);
  assert.equal(c.drafts, 2);
  assert.equal(c["needs-review"], 0);
});
