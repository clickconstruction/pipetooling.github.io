---
name: "Who's where: the org chart as a timeline"
group: ready
status: designed 2026-09-18 · second pass the same day (week-first, by crew, no writes) · mock-up drawn (`mockup.html`) · not started
summary: >
  **A People tab that shows the crews as they actually were — heads clustered by who worked
  together, drawn from clock sessions and Dispatch's linked schedule blocks, for a week at a
  glance and for any moment of any day on a scrubber.** Nothing is typed and nothing is written:
  it is the org chart for a company where most roles are hourly and per job — the chart is
  whoever stood on the job together — and the crew's lead is *read off the picture* (the master
  or sub on the crew), never maintained in a list. The week is the front door; a day's job
  islands with floating heads and a time-of-day scrubber are the drill-down; the lanes under
  them show where Dispatch's plan and the clock disagreed.
next: >
  PR 1 — the kernel (`whosWhere.ts`: sessions + blocks → crews for a week, islands at an
  instant, lanes for a day; the derived lead per crew-day) with tests, and the day view (islands
  + scrubber + lanes) — the ask as worded. PR 2 — the week view by crew (the front door) and the
  agree / disagree marks. PR 3 — Play, the map mode over the same kernel if wanted.
size: M · M · S
blocker: >
  None to build. One thing to confirm on prod before PR 2 is trusted: masters do not clock, so
  a crew's lead is visible only if Dispatch lists the master on the crew's linked block. If masters
  are not routinely on blocks today, listing them is the one habit this needs (and it makes the
  schedule show the whole crew).
opinion: build — every fact on the page is already in two tables, it writes nothing, and it replaces "define team leads" with "look".
---

# Who's where: the org chart as a timeline

Status: **designed 2026-09-18, redrawn the same day** · mock-up in `mockup.html` · no code yet ·
gates `../helper-tryout-loop/`

## The ask, in the owner's words

> "For me to really define team leads, I think I first need to make an org chart, but not in the
> traditional sense, since many roles are hourly and per job. I was thinking in People we add a
> tab that allows office staff to see a timeline of who is on what job in the form of floating
> heads … where a user can flip through the time both of day and of date as to who was on jobs
> and see visually floating heads of members who were clocked in and the jobs they were listed
> at."

> "Right now [team leads] have low use in the app and I want to not have to excessively burden
> anyone with extra buttons and features that take away from directly creating business value."

Todd, 2026-09-18. The first drawing put a crown-confirm button on the page that wrote the Team
leads link; the second pass ("is this the best we can do?") removed it — see *The decision*.

## The decision

**A projection, never a record.** Two tables the app already fills:

- `clock_sessions` — user, `job_ledger_id`, `clocked_in_at`, `clocked_out_at`, `work_date`
  (pending sessions count, as the crew deck decided). *What happened.*
- `job_schedule_blocks` — `assignee_user_id`, `job_id`, `work_date`, `time_start`, `time_end`,
  and **`shared_block_group_id`**: rows sharing a group id are one **linked crew block** —
  Dispatch's own statement that these people are a crew today. *What was meant to happen.*

