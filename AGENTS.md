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

Roles: `FINAL_REVIEWER` lists seniors, per repo (`tvardev,Tvar-Launchpad/tecoloti=Ragav-Tvarly`: tvardev by default, Ragav on tecoloti). Seniors of a repo see and act on every PR there and are the only ones who can merge. Everyone else sees only PRs they opened (list, PR pages, bot runs, stats, bell).

Workflow: author runs Score / Review & fix on their PR → **Request review** (offers only the seniors; marks a draft ready) → it lands in the senior's "Needs your review" tab → approve / request changes → senior merges.

Routes: `/` list, `/pr/{owner}/{repo}/{n}` overview, `/commits`, `/files`. `?preview=review` on an
overview shows `fixtures/review.json` without a real review.

Post a review to a throwaway PR as yourself (script warns that you are not the bot):

```bash
SHA=$(gh api repos/Ragav-Tvarly/pr-review/pulls/1 --jq .head.sha)
jq --arg s "$SHA" '.pr=1 | .headSha=$s' fixtures/review.json > /tmp/review.json
GH_TOKEN=$(gh auth token) bash review/post-review.sh Ragav-Tvarly/pr-review 1 /tmp/review.json fixtures/review.md
```

## State (2026-11-02, end of day)

Verified for real: cloud routine posts as TvarReview on request (API fire); review + fix mode on
throwaway PRs #1/#2 (fix: 65 → 98, one bot commit, no duplicate threads on re-review); `commentId`
mapping; OAuth sign-in on localhost; enabled-repos + per-repo roles (dev sees only own PRs, confirmed
by Ragav); notification bell. GitHub calls behind resolve/unresolve, update branch, close/reopen and
comment verified against PR #2.

Built but not clicked through in a browser yet: Request review, review dialog submit, merge, thread
reply/resolve, conversation comment, update branch, live refresh after a run, notification dismiss.

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
| Tecoloti (`Tvar-Launchpad/tecoloti`, Ragav is dev + senior): Ragav requested the Claude app install; **tvardev (org owner) approves** at github.com/organizations/Tvar-Launchpad/settings/installations; TvarReview Write: accepted | waiting on app approval |
| Senior dev: Vercel project (Node 22), report the domain | asked |
| Prod OAuth App under Ragav-Tvarly with callback `https://<vercel-domain>/api/auth/callback/github` | after domain |
| Vercel env: `AUTH_SECRET`, `AUTH_GITHUB_ID/SECRET`, `GITHUB_REPOS=tvardev/tvar-business,Tvar-Launchpad/tecoloti`, `FINAL_REVIEWER=tvardev,Tvar-Launchpad/tecoloti=Ragav-Tvarly`, `ROUTINE_FIRE_URL/TOKEN`, `REVIEW_SCORE_BAR=80` | after domain |
| admin@ claude.ai: cloud env "Tvar Review" (network Full); GitHub connection re-authorized as **TvarReview** (the proxy ignores `GH_TOKEN`, see `review/README.md` step 3) | done |
| Routine "tvar PR review": API trigger only (fire URL/token in password manager; headers `anthropic-version` + `anthropic-beta`), connectors off, repos: `pr-review` | done |
| Add `tvardev/tvar-business` and `Tvar-Launchpad/tecoloti` to the routine's repositories | after app installs |
| Browser click-through (as Ragav, then tvardev); first real run on a small tvar-business / tecoloti PR; team sign-in | next |
| Close throwaway PR #1 after the click-through (#2 closed) | after testing |
| Transfer repo `Ragav-Tvarly/pr-review` → `tvardev` (Ragav then needs re-adding as collaborator) | last, needs Ragav's OK |
