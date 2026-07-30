# Person identity: name-text → person_id (migration plan)

---
file: docs/PERSON_IDENTITY_PLAN.md
type: Engineering / Migration plan
purpose: Staged plan to move pay/labor identity off trimmed-name joins onto people.id keys, ending the name-variant bug class (split Crew P&L rows, silent zero wages on rename). Written 2026-07-23 alongside the Combine-people tool (v2.982).
audience: Developers, AI Agents
last_updated: 2026-07-23
---

## The problem

Identity in the pay/labor domain is keyed by **trimmed name text**: `people_hours`, `people_pay_config`, `people_crew_jobs`/`_bids`, `pay_stubs`(+days), `people_team_members`, `people_hours_display_order`, `person_offsets`, `hours_reviewed` all join on `person_name`; `people_labor_jobs.assigned_to_name` is a `' | '`-delimited multi-name string. Consequences: a name variant ("Behar Kraja (Rough In)") becomes a second identity everywhere; a rename silently zeroes wage joins (see `docs/SALARY_CLOCK_SESSIONS.md`); Crew P&L splits people.

## Where we already are (better than assumed)

- `person_id → people.id` columns **already exist** on: `people_hours`, `people_pay_config`, `people_crew_jobs`, `pay_stubs`, `people_team_members` (fill rate unknown — measure first).
- A phase-0 audit script exists: [`scripts/audit-pay-person-id-phase0.sql`](../scripts/audit-pay-person-id-phase0.sql) (orphan names, fill rates, and an inventory of every name-keyed SQL site).
- `clock_sessions` is already `user_id`-keyed (sound).
- Interim tooling: **Combine people** (v2.982, People → Users) folds a duplicate into a keeper — repoints `person_id` where present AND rewrites names, so it works at every phase below.

## Phases (each independently shippable; readers keep name-fallback so a missed backfill degrades to today, never worse)

- **A — Measure** (no code): run the phase-0 audit against prod; record fill rates + orphan names here.
- **B — Backfill + auto-populate** (one migration): backfill `person_id` by trimmed-name match where NULL; add triggers resolving `person_id` from name on insert; add `person_id` to the remaining name-keyed tables (`people_crew_bids`, `pay_stub_days`, `people_hours_display_order`, `person_offsets`, `hours_reviewed`); create `people_labor_job_assignees(labor_job_id, person_id)` shadowing the delimited text, backfilled the same way. Name columns stay as denormalized display.
- **C — Flip readers, one surface per PR**: Crew P&L wage/identity joins → `get_paid_job_email_payload` → `approve_clock_sessions` crew sync → Hours/payroll views. Pattern: prefer `person_id`, fall back to name.
- **D — Flip writers**: pickers select *people* (write `person_id` + display name); the sub-sheet assignee picker writes the junction.
- **E — Enforce**: FKs / NOT NULL where safe; renames become one `people` row update; retire `cascadePersonNameInPayTables`.

## Invariants during the migration

1. Never key NEW logic on name text — always `person_id` (fallback reads only).
2. Combine people must keep working at every phase (it already does both id-repoint and name-rewrite).
3. Every phase-C PR includes a before/after check on the surface's totals (Crew P&L totals must not shift from a pure re-keying).

## Status log

- 2026-07-30 — **C1-2 shipped** (v2.1123): `teamLabor` `fetchLaborPayConfigMap` seeds `id:<uuid>` flag entries directly from the RPC's `person_id` (wage-merge preserves id-seeded flags) — the costing loaders' salaried 8/0 rule is now fully id-first. Remaining C1: `usePayConfig` + Quickfill sections, `CrewJobsBlock`/`HoursUnassignedModal`, salary probes, `people_hours` joins, `PeopleReviewTab` junction read.
- 2026-07-30 — **C1-1 shipped** (v2.1122): shared `payFlagsIndex` kernel (id-first, name-fallback) + `fetchSalariedUserIdSetFromUserIds` flipped (user → person via `people.account_user_id`, name fallback retained). Prod precheck: **zero** `people_pay_config` rows where the id-first answer differs from the name answer — flip is answer-preserving; the win is future renames. Remaining C1 flips: the six other `list_people_pay_flags` consumers, salary probes (`ClockInOutButton`/`Dashboard`), `teamLabor` `people_hours` joins, `useDashboardMyTeamSectionState` name-IN, `PeopleReviewTab` junction read.

