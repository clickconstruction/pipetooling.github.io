---
name: "My Schedule's Add job: the crew box the database ignores"
number: 196
group: ready
status: proposed 2026-10-27 from the live press run of #189 · waiting on the owner's pick, drop the box or honor it · the pick taken 2026-10-29 on the before-and-after canvas: A, drop the box
summary: >
  The add-a-job window on My Schedule asks "Add me to the job crew (keeps the job visible to you
  elsewhere)", ticked by default, and passes the answer to self_schedule_add_block, which adds the
  crew row only when the box is ticked. An AFTER INSERT trigger on job_schedule_blocks,
  ensure_job_team_member_from_schedule_block, adds every block's assignee to the job's crew anyway.
  So unticking the box changes nothing. The live run of 2026-10-27 found it: the box was unticked
  and the crew row appeared. Two ways out: drop the box and say the job joins your crew, or honor it.
next: One PR: the box goes, the window says the job joins your crew so it shows everywhere you look, the guide's step 3 is rewritten; then delete this file.
size: XS for A (the window and the guide) · S for B (one migration, an SQL bed, the window)
blocker: none
opinion: build — A was picked; the window says what the database does
mockup: not required — a checkbox kept or dropped on a window that exists
---

# My Schedule's Add job: the crew box the database ignores (#196)

## Found

On 2026-10-27 the live press run of punch list #189 added the ZZ test job to the dev's schedule
with **Add me to the job crew** unticked. A crew row for the dev appeared anyway, stamped the
second the window saved. The run removed the crew row after.

## Today

- **The window**, `src/components/dashboard/DashboardAddJobToMyScheduleModal.tsx`, keeps
  `joinCrew` (ticked at the start) and passes it through `selfScheduleAddBlock`
  (`src/lib/selfScheduleJobs.ts`) as `p_join_crew`.
- **The RPC** `self_schedule_add_block`
  (`supabase/migrations/20260811140701_self_schedule_and_field_job_request.sql`) inserts into
  `jobs_ledger_team_members` only `IF p_join_crew`.
- **The trigger** `job_schedule_blocks_ensure_job_team_member_tr`, AFTER INSERT on
  `job_schedule_blocks`, runs `ensure_job_team_member_from_schedule_block()`
  (`supabase/migrations/20250101000000_baseline.sql`). It inserts every new block's assignee into
  the crew, `ON CONFLICT DO NOTHING`. It runs for every path that adds a block, the office's
  schedule and dispatch included. So the box never decides anything.
- **The guide** `src/content/help/add-a-job-to-my-schedule.md`, step 3, tells a tech to leave the
  box checked, because that keeps the job visible everywhere else.

## Options

### A · Drop the box

The window says the job joins your crew, so you see it everywhere, and the box goes. The guide's
step 3 is rewritten. The RPC's `p_join_crew` stays, unused, or is dropped in a later migration.

### B · Honor the box

The trigger skips a block whose RPC said no. Two ways to carry the answer: a column on the block
(`join_crew boolean NOT NULL DEFAULT true`) that the RPC sets and the trigger reads, or a
transaction-local setting the RPC sets and the trigger reads. One migration, an SQL bed that
unticks the box and finds no crew row, the window unchanged.

The question that picks between them: does crew membership drive anything a tech would want to
stay out of, such as pay, labor splits or who gets the job's notices? If nothing does, A is the
honest window. If something does, B.

## Where it plugs in

| Piece | File |
|---|---|
| The window | `src/components/dashboard/DashboardAddJobToMyScheduleModal.tsx` |
| The client call | `src/lib/selfScheduleJobs.ts` → `selfScheduleAddBlock` |
| The RPC | `self_schedule_add_block`, `supabase/migrations/20260811140701_self_schedule_and_field_job_request.sql` |
| The trigger | `ensure_job_team_member_from_schedule_block()`, `supabase/migrations/20250101000000_baseline.sql` |
| The guide | `src/content/help/add-a-job-to-my-schedule.md` |

Under B, the migration follows CLAUDE.md: `SET lock_timeout = '3s';`, idempotent, claimed with
`npm run claim -- --migration`, pushed with `supabase db push` only after it is on `main`.

## How to verify

On a ZZ test job, add the job to My Schedule, under B with the box unticked. Read the job's
`jobs_ledger_team_members`. Under A a crew row appears, as the window now says. Under B none
appears. Remove the block and any crew row after. Every schedule path that added a crew row before
still adds one: a dispatch-set block and the office's schedule.
