# Documentation index

> One-stop map of every doc in this repo: what it's for and when to read it. Entry order for agents: [`../CLAUDE.md`](../CLAUDE.md) (hard rules) → [`../AGENTS.md`](../AGENTS.md) (login, constraints) → [`AI_CONTEXT.md`](./AI_CONTEXT.md) (overview) → the specialist doc for your task (below). Every doc under `docs/` has exactly one row here: a new doc adds its row, a retired doc removes it, a doc whose purpose or status changes amends its row (`../CLAUDE.md` → *Amend, don't add*).

## Reading order for a new agent

1. [`../CLAUDE.md`](../CLAUDE.md) — hard rules (migrations, deploy tracks, conventions). Loaded automatically in Claude Code.
2. [`../AGENTS.md`](../AGENTS.md) — dev login, the two agent write roles, non-negotiable constraints, migration-ledger repair.
3. [`AI_CONTEXT.md`](./AI_CONTEXT.md) — project overview: systems, concepts, file map, patterns, starter glossary.
4. The specialist doc for your task — the tables below.
5. [`recent-features/`](./recent-features/) — one `v2.NNNN.md` fragment per PR since the 2026-08-20 cutover; [`RECENT_FEATURES.md`](./RECENT_FEATURES.md) is the frozen archive before that (grep it, never read it top-to-bottom; ~21k lines). Between them, the history of any surface you're touching. Unfinished work lives in [`../to-dos/`](../to-dos/README.md) and on the in-app Punch list.

## Reference

