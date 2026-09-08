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

Index (validated against code on 2026-09-06 at v2.2935 — the 2026-09-05 sweep record is deleted; what it dropped is carried by the release notes and `docs/recent-features/`):

| To-do | Status | Summary |
|---|---|---|
| [`stage-plan/`](./stage-plan/README.md) | **approved, not started** | The line item is the stage: Order / Any / — on the Bill tab, generator kinds, Edit read-out + customer drawer, the GC card as a simple sequence with no sub names. Six-PR train, mock-ups inside. |
| [`supabase-restart-ticket-followup.md`](./supabase-restart-ticket-followup.md) | **dated: follow up 2026-09-14** | Support ticket filed 2026-09-07 for the 30+ instance restarts; read the thread, re-count the week, close the runbook entry. |
| [`bill-truth-shadow-beacon.md`](./bill-truth-shadow-beacon.md) | **dated: remove by 2026-09-19** | Read the mismatch beacon, then delete the legacy sums and `billTruthShadow.ts`. |
| [`takeoffs-retire-old.md`](./takeoffs-retire-old.md) | blocked until ~2026-09-11 | Re-measure coverage after a week of One at a time / Sheet, then retire the Old takeoffs view. |
| [`job-summary-follow-ups.md`](./job-summary-follow-ups.md) | not started | Days delta strip, the under-60% Needs-you card, Bid vs actual (now unblocked), PTO / overtime on Capacity, the J963 loader reconcile, the earned-revenue kernel. |
| [`sub-sheet-job-link-followups.md`](./sub-sheet-job-link-followups.md) | converting — A + E done v2.3059 | Every reader still matching a sub sheet to its job by number — five money RPCs, four sub-portal sites, six per-job reads, the People → Review maps — with the conversion order. |
| [`subs-residuals.md`](./subs-residuals.md) | not started | Derived sheet stage (now unblocked), Spanish signature form, compliance chips, offer templates, benched subs in the sheet form, roster hygiene. |
| [`dispatch-residuals.md`](./dispatch-residuals.md) | low | Phone-request self-heal, dispatch blocks / nudge history on the sheet rows, the tag-slice refresh. |
| [`division-22-rules-manager.md`](./division-22-rules-manager.md) | owner-gated | Rules manager UI; RH / EDF / med-gas seed call. Gas and the Needs You card shipped. |
| [`crew-pnl-and-wheels.md`](./crew-pnl-and-wheels.md) | not started, optional | Vehicle rates on Crew P&L and Bids; the $50 sub-equivalent default; the backlog lines still true. |
| [`person-identity-phase-e.md`](./person-identity-phase-e.md) | gated | NOT NULL, re-PK off `person_name`, retire the name cascade — after a quiet quarter. |
| [`per-gc-bid-retirement.md`](./per-gc-bid-retirement.md) | low | Retire `bids.submitted_to` / `itb_links` behind `bid_gcs`; the auto-derive question. |
| [`partnerships-off-toggles.md`](./partnerships-off-toggles.md) | owner + attorney gated | Notice delivery, estimating cap, W2 watch (modeled); runway floor (not modeled); the notes preview. |
| [`weekly-money-later.md`](./weekly-money-later.md) | optional | Phase 6: drilldowns, GC lens, month roll-up, timeline feed, wider access. |
| [`robots-residuals.md`](./robots-residuals.md) | low | Client-side leftovers only; the twins program runs from `docs/twins/HANDOFF.md`. |
| [`supply-house-job-account-aging.md`](./supply-house-job-account-aging.md) | waiting on Taunya | Job-account invoices in the aging heat map; bulk flag; the May follow-ups. |
| [`engineering-hygiene.md`](./engineering-hygiene.md) | low | Decomposition inventory regrown again; two silent-no-op update sweeps. |
| [`journey-map-tier-1.md`](./journey-map-tier-1.md) | pointer | Which drift rows are closed here; the list lives in the private repo. |
| [`owner-decisions-pending.md`](./owner-decisions-pending.md) | standing list | Every yes/no the docs are waiting on, one line each. |

Closed since the 2026-09-05 sweep (files deleted): `contract-forms-publish-authored` (Direct Deposit 2026-09-06; the four lien waivers + the pay-row picker v2.3062 on 2026-09-07); `deploy-backlog` (checked 2026-09-06 from a linked checkout — 470/470 migrations applied, 104/104 functions current after one `_shared` importer, `get-bid-proposal-room`, was redeployed); `error-message-follow-ups` (v2.2861 shipped Retry + the online listener and fixed the week-grid bid branch); `rfq-apply-picks-to-bid-costs` (Rung G had already shipped as v2.2655 — the sweep missed it; its residuals live in `docs/SUPPLY_HOUSE_RFQ_PLAN.md` → Deferred).

Not duplicated here, by design: `docs/twins/HANDOFF.md` → "Open threads, prioritized" (the robots program, updated daily) and the private journey-map repo's `_DRIFT-2` (security findings).
