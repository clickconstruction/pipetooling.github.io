# 20261113090000 — person_engagements (v2.7111, punch list #315 upgrade 4a)

Engagement history: what a person was to the company over time. The roster row says what a person is today and `employment_stints` says when they worked. Neither says in what capacity, so a person who was an employee and then a subcontractor had nothing that recorded the change, its day or what it rests on.

**`person_engagements`** — one row is one stretch in one capacity.

- `kind`: `employee` or `subcontractor`. `started_on`, `ended_on` (inclusive, null while the stretch runs).
- `source`: where the fact comes from, one of `contract`, `payroll`, `owner`, `record`, `other`, with `source_ref` (300 characters) naming it, and `note` (1,000).
- Who recorded it (`created_by`, `author_label`), who closed it (`closed_by`, `closed_at`), and the withdrawal stamps (`withdrawn_at`, `withdrawn_by`, `withdrawn_why`, 1 to 200 characters, set together).
- **`person_engagements_guard`**: after the insert only the last day (once), who closed it and the withdrawal stamps may be set. A withdrawn stretch stays withdrawn. Two live stretches of one person may not share a day; the check runs under an advisory lock a person, so two writers wait their turn.

**`dev_engagement_write(p, dry_run default true)`** — the one door, dev-gated, definer. `p = { person_id, and exactly one of open: { kind, started_on, ended_on?, source, source_ref?, note? } | change: { kind, on, source, source_ref?, note? } | close: { ended_on } | withdraw: { id, why } }`.

- `change` ends the running stretch the day before `on` and starts a stretch of `kind` on it, in one write.
- The reply names every stretch by its kind and days: `changes` and `standing` (the live stretches after the write, oldest first). It carries no clock and no id the run made, so a plan and its apply hash alike.
- A dry run performs the write and unwinds it.

**Access.** Devs select. No insert, update or delete policy exists and no such grant is made to `authenticated`; `anon` has nothing; `hr_agent` has no grant. The four fence calls end the migration.

**What it leaves alone.** `people.kind`, the roster's dates, `employment_stints`, `charge_standings()` and every screen. Nothing reads the table yet.

**The owner's call.** The list of kinds. This builds the two the card names and refuses any other; a third is one line in a later migration.

Held by `npm run test:pg:person-engagements` (`supabase/tests/person_engagements/`, in `scripts/sql-beds.txt`): 37 checks. Before the PR the scenario ran on a local Postgres 15 with stand-in tables and the migration applied twice; four mutants each failed it (a guard that allows an overlap, a door with no dev gate, a table left writable, a reply that carries an id the run made).

Deploy order: push this migration. No client reads the table and no function is redeployed.

**Applied** to prod by 2026-11-13: the dev seat's `check_migration_ledger` read 1274 applied, this version among them, against 1274 files in `supabase/migrations/` (read in the docs pass after #7659).
