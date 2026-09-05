# To-dos

Projects that were designed, discussed, or partly built but cannot be finished right away. Any editor — a person or an agent session — can pick one up cold.

Each to-do is one folder or file here. It must leave enough behind that the next session does not have to re-derive the decision:

- **The ask, in the owner's words** — what was wanted and why.
- **The decision** — which option was picked, what was rejected, and any open questions.
- **The mock-up or spec** — kept here (an `.html` next to the `.md`), not only on a chat link.
- **Where it plugs in** — the files, kernels, tables, and RPCs already involved, with what exists versus what is new.
- **The plan** — an ordered PR train, smallest shippable first, with what each PR touches.
- **How to verify** — the live-test recipe, test data or dummy accounts, and any gotchas hit along the way.
- **State** — `Status:` line at the top (`not started` · `in progress` · `blocked on …` · `shipped, delete me`).

When you pick one up: put your branch name on the `Status:` line, drop a session card in `.claude/sessions/active/` (see [`docs/SESSIONS.md`](../docs/SESSIONS.md)), and follow the repo's usual conventions — claim a version with `npm run claim`, ship a release note and a `docs/recent-features/` fragment per PR, guides with features. When it ships, delete the to-do and let the release notes and docs carry the record.

When a plan doc or a release-notes fragment defers something, add it here (one file, or a line in an existing file) and leave a one-line pointer in the source — each fact has one home.

Index (validated against code and the live app on 2026-09-05 — see [`2026-09-05-docs-sweep.md`](./2026-09-05-docs-sweep.md) for what was dropped and why):

| To-do | Status | Summary |
|---|---|---|
| [`work-orders-one-row-spine.md`](./work-orders-one-row-spine.md) | not started | Work Orders and Sub Labor share one row, with the sub portal's progress rail on it; two derivation bugs to fix first. |
| [`takeoffs-retire-old.md`](./takeoffs-retire-old.md) | blocked until ~2026-09-11 | Re-measure coverage after a week of New 1 / New 2, then retire the Old takeoffs view. |
| [`rfq-apply-picks-to-bid-costs.md`](./rfq-apply-picks-to-bid-costs.md) | not started (owner approved) | Quote picks and vendor lots write a fixture-level cost override with provenance and revert. |
| [`job-summary-follow-ups.md`](./job-summary-follow-ups.md) | not started | PTO / overtime on Capacity, the under-60% Needs-you card, travel on Days, bid vs actual, the % provenance badge. |
| [`error-message-follow-ups.md`](./error-message-follow-ups.md) | not started | Retry + online listener on the real offline path; the week-grid bid branch; the last text check. |
| [`contract-forms-publish-authored.md`](./contract-forms-publish-authored.md) | blocked on owner review | Publish Direct Deposit and the four lien waivers once the wording is approved. |
| [`division-22-rules-manager.md`](./division-22-rules-manager.md) | owner-gated | Rules manager, unmatched-names audit, menu badge, four unseeded sections. |
| [`crew-pnl-and-wheels.md`](./crew-pnl-and-wheels.md) | not started, optional | Vehicle rates on Crew P&L and Bids; the $50 sub-equivalent default; the backlog lines still true. |
| [`subs-residuals.md`](./subs-residuals.md) | not started | Derived sheet stage, Spanish signature form, role-literal RPC, run-subs polish, roster hygiene. |
| [`person-identity-phase-e.md`](./person-identity-phase-e.md) | gated | NOT NULL, re-PK off `person_name`, retire the name cascade — after a quiet quarter. |
| [`per-gc-bid-retirement.md`](./per-gc-bid-retirement.md) | low | Retire `bids.submitted_to` / `itb_links` behind `bid_gcs`; the auto-derive question. |
| [`partnerships-off-toggles.md`](./partnerships-off-toggles.md) | owner + attorney gated | Notice delivery, estimating cap, runway floor, W2 watch. |
| [`weekly-money-later.md`](./weekly-money-later.md) | optional | Phase 6: drilldowns, GC lens, month roll-up, timeline feed, wider access. |
| [`robots-residuals.md`](./robots-residuals.md) | low | Client-side leftovers only; the twins program runs from `docs/twins/HANDOFF.md`. |
| [`supply-house-job-account-aging.md`](./supply-house-job-account-aging.md) | waiting on Taunya | Job-account invoices in the aging heat map; bulk flag; the May follow-ups. |
| [`engineering-hygiene.md`](./engineering-hygiene.md) | low | Decomposition inventory regrown; two silent-no-op update sweeps. |
| [`journey-map-tier-1.md`](./journey-map-tier-1.md) | pointer | Which Tier-1 drift rows are closed here; the list lives in the private repo. |
| [`owner-decisions-pending.md`](./owner-decisions-pending.md) | standing list | Every yes/no the docs are waiting on, one line each. |

Not duplicated here, by design: `docs/twins/HANDOFF.md` → "Open threads, prioritized" (the robots program, updated daily) and the private journey-map repo's `_DRIFT-2` (security findings).
