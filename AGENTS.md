# tvar review — agent guide

Internal PR review dashboard for the tvar team (replaces graphene.to). Next 16 + Auth.js GitHub OAuth
+ shadcn + `@git-diff-view/react`. **GitHub is the only database.** AI reviews are produced by a Claude Code
scheduled task (no API spend) and written back to GitHub; the dashboard only reads them.

Read in this order: this file → `docs/PLAN.md` (design, data contracts, phases, hand-off checklist)
→ `review/README.md` (scheduled task setup) → `review/REVIEW.md` (the bot's assignment).

## Hard rules

- Bot-side code (`review/*`) is **REST only**: `gh api repos/...` + `git`. Cloud sessions block GitHub
  GraphQL, so `gh pr` / `gh issue` / `gh label` fail there. The dashboard (user tokens) may use GraphQL.
- **Never post reviews, comments or labels on real `tvardev/tvar-business` PRs while testing.** Use
  throwaway PRs in this repo. PR #1 here is a kept-open fixture with a real posted review.
- Reviews are always posted as event `COMMENT`; humans decide approve/merge.
- No Claude API calls from the app. No GitHub Actions (billing-blocked in tvardev).
- Engineering style: smallest code that works; reuse before adding; no unrequested abstractions.

## Dev

```bash
npm install
GITHUB_DEV_TOKEN=$(gh auth token) npm run dev          # http://localhost:3010, no OAuth app needed
GITHUB_REPOS=Ragav-Tvarly/pr-review GITHUB_DEV_TOKEN=$(gh auth token) npm run dev   # point at this repo (PR #1 fixture)
npm run check                                           # tsc + eslint + node --test
```

Repos: `GITHUB_REPOS` is the list of repos **enabled** for the bot; each user sees only the enabled repos they can access (`lib/github/access.ts`), and PR pages / fires for other repos 404 or are refused. Enabling a repo: `review/README.md` step 5.

Workflow: author runs Score / Review & fix on their PR → **Request review** (PR header; `FINAL_REVIEWER`, default tvardev, pinned first; marks a draft ready) → it lands in the senior dev's "Needs your review" tab → approve / request changes → merge.

Routes: `/` list, `/pr/{owner}/{repo}/{n}` overview, `/commits`, `/files`. `?preview=review` on an
overview shows `fixtures/review.json` without a real review.

Post a review to a throwaway PR as yourself (script warns that you are not the bot):

```bash
SHA=$(gh api repos/Ragav-Tvarly/pr-review/pulls/1 --jq .head.sha)
jq --arg s "$SHA" '.pr=1 | .headSha=$s' fixtures/review.json > /tmp/review.json
GH_TOKEN=$(gh auth token) bash review/post-review.sh Ragav-Tvarly/pr-review 1 /tmp/review.json fixtures/review.md
```

## State (2026-11-02)

Done and verified: P1–P4 + P6 UI; prod build passes; desktop + 500px layouts; `post-review.sh`
end to end on PR #1 (review + inline comments, sticky JSON comment with `commentId` per finding, risk
label); dashboard list/overview render the real review; "Decisions needed" → Post decision lands as a
reply on the right inline thread.

Not yet exercised for real: the review dialog submit and the merge/draft actions (UI only); P5 fix
mode (`REVIEW.md` fix section) has never run in the cloud; the scheduled task itself does not exist yet.

## Next steps (hand-off checklist, `docs/PLAN.md` bottom)

`tvardev` is a **personal** GitHub account, not an org. Vercel is held by the senior dev. Progress on
2026-11-02 (Ragav's laptop; `.env.local` there holds the dev OAuth app):

| Step | Status |
|---|---|
| Dev OAuth App "tvar review (dev)" under Ragav-Tvarly, callback `http://localhost:3010/api/auth/callback/github`; real sign-in verified | done |
| Machine user **TvarReview** (dev@tvarlaunchpad.com), 2FA, **classic** PAT `repo` scope exp 2027-11-02 (fine-grained PATs cannot reach another user's repos); token in Ragav's password manager | done |
| Claude GitHub App on `Ragav-Tvarly/pr-review` (installation 177735144, linked to the dev@ claude.ai account) | done |
| TvarReview Write collaborator on `tvar-business` + `pr-review`, invites accepted | done |
| Senior dev: install the Claude GitHub App on `tvar-business` | asked |
| Senior dev: Vercel project (Node 22, env per `.env.example`), report the domain | asked |
| Prod OAuth App under Ragav-Tvarly with callback `https://<vercel-domain>/api/auth/callback/github` | after domain |
| admin@ claude.ai: cloud env "Tvar Review" (network Full); GitHub connection re-authorized as **TvarReview** (the proxy ignores `GH_TOKEN`, see `review/README.md` step 3); smoke test → `TvarReview` | done |
| Routine "tvar PR review": pr-review only, API trigger (fire URL/token in password manager; needs headers `anthropic-version` + `anthropic-beta`), connectors off. Fired on PR #1: review + 5 inline + sticky + label posted as TvarReview; `commentId`s were null → retry fix in `post-review.sh`, re-fire to verify | in progress |
| Add `tvar-business` (first) to the routine. **No PR-event trigger**: reviews run only on request (dashboard buttons → API fire). Test fix mode on a throwaway PR | after app install |
| First manual task run on a small PR; team sign-in check | after task |
| Transfer repo `Ragav-Tvarly/pr-review` → `tvardev` (Ragav then needs re-adding as collaborator) | last, needs Ragav's OK |
