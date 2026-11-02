#!/usr/bin/env bash
# Post a tvar review to GitHub. REST only (GraphQL is blocked in Claude cloud sessions).
#   post-review.sh owner/repo PR_NUMBER review.json review.md
set -euo pipefail

REPO="${1:?owner/repo}"; N="${2:?pr number}"; JSON="${3:?review.json}"; MD="${4:?review.md}"
API="repos/$REPO"
MARKER="<!-- tvar-review:v1"

log() { printf '%s\n' "$*" >&2; }

# --- identity ---------------------------------------------------------------
LOGIN=$(gh api user --jq .login)
log "posting as $LOGIN"
[ "$LOGIN" = "TvarReview" ] || log "WARNING: expected TvarReview; set GH_TOKEN in the cloud environment"

# --- validate ---------------------------------------------------------------
jq -e '.v == 1 and (.pr|type=="number") and (.headSha|test("^[0-9a-f]{7,40}$")) and (.score|type=="number")
       and (.risk|IN("critical","high","important","normal","low","safe"))
       and (.verdict|IN("APPROVE","REQUEST_CHANGES","COMMENT")) and (.files|type=="array") and (.findings|type=="array")' "$JSON" >/dev/null \
  || { log "review.json failed validation"; exit 2; }
[ "$(jq '.pr' "$JSON")" = "$N" ] || { log "review.json .pr does not match $N"; exit 2; }
SIZE=$(wc -c <"$JSON"); [ "$SIZE" -le 30000 ] || { log "review.json is ${SIZE}B (> 30 KB)"; exit 2; }
FINDINGS=$(jq '.findings|length' "$JSON"); [ "$FINDINGS" -le 40 ] || { log "more than 40 findings"; exit 2; }
HEAD_SHA=$(jq -r .headSha "$JSON")
RISK=$(jq -r .risk "$JSON")

# --- 1. carry thread ids from the previous round -----------------------------
# Every finding already discussed has an inline thread; re-posting it each round just duplicates it.
# Take each finding's commentId from our previous sticky comment (or the JSON) and only open new threads.
EXISTING=$(gh api "$API/issues/$N/comments?per_page=100" --paginate \
  | jq -s -r --arg m "$MARKER" --arg me "$LOGIN" '[add // [] | .[] | select(.user.login == $me and (.body | startswith($m)))] | sort_by(.created_at) | last | .id // empty')
PREV_IDS='{}'
[ -z "$EXISTING" ] || PREV_IDS=$(gh api "$API/issues/comments/$EXISTING" --jq .body \
  | jq -R -s 'split("\n")[1] | (try fromjson catch {}) | [(.findings // [])[] | select(.commentId) | {key: .id, value: .commentId}] | from_entries')
jq --argjson prev "$PREV_IDS" '.findings |= map(if .commentId then . else (if $prev[.id] then . + {commentId: $prev[.id]} else del(.commentId) end) end)' "$JSON" >/tmp/review-in.json

# --- 2. review with inline comments for new threads only ---------------------
# new thread: no commentId yet and still open; fixed / decided findings without a thread stay in the report only
NEW='[ .[] | select((.commentId | not) and ((.status // "open") | IN("open", "not-fixed", "partially-fixed"))) ]'
post_review() {
  local comments_filter="$1"
  jq -n --arg sha "$HEAD_SHA" --rawfile body "$MD" --slurpfile r /tmp/review-in.json \
    "{commit_id: \$sha, event: \"COMMENT\", body: \$body, comments: (\$r[0].findings | $NEW | $comments_filter)}" \
    | gh api -X POST "$API/pulls/$N/reviews" --input - 2>&1
}
FULL='[ .[] | select(.path and .line) | {path, line, side: (.side // "RIGHT"), body: ("**" + .id + " · " + .severity + " · " + .category + "**\n\n" + .title + (if .fix and .fix != "" then "\n\n_Fix:_ " + .fix else "" end) + (if .gate == "ask" then "\n\n**Decision needed:** " + (.question // "") + (if .options then "\n" + (.options | map("- " + .) | join("\n")) else "" end) + "\n\n_Reply on this thread to decide; the next review round applies it._" else "" end))} ]'
FILE_LEVEL='[ .[] | select(.path) | {path, subject_type: "file", body: ("**" + .id + " · " + .severity + "** (line " + ((.line // 0)|tostring) + ") " + .title + (if .fix and .fix != "" then "\n\n_Fix:_ " + .fix else "" end))} ]'
WANT=$(jq "[.findings | $NEW | .[] | select(.path)] | length" /tmp/review-in.json)
log "carried $(jq '[.findings[] | select(.commentId)] | length' /tmp/review-in.json) thread(s), opening $WANT new"

