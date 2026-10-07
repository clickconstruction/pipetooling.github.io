---
name: "GC mode, the schedule: the real build plan"
parent: to-dos/gc-mode/GANTT_PLAN.md (What the real build needs) and HANDOFF.md (The real build, in order, step 9)
rows: GANTT_FEATURES.md G-132 (real tables), G-133 (who may move a bar, under RLS) and G-134 (two people on one schedule), the three the Gantt leaves to this plan; and G-51 (our crew's percent and head count), the fourth row it marks for the real build
status: first draft 2026-10-06 by Helper 1 at the lead's ask, for the lead's review and then the owner's. Nothing touches the database until the owner approves a step.
summary: >
  How the schedule moves from the prototype (made-up data on branch spike/gc-mode, 90 of the Gantt's
  97 rows standing Have) into the real app: what moves and what stays, the decisions before the first
  migration, the tables with their columns, the kernels that move with their tests, the RPCs that
  make a press all or nothing, who may read and write by role, the rule for two people on one
  schedule, and the PRs in order with the docs each touches.
size: XL (23 tables, 19 database functions, 2 new edge functions and additions to the two portals', 16 PRs)
blocker: the owner's word on the decisions below. The schedule's own tables need only what main has. The
  trades' side waits on the company record and its portal (Board and Portal); a trade's percent on
  Building's draws; a change order's days on Owner Billing's change orders.
---

# GC mode, the schedule: the real build plan

## What moves, and what stays

The prototype proved these, and they move:

- **The schedule itself.** The first draft from the trades and their stages, from a template or from
  their file. Bars for a trade's lines, our crew's stages, inspections and the job's own work. What
  each waits on, with a gap. A day it cannot start before and a day it must finish by. The real
  days it ran. A line split into parts. Where the work is. The dates the job must meet.
- **The chart.** Every bar, the links, the chain that sets the finish, the holds, the filters, the
  list, the paper and the export. These are read, not stored.
- **Moving a bar.** Why it moved, in a reason and the person's own words. What it pushed, Undo and
  Redo, the history, a pull when work finishes early, days got back, and a part's own move.
- **Keeping it true.** Baselines, the weekly walk, and the look-ahead marks and their checks.
  Inspections and their failures. What the work waits on from outside the trades.
- **The trades' and the customer's side.** Tell the trades and their answers, a trade's late
  notice, a trade's own crew count, the trade's chart, and the customer's picture and its sends.
- **What if.** A copy to try moves on, kept or thrown away.
- **Before the job.** A rough schedule while we bid, and templates from earlier jobs.

These stay with the lanes that own them, and this plan only points at them:

- **The company record and its portal** (Board and Portal). The trade's side of the schedule rides
  in that portal.
- **Start** (Board). It sets the job building and does not touch the schedule (decision 7).
- **The statement of work, the draws and a trade's report** (Award and Building). A line's percent
  is the trade's report there.
- **The daily log and the Friday report** (Building). The log against the chart (G-60), days lost
  (G-58), the crews (G-57, G-84), the morning list (G-118) and the report's schedule section (G-93)
  read the schedule beside them.
- **Change orders and the contract's finish** (Owner Billing). A change order's days (G-76), the
  late-finish line (G-98) and *Ask for the days* (G-141) read them.

Nothing moves for **Start over** (G-40): it is the prototype's own reset of its made-up data.

A step below that needs one of them says so.

## Decisions before the first migration

Each has a default the plan is written to. The owner changes any of them by saying so.

1. **Where a schedule lives.** *Default:* one header row per GC project, `gc_schedules`, keyed by
   `project_id`. It holds the version (decision 5), the template the draft came from and who drew
   it. Everything else hangs off the project in its own table. A project with no row has no
   schedule drawn yet.
2. **What a bar is keyed to.** *Default:* a row in `gc_schedule_activities` with a `kind`:
   - `line` is a trade's line or our crew's stage, keyed to its scope line (`gc_scope_items.id`).
     A statement of work's lines keep their scope lines' ids (`sowFromBid`), so the schedule never
     waits for the statement of work to exist.
   - A line a signed change order adds to a statement of work is not a bar of its own. Its days
     land on the trade's bar (G-76), as in the prototype.
   - `inspection` and `added` have no scope line and no trade, as in the prototype.
   - A line's percent is not the schedule's to keep: it is the trade's report on Building's draws,
     or our crew's (G-51). A part's percent is the schedule's, on the part.
3. **Links are rows.** *Default:* `gc_schedule_links`, one row per wait, with its gap in days. An
   array on the activity would lose the gap (G-35) and the negative gap of work side by side
   (G-82). The `kind` column allows only *finish, then start*. G-35 also names *starts with it* and
   *finishes with it*, which the prototype never built, so a later kind is a new value, not a new
   table.
4. **Who may move a bar (G-133).** The owner, 2026-10-05 (`GANTT_PLAN.md`, call 2): "Anyone on our
   team may move a bar, when a bar is moved an explanation should be given and recorded with that
   saved somewhere." Call 9 gives a new baseline to anyone on our team, like a move. G-133 adds that
   the customer and the trades only read. *Default:*
   - **Our team** is dev, the leaders, the assistants, the controller and estimators
     (`is_office_or_estimator()`), plus the job's own superintendents and its project manager. They
     read and write alike, since the schedule carries no money.
   - **Subcontractors, helpers and primaries** have no policy, so they see nothing.
   - **The trades and the customer** are not app users. They read through their portals, never the
     tables.
   - **While it is built**, dev only, as New project was.
5. **Two people on one schedule (G-134).** *Default:*
   - The schedule carries a version number. It counts the plan: which bars there are, their planned
     dates, their waits and gaps, their limits, their parts' days and the baselines.
   - Every press that changes the plan sends the version it read. The second press to arrive is
     refused, and the refusal names what changed since, who changed it and when.
   - Nothing merges by itself. The person sees the new dates and presses again, with their reason
     and words kept.
   - Records never conflict, so they carry no version: a mark, a notice, a count, an answer, a
     wait, a place, a milestone, the real days, an inspection passed, a send.
   - The refusal keeps main's convention: `P0001`, with a plain-words message that starts with one
     fixed phrase, *The schedule changed while you were working.* Its DETAIL carries what changed,
     as JSON. The client reads it through `checkSupabaseError` and `formatErrorMessage`
     (`src/utils/errorHandling.ts`), like every other write.
6. **The what-if copy (G-81).** *Default:*
   - One copy per person per job, stored, so it lives across a reload and on a second device.
     Nobody else sees it. The prototype keeps one per job, shared. A shared copy is a later choice.
   - Keep sends the version it read, like any plan write.
   - The copy's own rule stays the kernel's. Keep is refused when the real schedule no longer has
     the copy's base (`whatIfBaseChanges`): a planned date or a wait changed, not a report, a real
     day or a place. A refusal for the version alone reloads, and a copy whose base still holds
     keeps on the next press.
   - A copy's places are the real schedule's, since a place is a fact about the work
     (`setActivityPlaces` sets both).
7. **The baseline at Start.** Start is the Board lane's press, and it does not touch the schedule.
   *Default:* as in the prototype, the first plan write after Start keeps the plan as it stood as
   the baseline (`withBaselineKept`). Until a change, the plan is the plan at Start. So the schedule
   needs nothing from Start but the job's stage, `gc_projects.stage`.
8. **Days, not times.** *Default:* every date is a `date`, both ends counted, and every day is a
   working day (the owner's call 1, 2026-10-05: "anyone can work 365 days a year"). The weekends
   and holidays the chart marks stay a list in the code (`holidaysOf`). A move also keeps a
   `timestamptz`, only to order moves and to name them in a refusal.
9. **Which writes are RPCs.** *Default:*
   - **Every plan write is an RPC** that checks and bumps the version (decision 5).
   - **A record that touches more than one row is an RPC** with no version. These are places on
     several bars, an inspection passed with its milestone, their dates to meet, and a wait with the
     bars it holds.
   - **Every other record is a plain insert or update** under RLS.
   - **A trade's write** goes through the company portal's submit function, one `kind` each, on the
     sub portal's pattern (`submit-sub-portal`).
10. **Where the portals' schedule is worked out.** The trade's chart (G-110) and the customer's
    picture (G-90 to G-93) must hold only their own slice. The customer's has no company, no dollars
    and no spare days. *Default:* in each portal's read function, with the service role, from the
    rows. The function runs the kernel (`portalSchedule`, `customerSchedulePicture`) and returns
    only its answer, so nothing more reaches their browser. The kernels are pure TypeScript, so the
    function imports them. No edge function on main imports from `src/lib` yet, so PR 14 proves the
    bundle first. Failing that, a copy goes in `supabase/functions/_shared/`, kept equal by a test.

## The tables

Every migration follows `CLAUDE.md`:

- It starts with `SET lock_timeout = '3s';`.
- It is numbered after `origin/main`'s newest when its PR is cut, and claimed then with
  `npm run claim -- --migration <file>`.
- It is written idempotent, and pushed with `supabase db push` only after it is on `main`.
- Every table has RLS, dev only while it is built: one policy a table, `FOR ALL TO authenticated
  USING ((SELECT public.is_dev())) WITH CHECK ((SELECT public.is_dev()))`, with `anon` revoked, as
  the newest on main do (`20261007110000_court_areas`). The wrap asks once a statement, not once a
  row. PR 10's team policies take the same form.
- Every migration that creates a table ends with `SELECT public.apply_read_only_write_blocks();`,
  `SELECT public.apply_read_only_stmt_blocks();` and `SELECT public.apply_digital_twin_write_blocks();`.

Each column names the prototype field it carries (`src/lib/gcMode/gcTypes.ts`).

### The schedule and its bars

**`gc_schedules`**, one row per GC project, keyed by `project_id` (FK `gc_projects.project_id`):

- `version` (integer, from 0, bumped by every plan write; decision 5).
- `drafted_on` (date, the company day the writer gives; no default, since the server's day is UTC)
  and `drafted_by` (FK `users.id`).
- `template_id` (FK `gc_schedule_templates.id`, set null; PR 4 adds the key, when that table
  exists), `template_name` and `template_used_on`: `ProjectSchedule.template`, the template's name
  as it read that day (G-44). A check keeps the name and the day together.
- `updated_at` and `updated_by`.
- Every table below with a `project_id` references this row's, so nothing exists without the
  header and its version.

**`gc_schedule_activities`**, one row per bar (`ScheduleActivity`):

- `id`, `project_id`, `kind` (`line`, `inspection`, `added`), `position`.
- `scope_item_id` (FK `gc_scope_items.id`, cascade; a `line` only) and `package_id` (FK
  `gc_trade_packages.id`, cascade; a `line` only). These are the prototype's `lineId` and
  `packageId`.
- `start` and `finish` (dates, both days counted).
- `not_before` and `must_finish_by` (dates, G-36).
- `actual_start` and `actual_finish` (dates, G-55).
- `place` (text, at most 40 characters, G-83). A guess is never stored.
- For an `inspection`: `label` (*Rough-in inspection*) and `passed_on` (date).
- For an `added` bar (G-38): `label`, `who` (*Our crew*, *The customer*) and `done_on` (date).
- `created_at`.
- Checks: a `line` has its scope line and trade, and the other two kinds a label and neither. An
  `added` bar says whose it is. Only an inspection has `passed_on`. `finish` is on or after
  `start`, and the real days are in order. A place is never blank.
- Unique (`project_id`, `scope_item_id`): one bar per line.
- Unique (`project_id`, `id`), so a link's two ends can be held to bars of one job.

**`gc_schedule_activity_parts`**, a line split into parts (`ActivityPart`, G-39):

- `id`, `activity_id` (cascade), `position`, `name`.
- `from_day` and `days` (integers, counted from the line's start, so every move of the line carries
  them).
- `share` (percent, set from the days at the split and kept; the shares add up to 100) and `pct`.
- `actual_start` and `actual_finish`.
- Unique (`activity_id`, lower(`name`)).
- Checks: `from_day` from 0 and `days` from 1, `share` and `pct` within 0 to 100, and the real days
  in order.

**`gc_schedule_links`**, what each bar waits on (`ScheduleActivity.after` and `.lag`):

- `id`, `project_id`, `from_activity_id` and `to_activity_id` (both cascade). Each end's key is
  (`project_id`, the bar), so both ends are bars of one job.
- `kind` (`finish_start` only, decision 3).
- `gap` (integer, days; below zero is side by side, G-82).
- Unique (`from_activity_id`, `to_activity_id`), and a check that the two ends differ.
- A wait that makes a loop is warned about before it saves, as in the prototype (`planMove`'s
  warnings, `wouldLoop`).

**`gc_schedule_milestones`**, the dates the job must meet (`ScheduleMilestone`):

- `id`, `project_id`, `label`, `planned` (date), `package_id` (null: the job's own; set null if the
  trade goes), `met_on` (date), `position`.
- Substantial completion's day under the contract is worked out, never stored: the milestone's
  planned day plus the signed change orders' days (`substantialCompletionOn`).

**`gc_schedule_inspection_failures`**, an inspection that did not pass (`InspectionFailure`):

- `id`, `activity_id` (an `inspection`; the writer sees to that), `failed_on`, `note` (never
  blank), `package_ids` (uuid[], the trades whose work failed), `reinspect_on` (after `failed_on`),
  as the prototype's reducer refuses.

### Baselines

**`gc_schedule_baselines`** (`ScheduleBaseline`, G-41):

- `id`, `project_id`, `name` (null reads *At Start*), `locked_on`, `locked_by` (FK `users.id`),
  `why`, and `created_at`, which orders two kept on one day.
- The newest is the plan the chart measures against. The ones it retired stay, named, oldest
  first, as `ProjectSchedule.baselines` keeps them.

**`gc_schedule_baseline_dates`**: `baseline_id` (cascade), `activity_id` (cascade), `start`,
`finish` (on or after `start`). Primary key (`baseline_id`, `activity_id`).

### Moves, and the records a move carries

**`gc_schedule_moves`** (`ScheduleMove`), append only. `authenticated` gets no DELETE on it, and
UPDATE on the undo pair only, which Undo sets and Redo clears.

- `id`, `project_id`, `activity_id` (the bar moved; set null if the bar is removed) and
  `activity_name` (its name that day, so the history still reads).
- `made_on` (date) and `made_at` (timestamptz, decision 8). `made_by` (FK `users.id`) and
  `made_by_name` (the name as it read that day).
- `from_start`, `from_finish`, `to_start`, `to_finish`.
- `reason` (text, one of the twelve in `ScheduleMoveReason`) and `note` (text, never empty; a check
  on `btrim(note) <> ''`).
- `links_changed` (boolean).
- `finish_from` and `finish_to`: the job's last finish before and after.
- `undone_on` and `undone_by` (G-40).
- `change_order_id`: the signed change order whose days it put on the chart (G-76). It gains its FK
  when Owner Billing's change orders are a table.
- `late_notice_id` (FK `gc_schedule_late_notices.id`): the trade's notice it took (G-117).
- `walk_id` (FK `gc_schedule_walks.id`): made during a walk (G-52).
- `pull_finished` (uuid[]): the lines that finished early (G-37).
- `recovery_how` (`side` or `crew`), `recovery_after_activity_id`, `recovery_gap_was`,
  `recovery_gap` (G-82).
- `from_what_if_on` (date): kept from a what-if copy made that day (G-81).
- `parts` (jsonb): a part's own move, the moved part and every part's days before and after, which
  Undo and Redo put back (G-39).
- `schedule_version`: the version this move made, so a refusal can name it (decision 5).
- `noWhy` is never on a real move. It lives only in a copy.

**`gc_schedule_move_pushes`**, what came after it and moved with it (`ScheduleMove.pushed`):
`move_id` (cascade), `activity_id`, `from_start`, `from_finish`, `to_start`, `to_finish`.

**The confirmations (G-132),** in two tables:

- **`gc_schedule_move_tells`**, which companies were told, and when (`toldOn`, `toldTo`):
  `move_id`, `partner_id` (the Board's company record), `told_on`, `shown` (jsonb: each of the
  company's bars the move changed, with the dates the message gave) and `email_send_log_id`. One row
  per move and company.
- **`gc_schedule_move_answers`**, each company's answer from its portal (`answers`): `move_id`,
  `partner_id`, `answered_on`, `ok` (boolean), `day` (date, another day asked for, G-113), `note`.
  Unique (`move_id`, `partner_id`): one answer per company, and only from a company told.
- A first day nobody confirmed (G-114) is the Board's promise of kind `start`, in its planned
  `gc_trade_promises`, as the prototype keeps it today.

**`gc_schedule_changes`**, one row per plan write, the words for decision 5:

- `project_id`, `version` (from 1), `made_at`, `made_by`.
- `words`: sent with the press, the line the prototype logs for it. For example: *Electrical ·
  Lighting now runs Mon Sep 14 to Fri Oct 30. Robert: The fixtures ship a week late.*
- Primary key (`project_id`, `version`). Append only: `authenticated` has no UPDATE, DELETE or
  TRUNCATE on it. Privileges hold it, not a missing policy, so PR 10's swap cannot open it. The plan
  writes are `SECURITY INVOKER`, as `gc_create_project` is, and still insert their lines.

### Keeping it true

**`gc_schedule_walks`**, one per weekly walk (`ScheduleWalk`, G-52):

- `id`, `project_id`, `walked_on`, `walked_by`.
- `kept` (uuid[], the bars looked at and left as drawn) and `skipped` (integer, the bars listed and
  not looked at).
- `kept_early` (uuid[], the early finishes answered with *Keep the dates*, G-37).
- Its moves point back at it through `gc_schedule_moves.walk_id`.

**`gc_schedule_lookahead_marks`**, a week's done or not done (`LookAheadMark`):

- `id`, `activity_id`, `week_of` (the Monday).
- `done`, `reason` (one of the five in `LookAheadReason`), `marked_on`.
- `marked_by_partner_id` for a trade's mark, from its portal, or `marked_by` (FK `users.id`) for our
  own crew's. Our crew's mark counts as checked at once (`crewMarkLookAhead`).
- `verified_on`, `verified_done`, `verified_reason`, `verified_by`. A trade cannot change its mark
  once our superintendent has checked it.
- Unique (`activity_id`, `week_of`).

**`gc_schedule_waits`**, what the work waits on from outside the trades (`ScheduleWait`, G-73 to
G-75):

- `id`, `project_id`, `kind` (`delivery`, `decision`, `permit`, `utility`), `title`, `package_id`
  (null: the job's own), `who`.
- `asked_on`, `expected_on`, `shipped_on` (a delivery only), `done_on`, `note`.
- **`gc_schedule_wait_holds`** (`wait_id`, `activity_id`, both cascade) is the bars it holds
  (`lineIds`).

**`gc_schedule_late_notices`**, a trade's word that it will be late (`LateNotice`, G-117):

- `id`, `project_id`, `partner_id`, `activity_id`.
- `sent_on` and `sent_by` (the company's contact, by name).
- `started` (boolean).
- `was_start`, `was_finish`, `to_start`, `to_finish`.
- `reason` (one of the five in `LookAheadReason`) and `note` (never empty).
- The office's push back: `pushed_back_on`, `pushed_back_by`, `pushed_back_note`.
- `kept_on`: after a push back, the company said it will make the day.
- Where a notice stands (open, taken, replaced, moved, pushed back, kept) is worked out each time
  (`lateNoticeState`), never stored.

**`gc_schedule_crew_counts`**, a trade's own word on its people a day (`CrewCount`, G-142):

- `id`, `project_id`, `package_id`, `partner_id`, `week_of`, `count` (integer, 0 or more),
  `said_on`.
- Append only. The newest for a trade and week is the one that counts (`crewCountsNow`).

**`gc_schedule_sends`**, the customer's schedule as sent on its own (`ScheduleSend`, G-94):

- `id`, `project_id`, `sent_on`, `sent_by`, `sent_to` (text, the customer's contact and company),
  `subject`.
- `lines` (text[], the letter as it went) and `email_send_log_id`.

### What if, and before the job

**`gc_schedule_what_ifs`**, one copy per person per job (`ScheduleWhatIf`, decision 6):

- `project_id` and `user_id`, the primary key together.
- `made_on` and `base_version` (the schedule's version when it was made, to name what changed
  since).
- `base` (jsonb, `WhatIfBase` by activity id) and `copy` (jsonb: the copy's bars, waits, parts and
  the moves tried in it, with `noWhy`).
- jsonb, because nothing outside the Schedule tab reads a copy, and it is never queried by line.

**`gc_rough_schedules`**, a rough schedule while we bid (`RoughSchedule`, G-45), keyed by
`project_id`:

- `start`, `stage_days` (jsonb, days by stage key), `drawn_by`, `drawn_on`.
- `kept_on`, `kept_weeks`, `kept_finish` and `kept_at` (`bid` or `award`).
- `template_id`, `template_name`, `template_used_on`.
- `like` (jsonb): the template's lines as they were copied, so no edit to the template reaches the
  rough.
- It is never the schedule itself.

**`gc_schedule_templates`**, company-wide with no project key, like the scope book
(`ScheduleTemplate`, G-44):

- `id`, `name`.
- `from_project_id` (FK `projects.id`, set null), `from_name`, `from_done_pct` (how much of that
  job was done when it was saved).
- `saved_on` and `saved_by`.
- `lines` (jsonb, `TemplateLine[]`: trade, label, stage, days, waits with gaps, offset, place,
  parts).
- `stages` (jsonb) and `weeks` (integer).
- `aside_on` (date): set aside, not offered for new jobs.
- jsonb, because a template is read whole. Its lines never change once saved, only its name and
  its day set aside.

## What the app already has, reused

- **The project, its trades and scope lines**: `gc_projects`, `gc_trade_packages` and
  `gc_scope_items`, on `main` since `20261006233000`. The bars key to them, and the job's stage is
  `gc_projects.stage`.
- **The page**: New project's dev-only page at `/gc` (its PR 4b,
  clickconstruction/pipetooling.github.io#4764, open tonight) gets the Schedule tab, and its io
  layer `src/lib/gc/gcIo.ts` is the pattern for the schedule's.
- **The team who may move a bar**: `users` and their roles, `is_office_or_estimator()`,
  `is_superintendent()`, `project_superintendents` (`project_id`, `superintendent_id`), and
  `gc_projects.project_manager_user_id`.
- **The portals**: `sub-portal` and `submit-sub-portal` are the pattern for the company portal's
  read and its writes. Both run with the service role and check the link, and RLS never applies
  (`docs/SUB_PORTAL_ARCHITECTURE.md`). The customer's picture goes in `customer-portal`, read
  through `customer_portal_links`.
- **Email**: `_shared/resendSendEmail.ts` (`sendEmailViaResend`, which logs to `email_send_log`),
  from `COMPANY_EMAIL_FROM` with the project manager as Reply-To, the way `send-bid-room-link` does.
- **Our crew (G-51)**: its Pipeline job in `jobs_ledger`, and its clock-ins in `clock_sessions`
  (`job_ledger_id`).
- **The read-only blocks, the twin fence, release notes, docs fragments, help guides and the
  plain-words test**: as for every feature.

## Kernels that move over with their tests

They are pure functions with tests today, in `src/lib/gcMode/`. They move to `src/lib/gc/schedule/`
unchanged, and the prototype imports them from there, so there is one copy. The tests that pass
today pass there unchanged. Putting the chart's math and the spare days and pushes in one folder is
what G-130 asks for.

- **The schedule and its measures**:
  - `gcBuildingSchedule` (31 tests): the items, plan to date, pushes, the projected finish, work
    against the plan, milestones, look-ahead reliability, the summary, the first draft.
  - `gcBaseline` (3), `gcActualDates` (3), `gcAddedActivity` (6).
- **The chart**: `gcGantt` (22: bars, groups, filters, the axis, links, spare days, rows in view),
  `gcChartHolds` (1), `gcNotReady` (16), `gcSplitBars` (19), `gcPlaces` (15).
- **Moving**:
  - `gcScheduleMoves` (14: `planMove`, `moveRecord`, Undo and Redo, `moveRows`, the reasons).
  - `gcPullEarlier` (30), `gcRecovery` (23), `gcChangeOrderDays` (7), `gcWhatIf` (15).
- **Keeping it true**: `gcScheduleWalk` (10), `gcStaleSchedules` (2), `gcScheduleWaits` (8),
  `gcLogVsChart` (9), `gcDaysLost` (5), `gcFinishOutlook` (12), `gcCrewCounts` (9),
  `gcPeopleOnSite` (7), `gcMorningList` (10).
- **The trades and the customer**:
  - `gcTellTrades` (5), `gcLateNotices` (29), `gcStartReminders` (8), `gcBuildingPromises` (8).
  - `gcCallList` (24), `gcCounts` (29), `gcPortalSchedule` (2).
  - `gcCustomerSchedule` (7), `gcCustomerScheduleSend` (2), `gcLateFinish` (12, for Owner Billing
    to read).
- **Before the job, and files**: `gcRoughSchedule` (8), `gcScheduleTemplates` (14),
  `gcScheduleImport` (17), `gcTheirDates` (10), `gcScheduleExport` (23), `gcGanttPrint` (23).

The kernels read the prototype's shapes, and they keep their arguments:

- **27 of the 39 take the whole state** (`GcState`) for today, the companies and the templates.
  `GcState` is small: today, customers, projects, companies, the log and four optional lists.
- **A mapper builds it from the rows**, `scheduleStateFromRows`. It takes the job from New
  project's mapper (`src/lib/gc/projectRows.ts`) and fills in its schedule fields (`schedule`,
  `rough`, `waits`, `scheduleSends`, `whatIf`, `crewCounts`). It adds the job's customer, its
  companies, the templates, today and an empty log. So no kernel changes when the data becomes
  real.
- **A kernel that reads across jobs** gets every GC project the person may see. The board row's
  counts (G-146) and a trade's bench read that way.
- **Two ids meet in it.** A line's `lineId` is its scope line's id. An inspection's or an added
  bar's is the activity's own id.
- **It gets its own test**, against a row set built from the fixture's Fair Oaks D. The mapped job
  must equal the fixture's.

## Writing it: the RPCs, so a press is all or nothing

The kernels stay in TypeScript. A press works its answer out in the screen, as the prototype does,
and sends the answer, not the question. Each RPC is `SECURITY INVOKER`, so RLS decides who may.

**A plan write** (decision 9):

- **Checks the schedule's version** and bumps it (decision 5).
- **Checks what the kernel checks before a save**: a reason and words (`moveWhyProblem`), a finish
  on or after the start, a part inside its line.
- **Keeps the baseline first** on a job being built that has none yet (decision 7).
- **Writes everything the press made** in one transaction, with one `gc_schedule_changes` row. It
  returns the new version.

| RPC | The prototype's action | What it writes |
|---|---|---|
| `gc_schedule_draft` | `draftSchedule`, `importSchedule` (G-137) | The header, the bars, waits, parts and milestones, from a template's lines or a file's rows. A redraw is refused once a bar has started, been walked or moved, as G-137's *instead* is |
| `gc_schedule_move` | `setScheduleActivity`, `moveActivityPart`; Take on a late notice (G-117); a change order's days (G-76) | The bar's dates, waits, gaps, limits or parts, and each pushed bar's dates. The move, with its pushes and its change order or late notice |
| `gc_schedule_undo`, `gc_schedule_redo` | `undoScheduleMove`, `redoScheduleMove` (G-40) | Every bar the move touched, back where the kernel says, and the undo pair set or cleared |
| `gc_schedule_pull` | `pullScheduleEarlier` (G-37) | The move, with its finished lines and what came in behind them |
| `gc_schedule_recover` | `recoverScheduleDays` (G-82) | The move, with its recovery and the changed gap |
| `gc_schedule_walk` | `recordScheduleWalk` (G-52) | The walk. Each of its moves, as `gc_schedule_move` writes one. The real days it recorded (G-55). What was kept, kept early and skipped |
| `gc_schedule_keep_what_if` | `keepWhatIf` (G-81) | Each standing move tried, oldest first, as a real move with its reason (the words sent for any tried without one) and `from_what_if_on`. Then the person's copy is deleted |
| `gc_schedule_baseline` | `setScheduleBaseline` (G-41) | A baseline and its dates. The one it retires stays, named |
| `gc_schedule_split`, `gc_schedule_join` | `splitActivity`, `joinActivity` (G-39) | The parts, or their removal. The line keeps its dates and percent |
| `gc_schedule_add_activity`, `gc_schedule_remove_activity` | `addScheduleActivity`, `removeScheduleActivity` (G-38) | An added bar with its waits and what waits on it, or its removal |
| `gc_schedule_fail_inspection` | `failInspection` | The failure. The inspection moves to its re-inspection day with its length kept, and what waits on it moves out |

**A record that touches several rows**, as an RPC with no version:

- `gc_schedule_set_places` (`setActivityPlaces`, G-83): each bar's place, set or cleared, refused
  whole when any of it is.
- `gc_schedule_pass_inspection` (`passInspection`): the inspection passed, and a milestone of the
  same name met that day.
- `gc_schedule_their_dates` (`takeTheirDates`, G-145): their dates to meet, set beside ours.
- `gc_schedule_wait` (`addScheduleWait`): the wait and the bars it holds.

**Plain writes under RLS**, one row each:

- the real days (`setActualDates`) and an added bar done (`setAddedActivityDone`)
- a milestone set or removed (`setScheduleMilestone`, `removeScheduleMilestone`)
- the superintendent's look-ahead check (`verifyLookAhead`) and our crew's mark (`crewMarkLookAhead`)
- a wait's steps and its removal (`setScheduleWaitStep`, `removeScheduleWait`)
- the office's push back on a late notice (`pushBackLateNotice`)
- a template saved, renamed or set aside
- the rough drawn or kept (`setRough`)
- the person's own what-if copy made, tried in or thrown away (`startWhatIf`, `inWhatIf`,
  `throwAwayWhatIf`)

**The trade's writes** go through the company portal's submit function, one `kind` each. The
function runs with the service role, checks the link, and checks what the reducer checks. None of
them touches the plan or its version.

- `answer_dates` (`tradeAnswerDates`): only a move the company was told, and once.
- `say_late` (`tradeSayLate`) and `keep_day` (`tradeKeepDay`).
- `crew_count` (`tradeSetCrewCount`): its own trade, a coming week (`crewCountAllowed`,
  `crewCountProblem`).
- `mark_lookahead` (`tradeMarkLookAhead`): its own line, and not once our superintendent checked
  it.

**The reads from outside** are worked out in the portals' read functions (decision 10):

- the company portal's read adds the trade's chart (G-110, `portalSchedule`)
- `customer-portal` adds the customer's picture (G-90 to G-93, `customerSchedulePicture`)

**Two edge functions send.** In each, the screen words the message with the kernel, so there is
one copy of the words, and the function checks who it goes to:

- **`gc-tell-trades`** (Tell the trades): each company's new dates (`datesMessage`, in the
  company's language). The function checks each company is on a move it names and that the move is
  not told yet. It sends through Resend, and records the tells, with the dates shown, as the caller.
- **`gc-schedule-send`** (G-94): the customer's letter (`customerScheduleLetter`), sent to their
  contact and kept as it went.

## Who may read and write (G-133)

The tables carry no money, so they can open wider than New project's (decision 2 there: dev, master
and controller, for the budgets and our number).

**While it is built:** dev only, every table, one policy each (`public.is_dev()`), as New project's
tables were. The page redirects anyone else.

**Then, in its own migration (PR 10):**

- **One helper**, `public.gc_on_schedule_team(p_project_id uuid)`, `STABLE SECURITY DEFINER`. It is
  true for:
  - `is_office_or_estimator()`: dev, the leaders, the assistants, the controller and estimators.
  - a superintendent on this job: `is_superintendent()` and a `project_superintendents` row with
    `superintendent_id = auth.uid()`. That is `can_access_project_row`'s own branch (assigned
    only, v2.2836). The helper does not call `can_access_project_row` itself, because it lets
    primaries in too.
  - the job's project manager: `gc_projects.project_manager_user_id = auth.uid()`.
- **Every schedule table** gets one policy for every verb, `USING (gc_on_schedule_team(project_id))
  WITH CHECK (gc_on_schedule_team(project_id))`. A child table checks through its parent's project.
- **Templates** have no project. They take anyone on the team of any GC project: the office and
  estimators, or a superintendent or project manager on one.
- **What-if copies** add `user_id = auth.uid()` to the team check.
- **Subcontractors, helpers and primaries** match no branch, so they see nothing. A primary can be
  added by saying so.
- **Training mode and twins**: the three block calls cover every table, so a `users.read_only`
  user reads and never writes, and a digital twin stays inside its own bids.
- **The trades and the customer** have no policy on any table. They reach their slice only through
  the portals' functions, which run with the service role and check the link.

`docs/ACCESS_CONTROL.md` gets the schedule's row when the tab opens (PR 7), and again when the team
policy lands (PR 10).

## Two people on one schedule (G-134)

The rule: **the second to save sees what the first changed, and nothing of theirs is lost.**

- **Why a version is enough.** A press works its answer out in the screen, from the schedule it
  read. That covers the move and its pushes, Undo's *while nothing it touched has moved since*, and
  Keep's base. The version guarantees that schedule is still the one in the database when the
  answer is written.
- **The version.** `gc_schedules.version` starts at 0. Every plan write bumps it by one in its own
  transaction, in one statement: `UPDATE public.gc_schedules SET version = version + 1, updated_at
  = now(), updated_by = auth.uid() WHERE project_id = p_project_id AND version = p_version
  RETURNING version`. The row stays locked until the transaction ends, so two writes never
  interleave.
- **The refusal.** No row back means someone saved first. The RPC raises `P0001`, as main's
  refusals do. Its message starts with the one phrase the client recognises, *The schedule changed
  while you were working.* Its DETAIL is JSON: every `gc_schedule_changes` row after the version the
  press read, oldest first, each with who, when and its words.
- **How the client reads it.** Through `checkSupabaseError` and `formatErrorMessage`, like every
  other write. The phrase says it is this refusal, and the window shows the rows from DETAIL.
- **What the person sees.** The window that was saving stays open and says it plainly:

  ```
  The schedule changed while you were working.
  · 2:14 pm  Electrical · Lighting now runs Mon Sep 14 to Fri Oct 30. Robert: The fixtures ship a week late.
  Your move was not saved. The chart shows the new dates now. Try it again on them.
  ```

  The schedule reloads behind it, and their reason and words stay in the window. If the move still
  makes sense on the new dates, the kernel works it out afresh, and one press saves it.
- **What never conflicts.** Records carry no version (decision 5). Two people can record at once,
  and a trade can answer while the office moves a bar.
- **A what-if copy** keeps its own rule at Keep (decision 6). A refusal for the version alone
  reloads. Keep is refused for good only when the copy's base no longer holds, and the words name
  the bars that moved (`whatIfBaseChangedWords`). Then the person makes a new copy.
- **Not in the first PRs: a live line.** A realtime subscription on `gc_schedules` could show
  *Robert just moved Lighting* before the second person presses Save. The refusal is the guarantee,
  and the live line is a later nicety.

## The PRs, in order

Each ships alone, behind the dev gate, with its release note, its docs fragment and, from the first
screen on, its help guide. *Check* is how the reviewer sees it work.

PRs 1 to 12 need only what `main` has, plus New project's page (PR 4b). PRs 13 and 14 need the
company record and its portal (Board and Portal). PR 16 joins each other lane as its table lands.

1. **Lift the schedule's kernels** into `src/lib/gc/schedule/` with their tests. The prototype
   imports them. No database, no screen change. 1a is the schedule, the chart and moving. 1b is the
   rest. *Check:* `npm test` passes, and `/bids/gc` behaves as before.
2. **Migration: the schedule and its bars**: `gc_schedules`, `gc_schedule_activities`,
   `gc_schedule_activity_parts`, `gc_schedule_links`, `gc_schedule_milestones`,
   `gc_schedule_inspection_failures`, `gc_schedule_baselines` with their dates, and
   `gc_schedule_changes`. Dev-only RLS, the three block calls, the regenerated types. *Check:* the
   migration doc's SQL shows each table empty with its policy, and a read-only user's insert is
   refused.
3. **Migration: moves and the records**: `gc_schedule_moves` with its pushes, tells and answers,
   `gc_schedule_walks`, `gc_schedule_lookahead_marks`, `gc_schedule_waits` with its holds,
   `gc_schedule_late_notices`, `gc_schedule_crew_counts`, `gc_schedule_sends`. *Check:* as PR 2,
   and a delete from `gc_schedule_moves` is refused.
4. **Migration: what if and before the job**: `gc_schedule_what_ifs`, `gc_rough_schedules`,
   `gc_schedule_templates`. *Check:* as PR 2.
5. **Migration: the RPCs** in the tables above, with their tests in SQL. Each plan write refuses a
   stale version, a move with no reason, and a finish before its start. *Check:* the migration doc
   runs two moves on one version, and the second is refused with the first's words.
6. **The mapper and the reads and writes**: `scheduleStateFromRows` with its test against Fair
   Oaks D, and the schedule's io beside `gcIo.ts`, every RPC behind one function the screen calls.
   *Check:* the mapper's test, and a schedule drawn through the RPC reads back equal.
7. **The Schedule tab on real data, read only**, on the dev-only page at `/gc`: the chart, the
   list, the paper, the export and the opened bar. *Check:* draw a real project's first draft; its
   bars, links and finish match the prototype's on the same trades.
8. **Moves on real data**: drag, pull an end, the editor, *Why it moved*, Undo and Redo, the
   history, a part's own move, and the version with its refusal (G-134). *Check:* two browsers move
   two bars. The second save is refused, naming the first's move, and saves on the next press.
9. **The rest of the plan's writes on real data**: the walk, pulls, days got back, baselines,
   splits, places, added bars, inspections, milestones and waits. The pulls and days got back come
   by way 3 (`mockups/schedule-pr1b.md`): `planPull`, `pullBehind` and `recoveryOffers` take the
   `GanttHold` list, and `chartHolds` and `pullHolds` become this PR's io, composing the holds on
   main by then (the schedule's own waits, late notices and asks; RFIs and submittals with U2; the
   not-ready papers with B2). *Check:* the prototype's walk on a real project, with one bar kept and
   one moved.
10. **Open the schedule to the team (G-133)**: the migration that swaps every dev-only policy for
    `gc_on_schedule_team`, and the tab's gate to match. *Check:* a superintendent on the job moves a
    bar, and one not on it sees nothing. A subcontractor sees nothing, and a read-only user's move
    is refused.
11. **The what-if copy on real data** (G-81), with Keep through `gc_schedule_keep_what_if`. Which
    actions a copy takes is decided here; the prototype's `WHAT_IF_ACTIONS` list is its reducer's and
    stays on the spike.
    *Check:* try two moves on a copy, keep them, and see both as real moves with their reasons.
12. **Before the job**: the rough while we bid (G-45), templates (G-44), import (G-137) and their
    dates to meet (G-145). *Check:* save Fair Oaks D's shape as a template and draw a new job from
    it.
13. **Tell the trades and their answers**: the edge function `gc-tell-trades`, and the portal's
    `answer_dates`. *Check:* a test company's inbox gets its new dates, in Spanish for a company
    that reads Spanish, and its *These dates work* reaches the move's row.
14. **The trade's side in its portal**: its chart (G-110), late notices (G-117), crew counts
    (G-142), look-ahead marks and the start reminders (G-114). Then the counts (G-146) read them.
    First, prove that the portal's function can import the kernels (decision 10). *Check:* a late
    notice from the portal reaches the office's card, and Take makes it a move.
15. **The customer's side**: their picture in `customer-portal` (G-90 to G-93), and the letter sent
    on its own through `gc-schedule-send` (G-94). *Check:* the customer's portal shows the finish
    and what changed, and never a company, a dollar or a spare day.
16. **The readers from other lanes**, each a small PR beside that lane's own table:
    - **Building's draws**: a trade's percent on its bar, and its report sets the real days in the
      same write (`withReportedActuals`). A part's report writes the part and its line's percent
      together (`tradeReportPart`).
    - **Building's daily log**: the log against the chart (G-60), days lost (G-58), the crew
      projection (G-57), people on site (G-84) and the morning list (G-118).
    - **Building's Friday report**: its schedule section (G-93).
    - **Our crew (G-51)**: its percent from its Pipeline job, and its head count from its
      clock-ins.
    - **Owner Billing's change orders**: a change order's days (G-76), the late-finish line (G-98)
      and *Ask for the days* (G-141). `gc_schedule_moves.change_order_id` gets its foreign key.
    - **New project's sets**: a set that pushes the schedule or brings new work (`issuePlanSet`'s
      `schedulePushes`) writes them inside the planned `gc_issue_plan_set`'s transaction (New
      project's PR 6), as `gc_schedule_move` does. New project's plan leaves this item until these
      tables exist.

    *Check:* each reads the prototype's numbers on the same made-up rows.

**Later, once the rest is in:** a shared what-if copy, a live line when someone else saves, and the
two other kinds of link G-35 names, if the owner wants them.

## Docs each PR touches

- **`docs/migrations/<version>_<slug>.md`**: PRs 2, 3, 4, 5 and 10.
- **`docs/EDGE_FUNCTIONS.md`** (a section and a TOC line): PR 13 (`gc-tell-trades` and the
  portal's new kind), PR 14 (the company portal's read and its kinds) and PR 15 (`customer-portal`
  and `gc-schedule-send`).
- **`docs/ACCESS_CONTROL.md`**: PR 7 (the dev gate) and PR 10 (the team).
- **`PROJECT_DOCUMENTATION.md`**: PR 7 (the Schedule tab), PR 11 (the what-if copy) and PR 14 (the
  trade's side). **`docs/twins/APP_DIRECTORY.md`** changes only if the schedule gets a page of its
  own. As a tab of `/gc` it does not.
- **`GLOSSARY.md`**: baseline, move, push, pull, days got back, walk, look-ahead mark, late notice,
  crew count, wait, part, place, what-if copy, rough schedule and schedule template.
- **Help guides**, each with its share card (`docs/HELP_SHARE_CARDS.md`) and the plain-words test:
  - *move a bar on the schedule and say why* (PR 8)
  - *walk the schedule each week* (PR 9)
  - *set a new baseline after a change order* (PR 9)
  - *split a line into parts* (PR 9)
  - *try moves on a copy first* (PR 11)
  - *start a schedule from a template* (PR 12)
  - *tell the trades their new dates* (PR 13)
- **Release notes and recent-features fragments**: every PR, one `v2.NNNN` each, claimed with
  `npm run claim`.

## Status

First draft 2026-10-06, written by Helper 1 at the lead's ask on `spike/schedule-plan`, from
`gcTypes.ts` as it stands on `spike/gc-mode` at 1e2d27249, and checked against `main` at 18c06f4d2.
Nothing is built. It waits on the lead's review, then the owner's word on the ten decisions.

Amended 2026-10-07, the day the build started: the kernels are on main, word for word, in three PRs
by Helper 1 (1a v2.4772 clickconstruction/pipetooling.github.io#4788, 1b-i v2.4777 #4792, 1b-ii
v2.4781 #4796), and the spike reads them from main through re-exports (the lift scripts are in
`to-dos/gc-mode/scripts/`). PR 2, the nine tables, merged as v2.4798 (#4814, migration
`20261007210000_gc_schedule_tables`), was applied to prod the same day and verified from the app:
every table empty, a dev's insert in and its `finish < start` refused, the changes table refusing a
dev's update and delete, anon refused (the doc's status has the words). The types are in #4826.
PR 3's plan (`mockups/schedule-pr3.md`) is approved and being cut.