| Doc | Purpose |
|---|---|
| [`PROJECT_DOCUMENTATION.md`](./PROJECT_DOCUMENTATION.md) | Full technical reference: schema, pages, features. Documents the core tables in depth; feature sections carry the rest. |
| [`ACCESS_CONTROL.md`](./ACCESS_CONTROL.md) | Authoritative role/permission matrices for all 9 roles, plus the database agent roles. Prefer this over role notes in other docs. |
| [`ADDING_A_NEW_ROLE.md`](./ADDING_A_NEW_ROLE.md) | Step-by-step checklist for adding a role. |
| [`GLOSSARY.md`](./GLOSSARY.md) | Domain terms, abbreviations, feature names. |
| [`recent-features/`](./recent-features/) | One `v2.NNNN.md` fragment per PR since 2026-08-20 — the home for per-feature detail (pairs with `src/content/releaseNotes/v2.NNNN.ts`). |
| [`RECENT_FEATURES.md`](./RECENT_FEATURES.md) | Frozen 2026-08-20: the pre-cutover changelog, one entry per PR. Grep only. |
| [`migrations/`](./migrations/) | One `.md` fragment per migration since 2026-08-20 (format in its `README.md`). |
| [`MIGRATIONS.md`](./MIGRATIONS.md) | Frozen 2026-08-20: pre-cutover migration history, the baseline-squash story, best practices and rollback notes. Pair with `npm run check:migration-drift`. |
| [`EDGE_FUNCTIONS.md`](./EDGE_FUNCTIONS.md) | Reference for every Supabase Edge Function (deploy is manual — `../CLAUDE.md`). |
| [`dev-mcp/README.md`](./dev-mcp/README.md) | The MCP server a dev's coding agent reads the app through — as the dev, GET-only: connect, the verbs, what the door refuses, the call log. |
| [`twins/HANDOFF.md`](./twins/HANDOFF.md) | The digital-twins program as it runs: what is live, the gates, day-to-day operation, open threads. The rest of `twins/` is what the robots read (briefs, guides, kickoffs — bundled into twin-mcp); the MCP servers' addresses and naming are in [`../to-dos/mcp-servers.md`](../to-dos/mcp-servers.md). |
| [`BILLING_FLOWS.md`](./BILLING_FLOWS.md) | Billing system map: job lifecycle, invoices/break-offs, the three billing channels, Stripe test/live plumbing, payments, send-backs, cleanup — plus the live-test safety brief. |
| [`PAY_RECONCILE_AGENT.md`](./PAY_RECONCILE_AGENT.md) | Pay sends: the five SQL functions an agent records/links/splits/files through, `npm run pay:backfill`, the reading rules (Tristen via Taunya, "Week − 500", client-direct), and the Postgres test bed. |
| [`REPORT_SUBSCRIPTIONS.md`](./REPORT_SUBSCRIPTIONS.md) | The Report Subscriptions system: streams, request tables, cron dispatchers, fresh-at-send builds, My Email Schedule — and the checklist for adding a stream. |
| [`BIDS_SYSTEM.md`](./BIDS_SYSTEM.md) | Bids system: all tabs, workflow, schema. |
| [`CONTRACT_FORMS.md`](./CONTRACT_FORMS.md) | Contract Forms: a Book entry that is an uploaded PDF with dev-placed entry boxes the signer fills as the real page; FormSchema reference, agent draft→preview workflow, out-of-band storage. |
| [`HR_FILES.md`](./HR_FILES.md) | Dev-only People → HR employee files: schema, access model, the `hr_agent` writing convention. |
| [`COST_BATCHES.md`](./COST_BATCHES.md) | Cost batches: the audited, reversible entrypoint for moving job cost — the two RPCs, the `cost_agent` role, the agent convention. |
| [`CREW_PNL_DATA_FLOW.md`](./CREW_PNL_DATA_FLOW.md) | Crew P&L inputs/transforms/outputs + incident log (partial-data failures). |
| [`SALARY_CLOCK_SESSIONS.md`](./SALARY_CLOCK_SESSIONS.md) | Salaried auto-session sync behavior. |
| [`TIME_AND_ZONES.md`](./TIME_AND_ZONES.md) | Company timezone rules (`APP_CALENDAR_TZ`), instants vs wall-clock. |
| [`WORKFLOW_FEATURES.md`](./WORKFLOW_FEATURES.md) | Workflow page: stage management, line items, financials. |
| [`PRIVATE_NOTES_SETUP.md`](./PRIVATE_NOTES_SETUP.md) | Notes-for-Office + line items + projections on workflow steps. |
| [`E2E_SMOKE.md`](./E2E_SMOKE.md) | Playwright Tier-1 smoke suite: coverage, auth, extension rules (read-only, structural, non-gating). |
| [`SESSIONS.md`](./SESSIONS.md) | Advisory parallel-session ledger: claim `v2.NNNN`/migrations (`npm run claim`), session cards, `npm run sessions` board. |
| [`HELP_MEDIA_PLAN.md`](./HELP_MEDIA_PLAN.md) | Help-guide screen recordings: the standing conventions + the shortlist with capture scripts. |
| [`TEAM_FEEDBACK_RETIRED_QUESTIONS.md`](./TEAM_FEEDBACK_RETIRED_QUESTIONS.md) | The scripted questions the Team Feedback wizard asked before the crew deck replaced it; kept so the wording is never lost. |
| `../src/content/help/*.md` | User-facing help guides (ship with features — `../CLAUDE.md`). |

## Runbooks and one-time setup

| Doc | Purpose |
|---|---|
| [`DB_FREEZE_RUNBOOK.md`](./DB_FREEZE_RUNBOOK.md) | App looks "database down": lock-pileup vs instance-stall triage (`/db-freeze` runs it). Read BEFORE restarting anything. |
| [`runbooks/AGENT_APP_CRASH_INVESTIGATION.md`](./runbooks/AGENT_APP_CRASH_INVESTIGATION.md) | Ordered checklist for "why did the app crash" (503s, timeouts). |
| [`runbooks/SUPABASE_INCIDENT_RUNBOOK.md`](./runbooks/SUPABASE_INCIDENT_RUNBOOK.md) | Deep Supabase incident inspection (CLI + Dashboard logs). |
| [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) | White screen, RPC 404s, sign-in, load problems. |
| [`REMOTE_SCHEMA_INSPECTION.md`](./REMOTE_SCHEMA_INSPECTION.md) | Obsolete incident snapshot; kept for its generic schema-inspection queries only. |
| [`DOMAIN_CUTOVER.md`](./DOMAIN_CUTOVER.md) | The pipetooling.com → clicktooling.com cutover: exact steps, with the old domain kept as a path-preserving redirect. |
| [`DRIVE_INTAKE_SETUP.md`](./DRIVE_INTAKE_SETUP.md) | One-time Google service-account setup for the `drive-intake` edge function. |

