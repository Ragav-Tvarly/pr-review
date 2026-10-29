import { test } from "node:test";
import assert from "node:assert/strict";
import { findReview, parseMarker } from "./parse.ts";
import { grade } from "./types.ts";

const json = {
  v: 1, pr: 668, headSha: "abc", reviewedAt: "2026-10-29T10:00:00Z", mode: "review", risk: "high", score: 62, verdict: "REQUEST_CHANGES",
  summary: "One paragraph.", scope: { skipped: [], skimmed: [], note: "" },
  findings: [{ id: "C1", severity: "critical", category: "Security", path: "a.ts", line: 3, side: "RIGHT", title: "No auth", gate: "auto-fix" }],
  files: [{ path: "a.ts", importance: 90, severity: "critical", reason: "server route", noise: false }], rounds: [],
};
const body = `<!-- tvar-review:v1\n${JSON.stringify(json)}\n-->\n## tvar review · HIGH risk\nhuman text`;

test("parses the marker block and ignores the human text", () => {
  const r = parseMarker(body);
  assert.equal(r?.score, 62);
  assert.equal(r?.findings[0]?.id, "C1");
});

test("rejects bodies without a valid v1 block", () => {
  assert.equal(parseMarker("just a comment"), null);
  assert.equal(parseMarker("<!-- tvar-review:v1 {not json} -->"), null);
  assert.equal(parseMarker(`<!-- tvar-review:v1 ${JSON.stringify({ ...json, risk: "banana" })} -->`), null);
});

test("newest review wins and stale is computed against the head sha", () => {
  const comments = [
    { id: 1, body, url: "u1", createdAt: "2026-10-29T10:00:00Z" },
    { id: 2, body: body.replace('"headSha":"abc"', '"headSha":"def"'), url: "u2", createdAt: "2026-10-29T11:00:00Z" },
  ];
  const found = findReview(comments, "def");
  assert.equal(found?.commentId, 2);
  assert.equal(found?.stale, false);
  assert.equal(findReview(comments, "zzz")?.stale, true);
});

test("grades", () => {
  assert.deepEqual([95, 85, 75, 65, 10].map(grade), ["A", "B", "C", "D", "F"]);
});
