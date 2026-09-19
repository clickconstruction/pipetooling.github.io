---
name: "Who's where: the org chart as a timeline"
group: ready
status: designed 2026-09-18 · mock-up drawn (`mockup.html`) · not started
summary: >
  **A People tab that shows who was on which job at any moment, as floating heads on job islands,
  with a date to flip and a time of day to scrub.** Nothing is typed: it is `clock_sessions`
  (who clocked in where, when) laid over `job_schedule_blocks` (who was listed where), drawn for
  one moment and playable across the day. It is the org chart for a company where most roles are
  hourly and per job — the chart is whoever is standing on the job together — and it is how the
  office will *see* the crews before anyone is asked to define a team lead. One optional tap per
  crew (*Mike leads this crew*) writes the Team leads link from what the page already shows,
  instead of a modal nobody opens.
next: >
  PR 1 — the moment view: the date strip, the time scrubber, the job islands with heads (solid =
  clocked in, hollow = listed but not clocked), the rail for clocked-in-no-job and not-in-today;
  read-only; kernel `whosWhere.ts` (sessions + blocks → islands at an instant) with tests.
size: M · S · S
blocker: None. Reads two tables the Hours tab and the crew deck already read; no migration until PR 3's confirm tap, which writes an existing table.
opinion: build — the two tables already hold every fact on the page; the to-do it unblocks (the helper try-out loop) has nowhere to hang its who-with without it.
---

# Who's where: the org chart as a timeline

Status: **designed 2026-09-18** · mock-up in `mockup.html` beside this file · no code yet ·
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

Todd, 2026-09-18, after the helper try-out loop mock-up needed a *who with?* picker and the Team
leads modal turned out to be a standing, hours-approval structure with archived leaders still in
it.

## The decision

**The page is a projection, not a record.** Every head and every island comes from two tables
the app already fills: `clock_sessions` (user, job, `clocked_in_at`, `clocked_out_at`,
`work_date`; pending sessions count, as the crew deck decided) and `job_schedule_blocks`
(`assignee_user_id`, `job_id`, `work_date`, `time_start`, `time_end`). Nobody maintains it.

**Two controls, one picture.**

- **The date** — ◀ ▶ around a day, with a seven-day strip under it showing each day's head count,
  so a quiet Friday or a heavy Tuesday reads at a glance. Flipping the date repaints the page.
- **The time of day** — a scrubber from the first clock-in to the last clock-out (5 am to 7 pm
  by default), with a playhead and ▶ **Play** that walks the day at a minute a frame. The picture
  is *the moment under the playhead*.

**The picture: job islands with heads.** One island per job that has anyone clocked in or
listed at that moment: the HCP number, the job name or customer, the address. On it, one head per
person — an initials disc, as People → Users draws them — with a **ring by role** (master · sub ·
helper · office) and a dashed amber ring for a **trial helper**. **Solid** = clocked in at that
moment (the clock-in time under the head); **hollow** = listed on the schedule for the job at that
time but not clocked in (their block's hours under the head). A head that has been on the island
longest sits first. Hover or tap a head: name, role, in and out times, listed hours, and *with
Mike 4 days this week*.

**The rail.** Beside the islands: **Clocked in, no job** (a session with no `job_ledger_id`,
or the office job), and **Not in today** (everyone on the roster with no session and no block —
faded, small). Nothing is hidden; the office sees the whole roster placed.

**The day as lanes** (PR 2). Under the islands, one row per job, time on the x axis: each person
a bar from clock-in to clock-out with their head at the left end, a listed-but-not-clocked block a
hollow dashed bar. The playhead is a vertical line across every lane; dragging it is the same
scrubber. This is where "he was listed at Oak St but clocked in at Lamar" becomes visible.

**What it teaches, and the one tap** (PR 3). A small panel beside the day: **Who works with
whom this week** — for each master or sub, the people who shared their islands and for how many
days (*Mike: Bryan 4 · Sam 3 · Devon 1*). That list *is* the org chart. On each island the page
infers a **crew lead** (the master or sub present; else the longest-tenured person) and draws a
small crown; the office can confirm with one tap — *Mike leads this crew* — which writes the
`team_leader_assignments` rows for the heads on the island. That is the only button on the page,
it is optional, and it replaces opening the Team leads modal and building cards by hand.
Un-confirmed crowns are a hint, nothing more.

**What it does not do.** No editing of sessions or blocks (the Hours tab and Dispatch own those).
No map — the sessions carry lat/lng, and a map is a later view over the same kernel. No pay or
wage data on the page, so it can sit at the assistant's access level (`clock_sessions` SELECT is
already wider than wages).