## Architecture maps (page decomposition)

Start at [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) — the method for breaking down god components + the current large-file inventory. Each map below is the per-surface state/coupling/extraction picture for one file or cluster.

| Map | Surface |
|---|---|
| [`BIDS_TABS_ARCHITECTURE.md`](./BIDS_TABS_ARCHITECTURE.md) | `src/pages/Bids.tsx` (per-tab state/coupling, extraction status) |
| [`BIDS_TAKEOFF_TAB_ARCHITECTURE.md`](./BIDS_TAKEOFF_TAB_ARCHITECTURE.md) | `BidsTakeoffTab` |
| [`BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`](./BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md) | `BidsPricingTab` + `BidsLaborTab` (useBidPricingEngine consumers) |
| [`BID_SUBMISSION_FOLLOWUP_TAB_ARCHITECTURE.md`](./BID_SUBMISSION_FOLLOWUP_TAB_ARCHITECTURE.md) | `BidSubmissionFollowupTab` |
| [`JOBS_TABS_ARCHITECTURE.md`](./JOBS_TABS_ARCHITECTURE.md) | `src/pages/Jobs.tsx` (Stages board + job-mutation engine) |
| [`JOBS_STAGES_TAB_ARCHITECTURE.md`](./JOBS_STAGES_TAB_ARCHITECTURE.md) | `JobsStagesTab` + its table/row sub-files |
| [`JOBS_JOB_SUMMARY_TAB_ARCHITECTURE.md`](./JOBS_JOB_SUMMARY_TAB_ARCHITECTURE.md) | `JobsJobSummaryTab` (presentational cost-rollup ledger) |
| [`JOB_FORM_MODAL_ARCHITECTURE.md`](./JOB_FORM_MODAL_ARCHITECTURE.md) | `JobFormModal` (form sections; save-engine deep-dive) |
| [`JOBS_MODALS_ARCHITECTURE.md`](./JOBS_MODALS_ARCHITECTURE.md) | `JobsSubLaborFormModal` + `DetailJobModal` |
| [`SEND_RECORD_INVOICE_MODAL_ARCHITECTURE.md`](./SEND_RECORD_INVOICE_MODAL_ARCHITECTURE.md) | `SendRecordInvoiceModal` ("Bill Customer", three billing channels) |
| [`PEOPLE_TABS_ARCHITECTURE.md`](./PEOPLE_TABS_ARCHITECTURE.md) | `src/pages/People.tsx` |
| [`PEOPLE_REVIEW_TAB_ARCHITECTURE.md`](./PEOPLE_REVIEW_TAB_ARCHITECTURE.md) | `PeopleReviewTab` (dev-only Review analytics) |
| [`PEOPLE_CONTRACTS_OVERHEAD_TABS_ARCHITECTURE.md`](./PEOPLE_CONTRACTS_OVERHEAD_TABS_ARCHITECTURE.md) | `PeopleContractsTab` + `PeopleOverheadTab` |
| [`DASHBOARD_SECTIONS_ARCHITECTURE.md`](./DASHBOARD_SECTIONS_ARCHITECTURE.md) | `src/pages/Dashboard.tsx` (section-based) |
| [`MY_TIME_DAY_EDITOR_MODAL_ARCHITECTURE.md`](./MY_TIME_DAY_EDITOR_MODAL_ARCHITECTURE.md) | `DashboardMyTimeDayEditorModal` (shared clock-day editor) |
| [`CLOCK_SURFACES_ARCHITECTURE.md`](./CLOCK_SURFACES_ARCHITECTURE.md) | `DashboardTeamActiveClockStrip` + `ClockInOutButton` |
| [`ESTIMATES_TABS_ARCHITECTURE.md`](./ESTIMATES_TABS_ARCHITECTURE.md) | `src/pages/Estimates.tsx` (EstimateList + EstimateDetail) |
| [`WORKFLOW_PAGE_ARCHITECTURE.md`](./WORKFLOW_PAGE_ARCHITECTURE.md) | `src/pages/Workflow.tsx` (region-based) |
| [`PROJECTS_FORECAST_TABS_ARCHITECTURE.md`](./PROJECTS_FORECAST_TABS_ARCHITECTURE.md) | `ProjectsForecastSpecificTab` + its stage modal |
| [`MATERIALS_TABS_ARCHITECTURE.md`](./MATERIALS_TABS_ARCHITECTURE.md) | `src/pages/Materials.tsx` |
| [`BANKING_TABS_ARCHITECTURE.md`](./BANKING_TABS_ARCHITECTURE.md) | `src/pages/Banking.tsx` + the two extracted Mercury tabs |
| [`PROSPECTS_TABS_ARCHITECTURE.md`](./PROSPECTS_TABS_ARCHITECTURE.md) | `src/pages/Prospects.tsx` + `TeamProspectsTab` |
| [`CHECKLIST_TABS_ARCHITECTURE.md`](./CHECKLIST_TABS_ARCHITECTURE.md) | `src/pages/Checklist.tsx` + `ChecklistTechTreeTab` |
| [`QUICKFILL_ARCHITECTURE.md`](./QUICKFILL_ARCHITECTURE.md) | `src/pages/Quickfill.tsx` (section framework) + `QuickfillScheduleSection` |
| [`JOB_TALLY_ARCHITECTURE.md`](./JOB_TALLY_ARCHITECTURE.md) | `src/pages/JobTally.tsx` |
| [`SCHEDULE_DISPATCH_ARCHITECTURE.md`](./SCHEDULE_DISPATCH_ARCHITECTURE.md) | `ScheduleDispatchHub` + `ScheduleDispatchHubPage` |
| [`SETTINGS_TABS_ARCHITECTURE.md`](./SETTINGS_TABS_ARCHITECTURE.md) | `src/pages/Settings.tsx` |

