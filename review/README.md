# Review bot (Claude Code scheduled task)

The AI review is a Claude Code **scheduled task** that runs on Anthropic's cloud under one
designated Claude account (**admin@tvarlaunchpad.com**). It writes results back to GitHub only
(review with inline comments, a sticky summary comment carrying a JSON block, and a `risk: …`
label). The dashboard reads those. There is no other data store.

**Hard rule:** inside cloud sessions GitHub GraphQL is blocked (403), so everything here uses
`gh api repos/...` (REST) and `git`. Never add `gh pr`, `gh issue` or `gh label` calls.

## One-time setup (signed in as admin@tvarlaunchpad.com)

1. **GitHub App**: the `tvardev` account owner installs the Claude GitHub App on `tvardev/tvar-business` and on
   this repo (needed for the PR-event trigger and for cloning).
2. **Connect GitHub** for the admin account at claude.ai/code (GitHub authentication options).
3. **Cloud environment** (claude.ai/code → environments): create "tvar review" with Network access **Full** (no "Trusted" option any more; do not use Network secrets, `gh` needs the env var)
   and the environment variable `GH_TOKEN=<classic PAT (repo scope) of the machine user TvarReview>`
   (Pull requests R/W, Issues R/W, Contents R, Metadata R on tvar-business). Smoke test in a session:
   `gh api rate_limit`, `gh api repos/tvardev/tvar-business/pulls?per_page=1`, `gh api user --jq .login`
   (expects `TvarReview`). Do **not** test with `gh pr list`; it fails by design.
   **Observed 2026-11-02:** the cloud proxy replaces `GH_TOKEN` on `api.github.com` requests with the
   claude.ai account's own GitHub connection (`gh api user` returned the connected user, rate limit
   15000; the PAT itself verified locally as `TvarReview`). The bot identity is therefore whichever GitHub
   user the routine's claude.ai account is connected to, not the env var. Fix applied: admin@'s claude.ai
   GitHub connection was re-authorized as **TvarReview** (Repo picker → ⚙), after TvarReview became a Write
   collaborator on both repos. Smoke test then printed `TvarReview`. Side effect: every cloud session on
   admin@ acts on GitHub as TvarReview.
4. **Scheduled task** (claude.ai/code/routines → create):
   - Name: `tvar PR review`
   - Prompt: `Follow review/REVIEW.md in the pr-review checkout exactly. It is the whole assignment.`
   - Repositories: `tvardev/tvar-business` **first**, then this repo.
   - Environment: "tvar review". Model: the default; effort high.
   - Triggers: GitHub event `pull_request` → `opened` and `synchronize`, filter *Is draft = false*,
     repository tvar-business; plus an **API trigger**. Copy its Fire URL and token into the Vercel
     project as `ROUTINE_FIRE_URL` / `ROUTINE_FIRE_TOKEN`.
   - Run once with **Run now** on a small PR before enabling the triggers. Check the run log for the
     identity line (`posting as TvarReview`) and the review URL.
5. **Fire payload format** (what the dashboard sends): `owner/repo#NUMBER` optionally followed by
   `fix`. The prompt ignores anything else in the payload.

## Files

- `REVIEW.md` — the task's full instructions: intake (REST + git), scoring, the review standard,
  the JSON contract, fix mode.
- `post-review.sh` — posts the review (inline comments, 422 fallback), upserts the sticky comment,
  fills `commentId` per finding, sets the risk label. Exit codes: 2 invalid JSON, 3 post failed.

## Testing the script locally

```bash
GH_TOKEN=$(gh auth token) bash review/post-review.sh Ragav-Tvarly/pr-review 1 fixtures/review.json fixtures/review.md
```

Posts as you (the script warns), which is fine on a throwaway PR in this repo.