## The mock-up

`mockup.html` — the page at 10:40 am on a Tuesday (islands, heads, the rail, both controls);
the same day as lanes with the playhead; the *who works with whom* panel with a crown confirmed;
the phone layout.

## Where it plugs in

Exists today:

- `clock_sessions` (columns above; RLS: own rows, dev / master / assistant-like / controller for
  the roster — the Hours tab reads them for assistants inside a rolling window,
  `app_settings.assistant_hours_window_weeks_v1`); `job_schedule_blocks`; `jobs_ledger`
  (`hcp_number`, `job_name`, `customer_name`, `job_address`).
- `DashboardTeamActiveClockStrip.tsx` — already reads both tables for "who is clocked in now";
  `crew_review_teammates()` — the who-shared-a-job join the crew deck uses (the pairing panel's
  query is this, widened to a week and grouped by leader).
- The initials disc with a status ring — `UsersTabPhoneRow.tsx` (`avatar` style); no photo
  column exists, so heads are initials.
- People → Users → the **Team leads** modal (`TeamLeadsModal` / `TeamLeadsManager`,
  `team_leader_assignments`, `useTeamLeaderAssignments`) — what the confirm tap writes.
- `app_today()` / the app's timezone helpers for the day boundary; the office job id in
  `app_settings` (People → Overhead) for the "no job" bucket.

New:

- `src/lib/people/whosWhere.ts` — the kernel: `(sessions, blocks, roster, instant) → { islands:
  [{ job, heads: [{ person, state: 'in' | 'listed', since }] }], noJob, notIn }` and
  `dayLanes(sessions, blocks) → rows`; `pairings(sessions, week) → per leader`; tests.
- `src/components/people/PeopleWhosWhereTab.tsx` + `WhosWhereIsland.tsx` + `WhosWhereLanes.tsx`
  + `WhosWhereScrubber.tsx`; the tab key `?tab=whos-where` on People; a Dashboard link from the
  active clock strip ("see the day").
- PR 3 only: the crown inference in the kernel; the confirm tap calls the existing assignment
  writer; `ACCESS_CONTROL.md` (the tab's roles), `GLOSSARY.md` (*island*, *crown*),
  `PROJECT_DOCUMENTATION.md` (the new tab), guide `see-who-was-on-which-job.md` (Office).

## The plan

1. **The moment** (M). Kernel + tests; the tab; date strip; scrubber; islands and heads; the rail.
   Read-only. Verify on the dev server against prod data: pick yesterday, scrub to 10 am, compare
   the islands with the Hours tab's sessions for that day; a listed-not-clocked head matches a
   Dispatch block with no session.
2. **The lanes and Play** (S). Lanes under the islands, the shared playhead, ▶ Play.
3. **Who works with whom, and the crown** (S). The pairing panel; the inferred crew lead; the
   confirm tap writing `team_leader_assignments`; docs and guide. Verify: confirm a crown → the
   Team leads modal shows the card; the helper try-out loop's *who with?* can then default to it.

## How to verify

Prod data is enough — no seeding. Yesterday's islands against the Hours tab; today's against the
Dashboard's active clock strip at the same minute.

## Where it stands

Designed and drawn 2026-09-18. Nothing built. The helper try-out loop is gated on PR 3 of this
(the crews have to be visible before anyone is asked *who with?*).
