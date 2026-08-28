# Documentation index

> One-stop map of every doc in this repo: what it's for, when to read it, and how it's maintained.
> Entry order for agents: [`AGENTS.md`](../AGENTS.md) (constraints + login) → [`AI_CONTEXT.md`](./AI_CONTEXT.md) (project overview) → the specialist doc for your task (below).

## Reading order for a new agent

1. [`../CLAUDE.md`](../CLAUDE.md) — hard rules (migrations, deploy tracks, conventions). Loaded automatically in Claude Code.
2. [`../AGENTS.md`](../AGENTS.md) — agent entry point: dev login, non-negotiable constraints, migration-drift recovery.
3. [`AI_CONTEXT.md`](./AI_CONTEXT.md) — project overview: systems, concepts, file map, patterns, glossary.
4. The specialist doc for your task — see the table below.
5. [`RECENT_FEATURES.md`](./RECENT_FEATURES.md) — grep it (don't read it top-to-bottom; it's a ~20k-line changelog) for the history of any surface you're touching.

## Specialist docs

| Doc | Purpose |
|---|---|
| [`PROJECT_DOCUMENTATION.md`](./PROJECT_DOCUMENTATION.md) | Full technical reference: schema, pages, features. Documents ~55 of 252 tables; feature sections carry the rest. |
| [`ACCESS_CONTROL.md`](./ACCESS_CONTROL.md) | Authoritative role/permission matrices for all 9 roles. Prefer this over role notes in other docs. |
| [`ADDING_A_NEW_ROLE.md`](./ADDING_A_NEW_ROLE.md) | Step-by-step checklist for adding a role (updated with controller-rollout lessons). |
| [`GLOSSARY.md`](./GLOSSARY.md) | Domain terms, abbreviations, feature names. |
| [`RECENT_FEATURES.md`](./RECENT_FEATURES.md) | Append-only changelog, one entry per PR (`v2.NNN`). The single home for per-feature detail. |
| [`MIGRATIONS.md`](./MIGRATIONS.md) | Migration history + the baseline-squash story. Pair with `npm run check:migration-drift`. |
| [`EDGE_FUNCTIONS.md`](./EDGE_FUNCTIONS.md) | Reference for all Supabase Edge Functions (deploy is manual — see `../CLAUDE.md`). |
| [`BILLING_FLOWS.md`](./BILLING_FLOWS.md) | Billing system map: job lifecycle, invoices/break-offs, the three billing channels, Stripe test/live plumbing, payments, send-backs, cleanup — plus the live-test safety brief. |
| [`REPORT_SUBSCRIPTIONS.md`](./REPORT_SUBSCRIPTIONS.md) | The Report Subscriptions system: streams, request tables, cron dispatchers, fresh-at-send builds, My Email Schedule — and the checklist for adding a new stream. |
| [`BIDS_SYSTEM.md`](./BIDS_SYSTEM.md) | Bids system: all tabs, workflow, schema. |
| [`BIDS_TABS_ARCHITECTURE.md`](./BIDS_TABS_ARCHITECTURE.md) | Decomposition map of `src/pages/Bids.tsx` (per-tab state/coupling, extraction status). |
| [`PEOPLE_TABS_ARCHITECTURE.md`](./PEOPLE_TABS_ARCHITECTURE.md) | Same map for `src/pages/People.tsx`. |
| [`HR_FILES.md`](./HR_FILES.md) | Dev-only People → HR employee files: schema, access model, and the agent writing convention. |
| [`DASHBOARD_SECTIONS_ARCHITECTURE.md`](./DASHBOARD_SECTIONS_ARCHITECTURE.md) | Same map for `src/pages/Dashboard.tsx` (section-based, not tabbed). |
| [`JOBS_TABS_ARCHITECTURE.md`](./JOBS_TABS_ARCHITECTURE.md) | Same map for `src/pages/Jobs.tsx` (Stages board + job-mutation engine mapped in depth). |
| [`JOB_FORM_MODAL_ARCHITECTURE.md`](./JOB_FORM_MODAL_ARCHITECTURE.md) | Same map for `src/components/jobs/JobFormModal.tsx` (a modal — form sections, not tabs; save-engine deep-dive). |
| [`MATERIALS_TABS_ARCHITECTURE.md`](./MATERIALS_TABS_ARCHITECTURE.md) | Same map for `src/pages/Materials.tsx` (written proactively — low-churn, no extraction scheduled). |
| [`SETTINGS_TABS_ARCHITECTURE.md`](./SETTINGS_TABS_ARCHITECTURE.md) | Same map for `src/pages/Settings.tsx` (documents what's already extracted + what remains). |
| [`PAGE_DECOMPOSITION_PLAYBOOK.md`](./PAGE_DECOMPOSITION_PLAYBOOK.md) | The method for breaking down god components + current large-file inventory. Start here for extraction work. |
| [`ESTIMATES_TABS_ARCHITECTURE.md`](./ESTIMATES_TABS_ARCHITECTURE.md) | Step-0 map for `src/pages/Estimates.tsx` (EstimateList + EstimateDetail behind a URL router). |
| [`WORKFLOW_PAGE_ARCHITECTURE.md`](./WORKFLOW_PAGE_ARCHITECTURE.md) | Step-0 map for `src/pages/Workflow.tsx` (per-project stage pipeline; region-based, not tabbed). |
| [`BANKING_TABS_ARCHITECTURE.md`](./BANKING_TABS_ARCHITECTURE.md) | Step-0 map for `src/pages/Banking.tsx` + the two oversized extracted Mercury tabs. |
| [`PROSPECTS_TABS_ARCHITECTURE.md`](./PROSPECTS_TABS_ARCHITECTURE.md) | Step-0 map for `src/pages/Prospects.tsx` + `TeamProspectsTab` (hiring board). |
| [`CHECKLIST_TABS_ARCHITECTURE.md`](./CHECKLIST_TABS_ARCHITECTURE.md) | Step-0 map for `src/pages/Checklist.tsx` + `ChecklistTechTreeTab`. |
| [`QUICKFILL_ARCHITECTURE.md`](./QUICKFILL_ARCHITECTURE.md) | Step-0 map for `src/pages/Quickfill.tsx` (section framework) + `QuickfillScheduleSection`. |
| [`JOB_TALLY_ARCHITECTURE.md`](./JOB_TALLY_ARCHITECTURE.md) | Step-0 map for `src/pages/JobTally.tsx` (Transactions + Materials Estimate tabs). |
| [`SCHEDULE_DISPATCH_ARCHITECTURE.md`](./SCHEDULE_DISPATCH_ARCHITECTURE.md) | Step-0 map for `ScheduleDispatchHub` + `ScheduleDispatchHubPage` (container/presentational pair). |
| [`BIDS_TAKEOFF_TAB_ARCHITECTURE.md`](./BIDS_TAKEOFF_TAB_ARCHITECTURE.md) | Sub-decomposition map for `BidsTakeoffTab` (regrown extracted tab). |
| [`BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md`](./BIDS_PRICING_LABOR_TABS_ARCHITECTURE.md) | Sub-decomposition map for `BidsPricingTab` + `BidsLaborTab` (useBidPricingEngine consumers). |
| [`BID_SUBMISSION_FOLLOWUP_TAB_ARCHITECTURE.md`](./BID_SUBMISSION_FOLLOWUP_TAB_ARCHITECTURE.md) | Sub-decomposition map for `BidSubmissionFollowupTab`. |
| [`JOBS_STAGES_TAB_ARCHITECTURE.md`](./JOBS_STAGES_TAB_ARCHITECTURE.md) | Sub-decomposition map for `JobsStagesTab` + its table/row sub-files (Stages board). |
| [`JOBS_JOB_SUMMARY_TAB_ARCHITECTURE.md`](./JOBS_JOB_SUMMARY_TAB_ARCHITECTURE.md) | Sub-decomposition map for `JobsJobSummaryTab` (fully presentational cost-rollup ledger). |
| [`SEND_RECORD_INVOICE_MODAL_ARCHITECTURE.md`](./SEND_RECORD_INVOICE_MODAL_ARCHITECTURE.md) | Step-0 map for `SendRecordInvoiceModal` ("Bill Customer", three billing channels). |
| [`JOBS_MODALS_ARCHITECTURE.md`](./JOBS_MODALS_ARCHITECTURE.md) | Step-0 map for `JobsSubLaborFormModal` + `DetailJobModal`. |
| [`PEOPLE_REVIEW_TAB_ARCHITECTURE.md`](./PEOPLE_REVIEW_TAB_ARCHITECTURE.md) | Sub-decomposition map for `PeopleReviewTab` (dev-only Review analytics). |
| [`PEOPLE_CONTRACTS_OVERHEAD_TABS_ARCHITECTURE.md`](./PEOPLE_CONTRACTS_OVERHEAD_TABS_ARCHITECTURE.md) | Sub-decomposition map for `PeopleContractsTab` + `PeopleOverheadTab`. |
| [`MY_TIME_DAY_EDITOR_MODAL_ARCHITECTURE.md`](./MY_TIME_DAY_EDITOR_MODAL_ARCHITECTURE.md) | Step-0 map for `DashboardMyTimeDayEditorModal` (shared clock-day editor, 13 call sites). |
| [`CLOCK_SURFACES_ARCHITECTURE.md`](./CLOCK_SURFACES_ARCHITECTURE.md) | Step-0 map for `DashboardTeamActiveClockStrip` + `ClockInOutButton`. |
| [`PROJECTS_FORECAST_TABS_ARCHITECTURE.md`](./PROJECTS_FORECAST_TABS_ARCHITECTURE.md) | Step-0 map for `ProjectsForecastSpecificTab` + its stage modal. |
| [`PERSON_IDENTITY_PLAN.md`](./PERSON_IDENTITY_PLAN.md) | Staged migration off name-text identity onto people.id keys; Combine-people context. |
| [`RUN_SUBS_PLAN.md`](./RUN_SUBS_PLAN.md) | Phased plan to run subcontractors through Projects: person-id step assignment, step commitments, settlement into Sub Labor, sub-facing money view. |
| [`PER_GC_BID_PLAN.md`](./PER_GC_BID_PLAN.md) | Phased plan to finish per-GC bids: contacts-ledger foundation, per-GC Won/Lost in Edit Bid, bid→job winning-GC flow, `bid_gcs` state table (due/submitted-to/ITB). |
| [`FRAGILITY_REMEDIATION_PLAN.md`](./FRAGILITY_REMEDIATION_PLAN.md) | Staged, tested plan for the Stripe-mode, payments_made-invariant, and person-identity-completion workstreams (with status log). |
| [`WEEKLY_MONEY_PLAN.md`](./WEEKLY_MONEY_PLAN.md) | Build plan for the Weekly Money Movement report (per-job money out/in + earned-value lens), the Moneyfill weekly-close queues, and the weekly_money email stream. |
| [`CREW_PNL_DATA_FLOW.md`](./CREW_PNL_DATA_FLOW.md) | Crew P&L inputs/transforms/outputs + incident log (partial-data failures). |
| [`SALARY_CLOCK_SESSIONS.md`](./SALARY_CLOCK_SESSIONS.md) | Salaried auto-session sync behavior runbook. |
| [`TIME_AND_ZONES.md`](./TIME_AND_ZONES.md) | Company timezone rules (`APP_CALENDAR_TZ`), instants vs wall-clock. |
| [`WORKFLOW_FEATURES.md`](./WORKFLOW_FEATURES.md) | Workflow page: stage management, line items, financials. |
| [`PRIVATE_NOTES_SETUP.md`](./PRIVATE_NOTES_SETUP.md) | Notes-for-Office + line items + projections on workflow steps. |
| [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) | White screen, RPC 404s, sign-in, load problems. |
| [`DB_FREEZE_RUNBOOK.md`](./DB_FREEZE_RUNBOOK.md) | App looks "database down": lock-pileup vs instance-stall triage (`/db-freeze` runs it). Read BEFORE restarting anything. |
| [`runbooks/AGENT_APP_CRASH_INVESTIGATION.md`](./runbooks/AGENT_APP_CRASH_INVESTIGATION.md) | Ordered checklist for "why did the app crash" (503s, timeouts). |
| [`runbooks/SUPABASE_INCIDENT_RUNBOOK.md`](./runbooks/SUPABASE_INCIDENT_RUNBOOK.md) | Deep Supabase incident inspection (CLI + Dashboard logs). |
| [`E2E_SMOKE.md`](./E2E_SMOKE.md) | Playwright Tier-1 smoke suite: coverage, auth, extension rules (read-only, structural, non-gating). |
| [`SESSIONS.md`](./SESSIONS.md) | Advisory parallel-session ledger: claim `v2.NNN`/migrations (`npm run claim`), session cards, `npm run sessions` board. |
| [`REMOTE_SCHEMA_INSPECTION.md`](./REMOTE_SCHEMA_INSPECTION.md) | Obsolete incident snapshot; kept for its generic schema-inspection queries only. |
| [`HELP_MEDIA_PLAN.md`](./HELP_MEDIA_PLAN.md) | Help-guide screen recordings: conventions (recordings not screenshots, training account, re-record with features) + the five-recording shortlist with capture scripts. |
| `../src/content/help/*.md` | User-facing help guides (ship with features — see `../CLAUDE.md`). |

## Maintenance rules (how these docs stay fresh)

- **Per-feature detail goes in `RECENT_FEATURES.md` only** (plus the one matching specialist doc). Entry docs (`AGENTS.md`, `AI_CONTEXT.md`, this index) are lean routers — never append feature detail, version numbers, or component inventories to them.
- **Surface layer**: every doc's first ~30 lines must be a self-sufficient summary — what this is, when to read it, and where the depth lives — readable via `Read limit=30`. A reader who stops there should know whether to keep reading or where to go instead.
- **Density**: one fact per bullet; no paragraph longer than ~10 lines; long enumerations become tables or lists. Greppability and partial reads are what make depth-on-demand work — a 3,000-token "line" defeats both.
- **Route, don't restate**: a shallower layer links to the deeper home with at most one hook sentence — never a compressed restatement that can drift independently. Each fact has exactly one home; every other mention is a link.
- **One `last_updated` stamp per doc**, in frontmatter. No line-number hints in frontmatter (`key_sections` names only) — line numbers rot immediately.
- Docs ship with features: `RECENT_FEATURES.md` entry per PR, `MIGRATIONS.md` entry per migration, `EDGE_FUNCTIONS.md` section per function, help guide per user-facing flow (all enforced by convention in `../CLAUDE.md`).
- Migration files cited in docs may live in `supabase/archive/migrations-pre-baseline/` — history was squash-baselined at `20250101000000_baseline.sql` (2026-06-04); "2027"-dated filenames in the archive are typos from spring 2026.

last_updated: 2026-08-09