## Plans

A plan's own status line (top of the file) is the one place its progress is recorded; leftovers that outlive a plan go to [`../to-dos/`](../to-dos/README.md). A plan stays here after it ships because the fragments link to it — its row just says so.

| Plan | Purpose | Status |
|---|---|---|
| [`ESTIMATOR_TWIN_PIPELINE_PLAN.md`](./ESTIMATOR_TWIN_PIPELINE_PLAN.md) | Umbrella plan for the plans-to-proposal estimator-twin pipeline: five waves across PT/CT/twin-mcp/harness, each ending in a live test gate. | in progress (`twins/HANDOFF.md` runs the program) |
| [`DIGITAL_TWINS_PLAN.md`](./DIGITAL_TWINS_PLAN.md) | Role-impersonating agent accounts: per-role briefs, app directory, twin identity in the schema, write fence. | in progress |
| [`RFI_LOOP_PLAN.md`](./RFI_LOOP_PLAN.md) | Cross-app RFI loop: persisted `bids_rfis` queue, CT canvas flags, the internal question lane, ct-bridge auto-pull. | in progress (status log inside) |
| [`PRICE_MATRIX_PLAN.md`](./PRICE_MATRIX_PLAN.md) | The robot price matrix: a pricing twin reads supply-house quote PDFs, structures them as kits + option groups, hands back a best-price compare. | shipped 2026-09-11 (PRs 1–6) |
| [`SUPPLY_HOUSE_RFQ_PLAN.md`](./SUPPLY_HOUSE_RFQ_PLAN.md) | Supply-house RFQs: shared quotes store, paste-back, per-part compare, the quote-link lane, the outside (hand-sent) lane. | shipped; leftovers in `to-dos/price-requests-loop/` |
| [`RFQ_ROUND2_PLAN.md`](./RFQ_ROUND2_PLAN.md) | The owner's post-lane-B RFQ build list, sequenced. | awaiting go |
| [`TAKEOFFS_REFRESH_PLAN.md`](./TAKEOFFS_REFRESH_PLAN.md) | Bids → Takeoffs refresh: Old / One at a time / Sheet behind pills, shared substrate, the book that learns, retirement criteria. | PRs 1–8 shipped; PR 9 (retire Old) in `to-dos/takeoffs-retire-old.md` |
| [`CONTRACT_FORMS_PLAN.md`](./CONTRACT_FORMS_PLAN.md) | Contract Forms build plan: schema/kernel → Form Studio → fill-on-page signing → staff record → the W-9. | in progress (status table inside) |
| [`PER_GC_BID_PLAN.md`](./PER_GC_BID_PLAN.md) | Per-GC bids: contacts-ledger foundation, per-GC Won/Lost, bid→job winning-GC flow, `bid_gcs`. | phases 1–4 shipped; retirement in `to-dos/per-gc-bid-retirement.md` |
| [`RUN_SUBS_PLAN.md`](./RUN_SUBS_PLAN.md) | Running subcontractors through Projects: person-id step assignment, step commitments, settlement into Sub Labor, sub-facing money view. | phases 0–4 shipped; residuals in `to-dos/subs-residuals.md` |
| [`PERSON_IDENTITY_PLAN.md`](./PERSON_IDENTITY_PLAN.md) | Staged migration off name-text identity onto `people.id` keys; Combine-people context. | phases A–D shipped; phase E in `to-dos/person-identity-phase-e.md` |
| [`FRAGILITY_REMEDIATION_PLAN.md`](./FRAGILITY_REMEDIATION_PLAN.md) | Stripe-mode, payments_made-invariant and person-identity workstreams, with status log. | A–B shipped; C continues in `PERSON_IDENTITY_PLAN.md` |
| [`WEEKLY_MONEY_PLAN.md`](./WEEKLY_MONEY_PLAN.md) | Weekly Money Movement report, the Moneyfill weekly-close queues, the weekly_money email stream. | shipped; phase 6 in `to-dos/weekly-money-later.md` |
| [`PARTNERSHIPS_PLAN.md`](./PARTNERSHIPS_PLAN.md) | Partnerships: agreements, profit shares, the partner ledger. | shipped; off toggles in `to-dos/partnerships-off-toggles.md` |
| [`ONE_COMPANY_PLAN.md`](./ONE_COMPANY_PLAN.md) | One company: the master-scoping retirement, phases 1–5c. | complete 2026-09-06 |
| [`JOBS_BOARD_SCOPED_LOAD_PLAN.md`](./JOBS_BOARD_SCOPED_LOAD_PLAN.md) | Jobs board scoped loading, PRs 0–5. | complete 2026-08-19 |
| [`APPLY_PICKS_TO_COSTS_DECISION.md`](./APPLY_PICKS_TO_COSTS_DECISION.md) | The apply-picks-to-costs decision record. | decided + shipped 2026-09-02 |

