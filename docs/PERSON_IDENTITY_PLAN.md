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

- 2026-07-23 — plan written; Combine people shipped (v2.982). Phases A–E not started.