Nobody maintains the page, and **the page writes nothing**. The Team leads modal stays what it
is (hours approval on a leader's Dashboard) and is not touched.

**The week is the front door.** People → Who's where opens on this week: a strip of days with
head counts, and under it the **crews** — clusters of heads that were together, sized by days
together. Each crew shows its heads (initials discs with a ring by role; a dashed amber ring for a
trial helper), the jobs it touched (*Oak St ×3 · Elm Ct ×2*), and a **derived lead**: the master
or sub on the crew, with a faint crown. Flip weeks with ◀ ▶. A **rail** holds *Office* and
*Alone this week* (people with no crew), and a count for *Not in* that expands.

**A crew is where two signals agree.** Dispatch's linked block says who was meant to be
together; the sessions say who was. Where both say the same, that is the crew and it reads
plainly. Where they disagree, the page marks it, because that is the useful fact: *Devon —
listed 3 days, clocked 1* · *Austin — clocked at Elm Ct, listed at Willow Creek*. The pairing
strength counts clocked days; listed-only days show as a hollow tick.

**A day is the drill-down.** Tap a day: the **job islands** — one per job with anyone clocked in
or listed at the moment under the scrubber — with **floating heads**: solid = clocked in at that
moment (the clock-in time underneath), hollow = listed for that job and time but not clocked in.
The scrubber runs first clock-in to last clock-out; ▶ Play walks it. Under the islands, the
**lanes**: one row per job, time across, each person a bar from in to out with their head at the
left, listed-not-clocked a hollow dashed bar, the playhead across every lane. This is the ask as
worded, kept whole; it is the second screen, not the first.

**The lead is read, not set.** For any crew on any day the lead is the master or sub in its
linked block (or on its island when no block exists), else nobody — the page says *no lead
listed* rather than guessing. Nothing persists. The helper try-out loop reads the same rule to
know whom to ask about a trial helper. If a crew genuinely needs a named lead the schedule cannot
show, the Team leads modal still exists for that one case.

**Masters must be listed.** They do not clock, so on a day they are always hollow heads and on a
week they appear only through their blocks. That is fine — and it is the one requirement: the
master goes on the crew's linked block. See the blocker.

**Not on the page.** No editing of sessions or blocks (Hours and Dispatch own those). No wages —
the tab sits at the assistant's level; `clock_sessions` SELECT is already wider than wages, and
the Hours tab's assistant window (`assistant_hours_window_weeks_v1`) applies to the date range.
No map yet — sessions carry lat / lng, and a map mode over the same kernel is PR 3 if wanted.

## The mock-up

`mockup.html` — the week by crew (the front door); a day at 10:40 with islands, heads and the
scrubber; the lanes with the playhead; the agree / disagree marks; the phone; a reads table with
an empty writes column.

## Where it plugs in

Exists today:

- `clock_sessions`, `job_schedule_blocks` (`shared_block_group_id`, GLOSSARY *linked block*),
  `jobs_ledger` (`hcp_number`, `job_name`, `customer_name`, `job_address`).
- `DashboardTeamActiveClockStrip.tsx` — reads both tables for "who is clocked in now" (the day
  view at *now* must agree with it); `crew_review_teammates()` — the shared-job join the crew
  deck uses (the week's pairing counts are this join over seven days).
- `ScheduleDispatchHub.tsx` — per-person lanes with `roleByUserId`; `scheduleDispatchAddBlockSave.ts`
  — how linked blocks are made (*+ → Linked copy*).
- The initials disc with a ring — `UsersTabPhoneRow.tsx`; no photo column exists.
- `app_today()` and the app's Central wall-clock helpers; the office job id in `app_settings`.

New:

- `src/lib/people/whosWhere.ts` — pure: `weekCrews(sessions, blocks, roster, week)` → crews
  (heads, days together, jobs, lead, agree / disagree marks); `islandsAt(sessions, blocks,
  roster, instant)`; `dayLanes(sessions, blocks)`; `derivedLead(crew)`. Tests for each, including
  a listed-only master, a helper who clocked on a different job than listed, a session with no
  job, and a crew with no master or sub.
- `PeopleWhosWhereTab.tsx` (`?tab=whos-where`), `WhosWhereWeek.tsx`, `WhosWhereIslands.tsx`,
  `WhosWhereLanes.tsx`, `WhosWhereScrubber.tsx`; a "see the day" link from the Dashboard clock
  strip.
- Docs: `ACCESS_CONTROL.md` (the tab, assistant-level), `GLOSSARY.md` (*crew* as read here,
  *derived lead*, *island*), `PROJECT_DOCUMENTATION.md`, guide `see-who-was-on-which-job.md`
  (Office). No migration.

## The plan

1. **Kernel + the day** (M). The four kernel functions with tests; the tab opening on today's
   day view (islands, scrubber, lanes; ◀ ▶ days). Verify against prod: yesterday's islands
   against the Hours tab's sessions; today's at *now* against the Dashboard clock strip; a hollow
   head matches a Dispatch block with no session.
2. **The week by crew** (M). The front door; the week strip; crews with days-together, jobs,
   derived lead; the agree / disagree marks; the rail. Verify: a week's crews against the
   Schedule dispatch grid's linked blocks; a known crew (a master and their regular helpers) reads
   as one cluster.
3. **Play and the map** (S, optional). ▶ over the day; a map mode placing the same heads at
   their session lat / lng.

## How to verify

Prod data is enough — no seeding. The blocker's check: open a week and count crews with *no lead
listed*; if most crews read that way, masters are not on blocks and Dispatch's habit is the fix,
not the page.

## Where it stands

Designed 2026-09-18, redrawn the same day: week-first, crews not jobs, nothing written, the lead
derived. Nothing built. `../helper-tryout-loop/` is gated on PR 2 (it asks the derived lead).
