import { test } from "node:test";
import assert from "node:assert/strict";
import { canSeePr, seniorRepos, seniorsFor } from "./config.ts";

test("per-repo seniors override the default; bare logins are the default", () => {
  process.env.FINAL_REVIEWER = "tvardev, Tvar-Launchpad/tecoloti=Ragav-Tvarly";
  assert.deepEqual(seniorsFor("tvardev/tvar-business"), ["tvardev"]);
  assert.deepEqual(seniorsFor("tvar-launchpad/TECOLOTI"), ["Ragav-Tvarly"]);
  assert.deepEqual(seniorRepos("ragav-tvarly", ["tvardev/tvar-business", "Tvar-Launchpad/tecoloti"]), ["Tvar-Launchpad/tecoloti"]);
});

test("devs see only their own PRs; seniors of the repo see all", () => {
  process.env.FINAL_REVIEWER = "tvardev,Tvar-Launchpad/tecoloti=Ragav-Tvarly";
  const ragav = { login: "Ragav-Tvarly", seniorRepos: seniorRepos("Ragav-Tvarly", ["tvardev/tvar-business", "Tvar-Launchpad/tecoloti"]) };
  assert.equal(canSeePr(ragav, "tvardev/tvar-business", "yashtvarly"), false);
  assert.equal(canSeePr(ragav, "tvardev/tvar-business", "Ragav-Tvarly"), true);
  assert.equal(canSeePr(ragav, "Tvar-Launchpad/tecoloti", "someone-else"), true);
});

test("unset FINAL_REVIEWER falls back to tvardev", () => {
  delete process.env.FINAL_REVIEWER;
  assert.deepEqual(seniorsFor("any/repo"), ["tvardev"]);
});
