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

Blocked on accounts/permissions (user or org owner does these, tracked in `owed list` #145–#149):

1. Two GitHub OAuth Apps (dev `http://localhost:3010/api/auth/callback/github`, prod Vercel domain).
2. Machine user `tvar-review-bot` + fine-grained PAT (PRs R/W, Issues R/W, Contents R, Metadata R).
3. Org owner installs the Claude GitHub App on `tvar-business` and this repo.
4. As **admin@tvarlaunchpad.com**: connect GitHub, cloud env `GH_TOKEN=<bot PAT>`, create task
   "tvar PR review" (PR opened+synchronize non-draft + API trigger), put fire URL/token in Vercel.
5. Transfer this repo from `Ragav-Tvarly` to `tvardev`.

Then: Vercel project + env (`.env.example`), first manual task run on a small PR, team sign-in check.