- 2026-07-30 — **Audit rerun (post-C0, read-only prod via psql)**: fill rates `people_pay_config` 24/24, `people_crew_jobs` 1428/1428, `people_crew_bids` 169/169, `person_offsets` 29/29, `hours_reviewed` 1/1, `people_hours_display_order` 4/4, `people_hours` 1596/1650 (54 NULLs = the frozen Feb–Mar historical rows: Tristen (Assistant)/Mario Lozano/The Darren + newer "Mike Z" Mar–May rows), `pay_stubs` 253/256, `pay_stub_days` 1771/1792. **Zero duplicate-person_id keys → Phase-D unique indexes are unblocked.** Junction `people_labor_job_assignees` covers 45/56 sheets; unresolved segments: "Behar Kraja (Rough In)" (Combine candidate), "Edgar", "MIke Rodriguez". **New ambiguity blocker: active roster name "Kyle" ×2** (25 people_hours rows resolve to NULL) — owner decision: combine if same person, rename if two Kyles. Orphan pay-config name "Mike Z" has no roster row.
- 2026-07-30 — **Tooling-gap sweep** (FRAGILITY_REMEDIATION_PLAN.md C0): Combine-people id-repoint list extended to all ten tables (v2.1111 — was the Phase-B five, leaving B2 tables pointing at archived duplicates); rename cascade now loops the shared `NAME_KEYED_TABLES` inventory incl. `person_offsets`/`hours_reviewed` (v2.1112); triggers widened to `BEFORE INSERT OR UPDATE OF person_name` as `set_person_id_on_write` with COALESCE re-resolve (v2.1113, migration `20260730164728` — fixes the Edit-offset person-swap desync; note the trigger rename when grepping). Phase-0 audit script extended with fill rates, Phase-D unique-key preflight, and junction coverage; rerun pending (needs Supabase MCP or an operator with SQL access).
- 2026-07-23 — plan written; Combine people shipped (v2.982). Phases A–E not started.
- 2026-07-24 — **Phase C-3 verified done-by-trigger** (zero unkeyed crew rows; set_person_id_on_insert fires under approve_clock_sessions). **Phase C-4 shipped** (v2.1012): teamLabor wage map person-first (`id:<uuid>` keys) across all three loaders; salary flags stay name-keyed until `list_people_pay_flags` flips (C-4b, with Phase D). Remaining: D writers, E enforce.
- 2026-07-24 — **Phase C-2 shipped** (v2.1011, migration 20260722272000): paid-email wage joins person-first with name fallback. Next: C-3 approve_clock_sessions crew sync, C-4 hours/payroll views.
- 2026-07-24 — **Phase C-1 shipped** (v2.1010): Crew P&L reads person_id-first (`keyForPerson`); name fallback intact. Next: C-2 `get_paid_job_email_payload`, C-3 `approve_clock_sessions` crew sync, C-4 hours/payroll views.
- 2026-07-24 — **Phase B2 shipped** (v2.1009, migration 20260722270000): five remaining tables already had person_id (doc was stale) — backfilled + triggered; `people_labor_job_assignees` junction created, synced by trigger, backfilled. Next: Phase C readers.
- 2026-07-24 — **Phase B shipped** (v2.1008, migration 20260722268000): create-people-rows fork chosen by owner; linked rows + resolver + backfill + insert triggers. Phases C–E pending.
- 2026-07-24 — **Phase A (measure) complete** (read-only, prod). Fill rates: `people_hours` 103/1,572, `people_pay_config` 3/24, `people_crew_jobs` 109/1,345, `pay_stubs` 14/245, `people_team_members` 0/0. **Zero duplicate active roster names** (no ambiguity blocker). **Key finding: pay identity actually keys on `users.name`, not `people.name`** — all 24 pay-config names match `users` exactly, only 2–3 match active `people`; a people-by-name backfill would fill almost nothing. Phase B must resolve `person_name → users` first (then users→people via account links, or adopt `users.id` as the canonical key for pay tables — decision needed). Historical orphans are contained: 3 names ("Tristen (Assistant)", "Mario Lozano", "The Darren"), 54 frozen `people_hours` rows, all Feb–Mar 2026, none current — "Tristen (Assistant)" is a Combine-people candidate.
