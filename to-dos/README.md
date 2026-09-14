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

Index (validated against code on 2026-09-14 at v2.3392; the 2026-09-06 validation was at v2.2935 — the 2026-09-05 sweep record is deleted; what it dropped is carried by the release notes and `docs/recent-features/`):

| To-do | Status | Summary |
|---|---|---|
| [`contract-sweep-seen-first/`](./contract-sweep-seen-first/README.md) | **built** 2026-09-14 (v2.3384–v2.3393, seven PRs + two Drive fixes) · Drive connected, first live pass run and two contracts filed from it · left: open Found in Drive to the office set once the matcher has been right a few times, then delete · new owner decision: customer-level (master) agreements for builders | The Contract sweep rebuilt after "is this the best we can do?": shrink the pile (a dollar floor, *Not needed* on a job, a contract question on new jobs), file what is already signed (a Drive pass over the jobs Shared Drive), then a sweep that shows the agreement before it sends and knows a GC job wants *file theirs*. Mock-ups A–D in the folder. |
| [`review-into-the-bridge.md`](./review-into-the-bridge.md) | steps 1–2 shipped (v2.3360, v2.3366, teammate card v2.3368) · step 3 gated on the tables agreeing for a few weeks | People → Review folds into the Bridge: one earned convention + the Vectors row as the door (v2.3360, v2.3366), retire Team Summary once the tables agree (gated). Teammates get money-free Needs You items only. |
| [`gc-portal-customers-bills/`](./gc-portal-customers-bills/README.md) | built 2026-09-13 (PRs 1–4, v2.3375–v2.3378) · migrations pushed and both functions deployed (drift checks clean 2026-09-14) · remaining: the owner runs `scripts/sweeps/share-this-bill-done-right-repairs-2026-09-13.sql` · then shipped, delete me | Share this bill, case by case: "Show it on <other party>'s statement" in Bill Customer, the eye chip on the Bill tab, the job memory on the Edit tab, the GC card default; the portal shows a stamped bill in its own card (GC: *Your customers' open bills*; owner: *On your job, billed to your builder*), no Pay, not in the balance; the v2.3346 symmetric strip retired. Both mock-ups in the folder. |
| [`pipeline-on-a-map/`](./pipeline-on-a-map/README.md) | **built** 2026-09-14 · v2.3396 (the card) · v2.3397 (the rail + hover) · v2.3398 (As of) · PR 4 crews-on-the-day optional · delete after a week of use | The Bid Board's map card at the top of Jobs → Pipeline (same canvases, office rings, rail with dollars to collect) plus an **As of** slider that rewinds every pin to the status it had on any day since Feb 22, 2026 (`job_status_events`); optional crew-on-the-day layer. Four client-only PRs; mock-up in the folder. |
| [`bids-labor-refresh/`](./bids-labor-refresh/README.md) | PRs 1–5 shipped (v2.3276–v2.3307); New is the default view since v2.3310 · PR 6 owner-gated | "Hours that learn": the queue of rows the book could not answer, alias learning, source chips, the crew rate, one direct-costs list, calibration against linked jobs. Left (PR 6): fold the human labor books into Robot Default as overrides, who may recalibrate, retire Old. |
| [`burn-against-the-bid/`](./burn-against-the-bid/README.md) | built (PRs 1–5, v2.3297–v2.3306) · left: the owner links the 10 ambiguous job ↔ bid pairs (Settings → Data); two deferred pieces (priced margin on the bid, earned value by stage) | A job budget with provenance (bid snapshot · typed · assumed) so Burn reads against the actual bid; linking as the feature (the 15 exact matches were linked 2026-09-11; 10 ambiguous pairs wait for a hand pick); per-component burn, hours first; Bid Board chips; mock-ups kept in the folder. |
| [`stage-plan-residuals.md`](./stage-plan-residuals.md) | low | What the Stage Plan train (v2.3083–v2.3134) left: capable-to-bill reading `billable()`, retiring `offered_to_gc` / bundles, plain rows on the final draw, the Any-done rule, the drawer's mint door. |
| [`test-reports/`](./test-reports/README.md) | built 2026-09-11 (PRs 1–13, v2.3296–v2.3331; dial B switch off by default) · one residual, dated ~2026-10-11: retire plumbingtooling.com after a month of no visits | The hydrostatic / gas test report and its email (report PDF + Stripe pay link to the GC), rebuilt inside PipeTooling from the plumbingtooling.com app: kernel + real-text PDF, `job_test_reports`, the modal on the Stages door, Send to the GC, drafts from the clock-out report, Needs You line, portal; retire the external app. Mock-up in the folder. |
| [`takeoffs-retire-old.md`](./takeoffs-retire-old.md) | **unblocked 2026-09-11** · PR 8 (re-measure) is next | Re-measure coverage after a week of One at a time / Sheet, then retire the Old takeoffs view. |
| [`job-summary-follow-ups.md`](./job-summary-follow-ups.md) | not started (Bid vs actual shipped v2.3342) | Days delta strip, the under-60% Needs-you card, PTO / overtime on Capacity, the J963 loader reconcile, the earned-revenue kernel. |
| [`sub-sheet-job-link-followups.md`](./sub-sheet-job-link-followups.md) | A–E converted (v2.3059–v2.3071) · left: the dated cleanup | Every reader is on `job_ledger_id`; what remains is dropping the number fallbacks, retiring the two `_by_hcp_numbers` RPCs and `laborJobMatchesHcp`, and widening `job_number` off `varchar(10)`. |
| [`subs-residuals.md`](./subs-residuals.md) | not started | Derived sheet stage (now unblocked), Spanish signature form, compliance chips, offer templates, benched subs in the sheet form, roster hygiene. |
| [`dispatch-residuals.md`](./dispatch-residuals.md) | low | Phone-request self-heal, dispatch blocks / nudge history on the sheet rows, the tag-slice refresh. |
| [`division-22-rules-manager.md`](./division-22-rules-manager.md) | owner-gated | Rules manager UI; RH / EDF / med-gas seed call. Gas and the Needs You card shipped. |
| [`crew-pnl-and-wheels.md`](./crew-pnl-and-wheels.md) | not started, optional | Vehicle rates on Crew P&L and Bids; the $50 sub-equivalent default; the backlog lines still true. |
| [`person-identity-phase-e.md`](./person-identity-phase-e.md) | gated | NOT NULL, re-PK off `person_name`, retire the name cascade — after a quiet quarter. |
| [`per-gc-bid-retirement.md`](./per-gc-bid-retirement.md) | low | Retire `bids.submitted_to` / `itb_links` behind `bid_gcs`; the auto-derive question. |
| [`partnerships-off-toggles.md`](./partnerships-off-toggles.md) | owner + attorney gated | Notice delivery, estimating cap, W2 watch (modeled); runway floor (not modeled); the notes preview. |
| [`weekly-money-later.md`](./weekly-money-later.md) | optional | Phase 6: drilldowns, GC lens, month roll-up, timeline feed, wider access. |
| [`customer-waiting-residuals.md`](./customer-waiting-residuals.md) | not started | Callback-promise wording, sub-portal priority, auto-lower overnight (owner decisions); per-caller mute, one eligibility hook, the shared `tel:` sweep. |
| [`robots-residuals.md`](./robots-residuals.md) | low | Client-side leftovers only; the twins program runs from `docs/twins/HANDOFF.md`. |
| [`supply-house-job-account-aging.md`](./supply-house-job-account-aging.md) | waiting on Taunya | Job-account invoices in the aging heat map; bulk flag; the May follow-ups. |
| [`engineering-hygiene.md`](./engineering-hygiene.md) | low | Decomposition inventory regrown again; two silent-no-op update sweeps. |
| [`journey-map-tier-1.md`](./journey-map-tier-1.md) | pointer | Which drift rows are closed here; the list lives in the private repo. |
| [`owner-decisions-pending.md`](./owner-decisions-pending.md) | standing list | Every yes/no the docs are waiting on, one line each. |

Closed on the 2026-09-14 sweep (files deleted): `bill-truth-shadow-beacon` (done in v2.3218, #2930 — the beacon, the legacy sums and `billTruthShadow.ts` are gone); `supply-house-directory` (all six PRs v2.3166–v2.3173 plus the 2026-09-10 close-out v2.3243 / v2.3244; the two mock-ups live in git history at the deleting commit).

Closed since the 2026-09-05 sweep (files deleted): `accounts-receivable-refresh` (all four PRs merged 2026-09-13, v2.3379–v2.3382 — the release notes and `docs/recent-features/` carry the record; the mock-up lived in the folder and in the artifact); `contract-forms-publish-authored` (Direct Deposit 2026-09-06; the four lien waivers + the pay-row picker v2.3062 on 2026-09-07); `deploy-backlog` (checked 2026-09-06 from a linked checkout — 470/470 migrations applied, 104/104 functions current after one `_shared` importer, `get-bid-proposal-room`, was redeployed); `error-message-follow-ups` (v2.2861 shipped Retry + the online listener and fixed the week-grid bid branch); `rfq-apply-picks-to-bid-costs` (Rung G had already shipped as v2.2655 — the sweep missed it; its residuals live in `docs/SUPPLY_HOUSE_RFQ_PLAN.md` → Deferred).

Not duplicated here, by design: `docs/twins/HANDOFF.md` → "Open threads, prioritized" (the robots program, updated daily) and the private journey-map repo's `_DRIFT-2` (security findings).