## Maintenance rules (how these docs stay fresh)

- **Amend, don't add** (`../CLAUDE.md` → Working conventions): when a fact changes, edit the sentence that holds it. A new bullet, section or row only when the fact has no home yet — then exactly one. A rule carries at most one clause of reason; the incident behind it stays in the fragment that fixed it.
- **Per-feature detail goes in the PR's `recent-features/v2.NNNN.md` fragment only** (plus the one matching specialist doc). Entry docs (`AGENTS.md`, `AI_CONTEXT.md`, this index) are lean routers — no feature detail, version numbers or component inventories.
- **Surface layer**: every doc's first ~30 lines are a self-sufficient summary — what this is, when to read it, where the depth lives — readable via `Read limit=30`.
- **Density**: one fact per bullet; no paragraph longer than ~10 lines; long enumerations become tables or lists. Greppability and partial reads are what make depth-on-demand work.
- **Route, don't restate**: a shallower layer links to the deeper home with at most one hook sentence — never a compressed restatement that can drift on its own. Each fact has exactly one home; every other mention is a link.
- **One `last_updated` stamp per doc**, in frontmatter, section *names* only — never line numbers.
- **Docs ship with features**: `recent-features/v2.NNNN.md` fragment + release note per PR, `migrations/<version>_<slug>.md` per migration, `EDGE_FUNCTIONS.md` section per function, help guide per user-facing flow (`../CLAUDE.md`).
- Migration files cited in docs may live in `supabase/archive/migrations-pre-baseline/` — history was squash-baselined at `20250101000000_baseline.sql` (2026-06-04); "2027"-dated filenames there are typos from spring 2026.

last_updated: 2026-09-20
