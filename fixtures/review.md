### Summary
Adds the retailer gate and order flow for the ring configurator. The flow matches the ticket, but the order route writes without an auth check and the discount timing is ambiguous.

### Issues Found
- **C1** · Critical · Security · `README.md:3` — Order route writes orders without checking the retailer is approved. Fix: load the retailer and return 403 unless status is approved.
- **W1** · Warning · Flow/Functional · `README.md:5` — Markup applies before tax; the ticket does not say which. Decision needed: before or after tax?
- **W2** · Warning · Firestore · `README.md:7` — listRetailersByStatus has no limit. Fix: add `.limit(200)` and paginate.
- **S1** · Suggestion · Code Quality · `README.md:9` — normaliseRetailerMarkup duplicates clampPercent.

### Firestore Query Audit
| File | Operation | Collection | Filters | Limit | Issue? |
|---|---|---|---|---|---|
| README.md | getDocs | retailers | status == | none | W2 |

### Impact / Blast-Radius Report
| Change | Other affected sites | Updated? | Action needed |
|---|---|---|---|
| retailer status field | admin retailers page, client gate | yes | none |

### What's Good
Clear separation of pricing from rendering; tests cover the pricing table.

### Verdict
REQUEST CHANGES

### Scope
Skipped package-lock.json; skimmed the admin locale files.
