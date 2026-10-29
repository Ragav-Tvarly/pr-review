# tvar review

Internal pull-request review dashboard for the tvar team: a GitHub PR client (file tree, split diffs, viewed tracking, keyboard navigation, review and merge) plus AI reviews produced by a Claude Code scheduled task and written back to GitHub. GitHub is the only database.

## Run locally

```bash
cp .env.example .env.local   # fill AUTH_SECRET, AUTH_GITHUB_ID, AUTH_GITHUB_SECRET
npm install
npm run dev                  # http://localhost:3010
```

Before a GitHub OAuth App exists you can exercise the UI with your own `gh` token (never written to disk, ignored in production):

```bash
GITHUB_DEV_TOKEN=$(gh auth token) npm run dev
```

`npm run check` runs type-check, lint and the unit tests.

## Setup (one-time)

See `review/README.md` for the scheduled task, and the checklist in the project plan for the GitHub OAuth App, the `tvar-review-bot` machine user and the Vercel env vars.
