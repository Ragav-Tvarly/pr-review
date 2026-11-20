import { test } from "node:test";
import assert from "node:assert/strict";
import { askAnswers } from "./answers.ts";

const c = (id: number, author: string, inReplyTo: number | null, createdAt: string, body = "") => ({ id, author, inReplyTo, createdAt, body, url: `u${id}` });

test("latest non-bot reply per thread wins; bot replies and top-level comments are ignored", () => {
  const out = askAnswers([
    c(1, "TvarReview", null, "2026-11-20T10:00:00Z", "Q?"),
    c(2, "dev", 1, "2026-11-20T10:05:00Z", "After tax"),
    c(3, "TvarReview", 1, "2026-11-20T10:06:00Z", "noted"),
    c(4, "senior", 1, "2026-11-20T10:07:00Z", "Before tax"),
    c(5, "dev", null, "2026-11-20T10:08:00Z", "unrelated"),
  ]);
  assert.deepEqual(Object.keys(out), ["1"]);
  assert.equal(out[1]!.author, "senior");
  assert.equal(out[1]!.body, "Before tax");
});