if OUT=$(post_review "$FULL"); then :
elif log "inline anchors rejected, retrying as file-level comments"; OUT=$(post_review "$FILE_LEVEL"); then :
else log "retrying without inline comments"; OUT=$(post_review '[]'); fi
REVIEW_ID=$(printf '%s' "$OUT" | jq -r '.id // empty')
REVIEW_URL=$(printf '%s' "$OUT" | jq -r '.html_url // empty')
[ -n "$REVIEW_ID" ] || { log "review post failed: $OUT"; exit 3; }
log "review $REVIEW_URL"

# --- 3. map new inline comment ids onto findings (for dashboard replies) -----
# the per-review endpoint returns only the legacy `position`; the PR-level one carries `line`
# the list lags right after the POST (cloud run 2026-11-02 mapped nothing), so retry until it shows up
echo '[]' >/tmp/review-comments.json
if [ "$WANT" -gt 0 ]; then
  for _ in 1 2 3 4 5 6; do
    gh api "$API/pulls/$N/comments?per_page=100" --paginate \
      | jq -s --argjson rid "$REVIEW_ID" 'add // [] | map(select(.pull_request_review_id == $rid) | {path, line: (.line // .original_line), id})' >/tmp/review-comments.json
    [ "$(jq length /tmp/review-comments.json)" -ge "$WANT" ] && break
    sleep 3
  done
fi
log "mapped $(jq length /tmp/review-comments.json) new inline comment id(s)"
jq --slurpfile c /tmp/review-comments.json '
  .findings |= map(if .commentId then . else (. as $f | ($c[0] | map(select(.path == $f.path and .line == $f.line)) | .[0].id) as $id
                   | if $id then . + {commentId: $id} else . end) end)' /tmp/review-in.json >/tmp/review-with-ids.json

# --- 4. sticky comment upsert -----------------------------------------------
SUMMARY=$(jq -r .summary /tmp/review-with-ids.json)
SCORE=$(jq -r .score /tmp/review-with-ids.json)
VERDICT=$(jq -r '.verdict | gsub("_"; " ")' /tmp/review-with-ids.json)
ASKS=$(jq -r '[.findings[] | select(.gate=="ask" and (.status // "open") != "decided")] | length' /tmp/review-with-ids.json)
BODY=$(printf '%s\n%s\n-->\n## tvar review · %s risk · score %s · %s\n\n%s\n\n%s\n\n_Full report: %s_' \
  "$MARKER" "$(jq -c . /tmp/review-with-ids.json)" "$(printf '%s' "$RISK" | tr '[:lower:]' '[:upper:]')" "$SCORE" "$VERDICT" "$SUMMARY" \
  "$( [ "$ASKS" -gt 0 ] && printf '**%s decision(s) needed** — see the inline questions and reply on their threads.' "$ASKS" || printf 'No decisions needed.' )" \
  "$REVIEW_URL")
if [ -n "$EXISTING" ]; then
  COMMENT_URL=$(jq -n --arg b "$BODY" '{body: $b}' | gh api -X PATCH "$API/issues/comments/$EXISTING" --input - --jq .html_url)
else
  COMMENT_URL=$(jq -n --arg b "$BODY" '{body: $b}' | gh api -X POST "$API/issues/$N/comments" --input - --jq .html_url)
fi
log "sticky comment $COMMENT_URL"

# --- 5. risk label ----------------------------------------------------------
# plain case, not an associative array: macOS bash 3.2 has none
color() { case "$1" in critical) echo b60205;; high) echo d93f0b;; important) echo fbca04;; normal) echo 0e8a16;; low) echo c5def5;; *) echo bfe5bf;; esac; }
for r in critical high important normal low safe; do
  gh api "$API/labels/risk%3A%20$r" >/dev/null 2>&1 \
    || jq -n --arg n "risk: $r" --arg c "$(color "$r")" '{name: $n, color: $c, description: "tvar review risk"}' | gh api -X POST "$API/labels" --input - >/dev/null
done
for existing in $(gh api "$API/issues/$N/labels" --jq '.[].name | select(startswith("risk: "))' | sed 's/ /%20/g'); do
  [ "$existing" = "risk:%20$RISK" ] || gh api -X DELETE "$API/issues/$N/labels/$existing" >/dev/null || true
done
jq -n --arg l "risk: $RISK" '{labels: [$l]}' | gh api -X POST "$API/issues/$N/labels" --input - >/dev/null
log "label risk: $RISK"

printf '%s\n' "$REVIEW_URL"
