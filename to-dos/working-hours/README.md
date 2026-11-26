---
name: "Working hours: a start and an end for each day, set for a person"
number: 429
group: close
status: asked 2026-11-23 · a plan and a mock-up, then a second pass · the owner's go the same day, *build it all*, with every pick kept · built and live the same day: the database door, the kernel and Utilization, the Working hours row with its lock and the line on My Time, the clock with the usual day's lock, and the dev seat · the live test run on 2026-11-24 by an outside session, clean, with three steps not walked and one fault found · step 2.5 walked clean at 380 px on 2026-11-25 · left: that fault, two steps, then the helper's hours set on his sheet · the fault's call answered 2026-11-25 (UTC) in the managing session: taking working hours off clears the week's hours too · asked again the same day what that leaves: the standard week, not zero paid hours · the mend built the same day as v2.8607, merged, and its migration pushed at 23:45 UTC · left: the take-off's walk, the dev seat's planner, two steps, then the helper's hours · 2026-11-26 (UTC): the person said build the planner now; built as v2.8618 (dev seat 0.136.0), its PR open with HOLD and unarmed, its `dev-mcp` deploy asked for by name and waiting on a yes
summary: >
  A new helper works 6:00 AM to 12:00 PM on five days, 30 hours. The app should let a dev or the
  controller set those hours for a person, in 15-minute blocks. Today three things describe a
  person's week and none of them is that. The plan makes one of them the truth: a week with a start
  and an end for each day. Pay hours and the clock's own sessions are worked out from it. Built and
  live on 2026-11-23, in five PRs.
next: Walk the take-off on a ZZ Test person, step 6 of [`LIVE_TEST.md`](LIVE_TEST.md): v2.8607 is live and its migration is applied. The dev seat's `plan_pay_setup` planned a take-off as moving no pay; its planner has the door's rule in v2.8618 (dev seat 0.136.0), whose PR is open with HOLD, and the seat says it once `dev-mcp` is deployed on its yes. Walk the two steps the live test left: the second half of 4.3, which needs a way to the window as anyone but a dev, and 4.4. Both are in `LIVE_TEST.md` under Runs. Then a dev or the controller sets the helper's hours on his sheet, and the card closes.
size: L as a train of five (S · S · M · M · S), built as five, with the clock and the usual day's lock in one PR and the dev seat as the fifth
blocker: A walker for step 6 of the live test, and a yes for the `dev-mcp` deploy that carries the planner (v2.8618).
ver: v2.8345 · v2.8350 · v2.8353 · v2.8356 · v2.8357 · v2.8358 · v2.8607 · v2.8618
opinion: close — built and live; an outside session's test and the helper's own hours are left
---

# Working hours

## Where it stands

**Built and live, 2026-11-23.** Every PR merged that day, all four migrations are applied (`npm run
check:migration-drift` reads fully applied), and `dev-mcp` 0.129.0 is deployed.

- **v2.8345, the database door** (#9461). `kind` on `person_available_hours`, `set_working_hours`,
  `working_hours_on` and `working_week_ok`. Migration `20261123075925`.
- **v2.8350, the kernel and Utilization** (#9465). `workingHours.ts`, and Utilization reads a set week
  over any answer.
- **v2.8353, the Working hours row, its lock and the line on My Time** (#9477). Migration
  `20261123082812`: the seven numbers on pay are a dev's or the controller's, and an answer is closed
  while working hours are in force.
- **v2.8356 and v2.8357, the clock and the usual day's lock** (#9492). Migrations `20261123083429` and
  `20261123093000`.
- **v2.8358, the dev seat** (#9493). `plan_pay_setup` takes `working_hours`, through the same door.
- The types after the pushes are #9499.

**What differs from the plan.**

- **The clock and the usual day's lock went as one PR**, as this card first drew PR 4. The build had
  split them, and they went back together to save a round in the merge queue.
- **The Workday… presses stay for everyone.** The card drew them hidden from anyone but a dev or the
  controller. They also open the custom schedule for one date, which pay staff use, so the window holds
  the rule: the usual day's fields are off for anyone else.
- **Hire saves no workday for anyone else.** An owner's salaried hire gets no workday row, and the form
  says a dev or the controller sets their hours. Until then the person clocks in and out.
- **The dev seat is 0.129.0**, after #9438's 0.128.0, which merged first.

**The live test.** [`LIVE_TEST.md`](LIVE_TEST.md) is a run sheet for a session that did not build this.
It checks the seat, the office's row, the person's My Time line, and, on the user's word, the salaried
path and the next day's clock.

**The fault the live test found, and its two answers.** Taking working hours off a salaried person left
the week's hours on their pay row as last set. Asked on 2026-11-25 what the take-off should leave, the
owner answered *"Clear the week's hours too"*. Asked the same day in a second round, *"Do all the picks on round 2, rows 1 to 22, stand?"*,
the answer was "Yes, all picks", quoted from the managing session's record of the user's answers. The
row read: *#429: clearing a salaried person's working hours leaves the standard week, not zero paid
hours*, and the pick was *The standard week*. Side by side: the week's own hours are cleared, and the
person falls to the standard week, 8 hours Monday to Friday, which every reader already takes for a
week with no numbers. Both answers are history: the migration's push is asked by name at the time.

**The mend, v2.8607, built 2026-11-25 and live the same day** (#9880). Migration
`20261125225108_working_hours_take_off.sql` replaces `set_working_hours`. Asked *Arm #9880 and push migration
20261125225108 after it merges?*, the owner answered *"Yes, arm and push"*. The PR merged at 23:31 UTC, its
client deploy ended at 23:45 UTC, and the migration was pushed after it, by the managing session on the
owner's word. The ledger reads it applied, and the function on prod holds the new rule, read back the same hour.

- Taking working hours off a salaried person writes the standard week on their pay row, `{0,8,8,8,8,8,0}`,
  the column's own default. It is never the hours last set and never zero paid hours.
- It is a change to pay like any other. It starts this week, it asks for a reason, and it leaves one line on
  the pay log with the week before and after.
- **Take working hours off** on the sheet says what the week on pay is today and that it goes back to the
  standard week. Its press is dead until the reason is typed.
- A person already on the standard week, and a person paid by the hour, have no pay side to a take-off.
- A take-off with no set week in force moves no pay. A week typed on pay for a person nobody set hours for
  stands, the helper's among them until his hours are set.
- No row on prod was in the fault's state on 2026-11-25, read through the dev seat: no salaried person had
  a set row. So nothing was corrected.
- Left: the walk. The dev seat's planner, which planned a take-off as moving no pay, has the door's rule in v2.8618 (dev seat 0.136.0): its PR is open with HOLD, and its `dev-mcp` deploy is asked for by name on its own yes.

The mock-up is [`mockup.html`](mockup.html). It draws the desk and the phone, in light and in dark,
and its first panel is the row itself, live. Every name and every figure on it is made up. No wage
or pay is drawn, since pay is owner-only.

## The ask

Asked 2026-11-23. A first-time helper wants to work 6:00 AM to 12:00 PM, five days a week, 30 hours.
The app should let us set specific hours for a person. The asker's three calls so far:

- hours are counted in 15-minute blocks;
- only a dev or the controller sets them, for now;
- a plan and a mock-up come before any build.

## What the app holds today

Three things describe a person's week. They are written by different people and read by different
screens, and nothing holds them to each other.

| | The set week on pay | The workday schedule | Hours you can work |
|---|---|---|---|
| Where | `people_pay_config.salaried_week_hours` | `salary_work_schedule_templates`, `salary_work_schedule_day_overrides` | `person_available_hours` |
| Shape | Seven hour numbers, Sunday first, in quarter hours | One start, one 480-minute block or two that add to 480, weekdays or every day | Seven days, each a list of start and end minutes, from a Sunday on, append-only |
| For | A salaried person | A salaried person | Anyone |
| Has a start and an end | No | A start, and a fixed 8 hours | Yes |
| Dated | No | No | Yes, `effective_from` |
| Who writes | A dev, the controller, a pay-approved owner | The person, a dev, an assistant, the controller, a pay-approved owner | The person, a dev, an assistant, the controller, a pay-approved owner |

### Who reads the set week

- **Payroll and the pay report.** `src/lib/salariedPayrollDays.ts` reads the week onto each payroll
  window. Its readers are `src/lib/pay/generatePayStub.ts`, `src/lib/pay/payrollPreviewPricing.ts`,
  `src/lib/draftPayrollPersonBreakdown.ts`, `src/lib/unreportedPayrollWeeks.ts` and
  `src/hooks/usePayrollCatchUp.ts`. The rule itself is `salariedWeekOf` in
  `src/lib/salariedEffectiveHours.ts`.
- **Cost hours on jobs, in the database.** `salaried_hours_on(week, day)` inside
  `get_man_hours_by_job`, `keep_job_baseline`, `list_project_board`, `superintendent_scores` and
  `get_weekly_money_movement_payload` (migration `20261118190000`). `list_people_pay_flags` returns
  the week.
- **Cost hours on jobs, in the app.** `src/utils/teamLabor.ts`, `src/lib/developments/siteLabor.ts`,
  `src/lib/teamBoard.ts` through `src/lib/fetchTeamBoardWeek.ts`, `src/lib/bridge/vectorDays.ts`
  through `loadBridgeVectors.ts`, `src/lib/peopleHoursUnallocatedRows.ts` and
  `src/components/people/PeoplePayStubsTab.tsx`.
- **Your hours.** `self_salary_clock_state` (migration `20261119160000`) through
  `src/lib/selfSalaryClockState.ts` to `src/components/dashboard/DashboardMyHoursBlock.tsx`.
- **Utilization.** `src/lib/people/payFlagsIndex.ts` to `fetchUtilizationBoard.ts` to
  `src/lib/people/utilization.ts`.
- **The person's sheet.** `src/lib/people/personDeskFacts.ts` reads it.
  `src/components/personDesk/sections/PersonDeskPaySection.tsx` writes it with a plain upsert of the
  pay row, planned by `src/lib/people/paySetupEdit.ts`. `set_pay_config` refuses the key.
- **The Employment tab and the Pay lens.** `PeopleEmploymentTab.tsx` reads it for one sentence.
  `src/hooks/usePayConfig.ts` saves without the column, so a tick there leaves the week alone.
- **Draft Payroll's chip.** `src/pages/People.tsx`.
- **The Hire form.** `src/lib/people/hireWrites.ts` names no week, so a hire starts on the default.
- **The dev seat.** `supabase/functions/_shared/devMcpPaySetup.ts` reads the week and does not set it.

### Who reads the workday schedule

- **The automatic clock sessions.** `salary_sync_one_user_clock_sessions` (newest body in
  `20261014200000`) makes the day's `salary_schedule` sessions from the start and the 480 minutes.
  `sync_salary_clock_sessions_for_day` loops the people who have a template.
- **Whether a person sees a clock button.** `self_salary_clock_state.has_template`. A salaried
  person with a template gets no Clock in, in `src/components/ClockInOutButton.tsx` and
  `src/pages/Dashboard.tsx`.
- **The Calendar's chips and My Time.** `src/lib/resolveCalendarWorkday.ts`, read by
  `src/pages/Calendar.tsx` and `src/components/my-time-day-editor/useMyTimeSalaryPrefetch.ts`.
- **On shift, on the Dashboard's team list.** `src/lib/salaryOnShift.ts`, read by
  `src/hooks/useDashboardMyTeamSectionState.ts`.
- **Its editor.** `src/components/SalaryWorkScheduleSettings.tsx`. Five doors open it: Settings,
  Account, Scheduling for the person's own, the sheet's **Workday schedule…**, the Employment tab,
  the Pay lens's **Workday…** and `SalariedWorkdaysBulkModal.tsx`.
- **Its other writers.** `hireWrites.ts` seeds 480 minutes. `devMcpPaySetup.ts` writes the same row.
  `pay_staff_clear_salary_schedule_by_person_name` deletes it when Salaried is turned off.
- **Payroll does not read it.** `docs/SALARY_CLOCK_SESSIONS.md` says so: the sessions draw the clock
  strip and pay nobody.

### Who reads Hours you can work

- `src/lib/people/utilization.ts` (`answerInForce`), through `src/lib/people/availabilityIo.ts`.
- `DashboardMyHoursBlock.tsx`, People, **Utilization** (`PeopleUtilizationTab.tsx`) and Job Mode's
  top row (`src/lib/jobMode/topRowIo.ts`).
- Its window is `AvailableHoursModal.tsx`, a painter in half-hour blocks from 5 AM to 8 PM. Its
  kernel is `src/lib/people/weekAvailability.ts`.
- Pay, cost and the clock's sessions do not read it.

### Time off, holidays and overtime

- `user_time_off` is read by the sync, which removes the day's sessions for any kind. It is read by
  `salariedPayrollDays.ts`, where an unpaid day pays 0 and a paid day pays that day's hours in the
  week. It is read by `utilization.ts`, where a day off takes that day's hours.
- Company holidays have no record in the app. `PeopleUtilizationTab.tsx` says so on the screen.
- No pay kernel has an overtime rule. Hours are paid at the wage, whatever their count.

### Where they disagree

1. A salaried person on a 30-hour set week who has a workday schedule gets 8-hour sessions.
2. A salaried person who punches and has an answer is held to the answer by Utilization, and to the
   set week by pay.
3. The person can move their own workday schedule in Settings. Nothing tells the pay desk.
4. None of the three says 6:00 AM to 12:00 PM in a way pay, the clock and the person all read.

Read through the dev seat on 2026-11-23, nothing written. The helper who prompted this is on a set
week of 6 hours on five days, still clocks in and out, and has no workday schedule. Only a few rows
exist in each of the three tables, so nothing here needs a data migration.

## The decision: one week with a start and an end

**A person's working hours are one week: seven days, each off, or a start and an end, or two
ranges with a break between.** Times sit on 15-minute blocks. It holds from a Sunday, the first day
of the pay week. A change is a new row and the old one stays, so an old week reads the hours that
held then.

**Where it lives.** In `person_available_hours`, the table that already has this shape, with one
new column: `kind`, either `answer` or `set`. A `set` week is the working hours. It wins over any
answer. The table is close to empty today, and its kernel already adds the hours up, says a week in
words and measures the minutes a punch fell outside the hours.

**What happens to the seven hour numbers.** They stay, and nobody types them any more. For a
salaried person the one save writes the week and the seven numbers together, each number being that
day's hours with the break left out. Every pay and cost reader listed above keeps reading the
column it reads today. That is 5 database functions and about 10 app readers that were moved onto
the week this month and need no change.

**What happens to an existing workday schedule.** The row stays as the switch that says *the
schedule clocks this person in and out*, and it keeps the job or bid the sessions land on. Its
start and its 480 minutes stop being read once the person has working hours: the sync takes that
day's start and end from the week. A day with a break makes two sessions, as a split schedule does
today. A person with a schedule and no working hours runs as today, on 8 hours.

**A person with no schedule.** The helper's case. Working hours make no sessions for him, because
he has no schedule row. He keeps clocking in and out. His Dashboard shows his hours. Utilization
holds him to 30 hours and counts the minutes he punched outside them. His pay does not move: his
seven numbers already read 6 hours on five days.

**An hourly person.** The same row, with no pay side at all. Pay stays the hours logged. Working
hours are what the clock is read against.

**A person nobody set hours for.** Nothing changes. Their own answer on My Time still stands, and a
salaried person's seven numbers still stand alone.

### Rejected

- **A table of its own.** It would be a fourth description of a week. The shape, the dating and the
  kernel are already in `person_available_hours`.
- **Start times added to the seven numbers.** A second column beside the first can disagree with
  it, which is the fault this card is about.
- **Loosening the template to any length.** A template holds one start for every day, so a short
  Friday still could not be said.
- **Moving every pay and cost reader onto the new shape.** It is the purest answer and the largest
  change, on functions that changed a week ago. The derived column gives the same pay with none of
  that risk.

## Who may set it

Held by the database, not by the screen.

- **One door.** `set_working_hours(user, days, from, reason)`, a definer function. It refuses anyone
  who is not a dev or the controller (`is_dev()`, `is_controller()`). It checks the shape: seven
  days, at most two ranges a day, every time on a quarter hour, no more than 16 hours a day. It
  writes the week, the salaried person's seven numbers and one line on the pay log with the reason.
- **No other door.** Nobody signed in can insert a `set` row directly. A trigger on
  `people_pay_config` refuses a change to `salaried_week_hours` from anyone but a dev, the
  controller or the door itself. The show-in-hours trigger on that table is the pattern. The
  schedule tables' write policies narrow to a dev and the controller.
- **The person** cannot answer *Hours you can work* while working hours are in force.

What each reader sees:

| Who | On the person's sheet | Elsewhere |
|---|---|---|
| A dev, the controller | Each line's hours underlined. A press changes the line there. | The same on a phone. |
| The owner | The same lines, plain, with the tag *dev or controller*. | Utilization reads the hours. |
| The office | No *Pay & schedule* section, as today. | Utilization reads the hours, with no **Change**. |
| The person | Not their screen. | Dashboard, **My Time**: one line with their hours. No press, and a line that says who sets them. |

## Where it is set and where it shows

- **Set:** the person's sheet, **Pay & schedule**, a new **Working hours** row above **Clock**.
  Days that share their hours are one line, as the app already says a week: *Mon to Fri*, then
  *6:00 AM to 12:00 PM*, then *6 h a day*. The hours on a line are one `ChangeableValue`. A press
  opens the line's field there, with its start and its end, **Keep** and **Cancel**. The field
  says what the change comes to, the week it starts, and whether pay moves. **Give one day its own
  hours** takes a day out of a line. The shared piece gains one field type, a start and an end in
  15-minute steps.
- **Days that share hours stay one line even when another day sits between them.** A half day on
  Wednesday reads as two lines: *Mon, Tue, Thu, Fri*, then *Wed*. The mock-up's first section walks
  it in five presses: the hours, **Give one day its own hours**, **Wed**, **Half day**, **Keep**.
  The app's own words join only days that touch (`salariedWeekWords` reads this week as *8 h Mon to
  Tue, 4 h Wed, 8 h Thu to Fri*), so the new kernel groups by hours, and the pay words follow it.
- **A day on its own has four quiet presses:** **Half day**, **Same as the other days**, **Make it
  a day off** and **Add a break**. The start and the end can always be picked by hand.
- **A line changes whole.** The start and the end are kept together, and every save is a whole
  week. The first pass kept one time at a time, so a day sat an hour short between two keeps, and
  pay or the clock could read it.
- **The first time, for a person on a set week,** the row asks for the start alone. The days and
  their lengths are already on pay, and the end is worked out. Pay cannot move by accident.
- **A reason is asked only when pay moves.** It goes on the pay log.
- **Earlier hours.** The rows are append-only, so the row can open what the hours were before, with
  who set each and why.
- **Shows:** the same row for the owner, locked. On the Dashboard, one quiet line at the foot of My
  Time, *Your hours are 6:00 AM to 12:00 PM, Mon to Fri*, with a second line when new hours are
  about to start. Nothing on the Dashboard is measured against them, on the asker's word of
  2026-11-23. People, **Utilization**, the office's screen, as *30 h · working hours*.
  **Edit pay setup**, where the seven boxes become one worked-out line for a person with working
  hours. The **Workday schedule** window, which says the hours come from working hours and keeps
  the job focus and one day's move.
- Words follow `src/lib/plainWords.ts`. Colours are the theme tokens. Every press on a phone is
  44 px tall, through the `.vip…` classes.

## The edge cases

| Case | What the plan does |
|---|---|
| A lunch or a split day | A day holds two ranges. The break is not paid and not on the clock. Two is the limit. |
| A week that differs day to day | Each day has its own line. Days that match read together: *Mon to Thu 7:00 AM to 3:30 PM, Fri 7:00 AM to 11:00 AM*. |
| A change in the middle of a week | Hours hold from a Sunday. *This week* reaches today and the days ahead. The days already gone keep the sessions they have. |
| A change that reaches back | The door refuses a Sunday before this week's. Approved hours and pay reports already made are never rewritten. |
| A salaried person's paid hours change | The seven numbers carry no date. Weeks with no pay report yet are priced at the new hours, as a change in **Edit pay setup** does today. The field says how many weeks before Keep. So a change to a salaried day's length starts this week, and a change of times alone may start next week. |
| Overtime | The app has no overtime rule and this adds none. An hourly person's time past their hours is paid as logged and reads as over on Utilization. |
| A holiday on a short day | No company holiday list exists. A paid day off pays that day's own hours, so a short Friday pays its 4. |
| A person in another time zone | Times are on the person's own clock: the schedule row's zone when there is one, the company's when not. |
| One day's move | The day override stays. Its fixed 8 hours loosens to any length in 15-minute blocks. |

## The build

Five PRs. Each is safe to stop after. Each old door is locked in the PR that replaces it, so the
screen and the database never say different rules.

1. **The database door (S).** One migration: `kind` on `person_available_hours`, its hours widened
   to quarter hours, the shape check, `set_working_hours`, `working_hours_on(user, day)`, and no
   direct insert of a `set` row. A SQL bed. *During the rollout:* nothing reads it. The old client's
   answers still save as `answer`.
2. **The kernel and the readers (S).** `src/lib/people/workingHours.ts`, pure: 15-minute ranges,
   days grouped into lines, the seven numbers from a week, the words, set over answer.
   `utilization.ts` reads it with a source of its own. Totals keep quarter hours. *During the
   rollout:* nobody has a `set` row yet, so every screen reads as before.
3. **The row, and the lock on the seven numbers (M).** The **Working hours** row with its field,
   the locked look, **Earlier hours**, the line on My Time, Utilization's line, and **Edit pay
   setup**'s worked-out week. In the same PR, a small migration: the trigger that holds
   `salaried_week_hours` to a dev, the controller and the door, and the person's answer closed
   while working hours are in force. The guide `set-someones-working-hours` and the edits to
   `manage-employment`. `docs/ACCESS_CONTROL.md`. *During the rollout:* needs PR 1 pushed first, so
   `check:calls-ahead` labels it *push right after the merge*. An owner on a stale tab who saves a
   changed week gets the trigger's reason. From here the helper has his hours.
4. **The clock follows the hours, and the lock on the schedule (M).** A migration replaces
   `salary_sync_one_user_clock_sessions` so a person with a schedule row and working hours gets
   sessions at their own start and end. It loosens the override's 480 and narrows the schedule
   tables' write policies to a dev and the controller. `resolveCalendarWorkday.ts` and
   `salaryOnShift.ts` read the week. The Workday schedule window says where the hours come from.
   The Hire form's workday start and the Pay lens's **Workday…** show for a dev and the controller
   only. *During the rollout:* deploy the client first. Pushed alone, the Calendar would draw 8
   hours beside sessions that run the set hours, and a person's save in Settings would be refused
   with no warning.
5. **The dev seat (S).** `plan_pay_setup` takes `working_hours` and plans through the same door,
   with what it changes on pay and on the clock. `docs/dev-mcp/README.md`. *During the rollout:* the
   seat refuses the new key until `dev-mcp` is redeployed.

Later, and only on a yes to call 5: pay and cost read the hours that held on the day, so a change
never re-prices an unreported week.

## What the second pass changed

Asked 2026-11-23: *is this the best we can do?* Eight things moved.

| First pass | Now | Why |
|---|---|---|
| One line a day, each time its own value | Days that share hours are one line, and a line changes whole | Moving a week by an hour was ten presses and ten saved rows. It is one of each. |
| A start and an end kept one after the other | Kept together | Between the two keeps a day was saved an hour short, and pay could read it. |
| The first time asked for days, a start and an end | A person on a set week is asked for the start alone | The lengths are on pay already, so pay cannot move by accident. |
| A reason with every change | A reason only when pay moves | A change of times alone has nothing to put on the pay log. |
| The person's card showed hours of a quota | One quiet line, and a line when new hours are coming | The Dashboard counts time and does not grade it. |
| Days joined only when they touch | Days that share hours are one line, wherever they fall | A half day in mid-week read as three pieces. It reads as two lines. |
| No way to see what the hours were | **Earlier hours**, with who and why | The rows are kept anyway. |
| The lock was its own last PR | Each door is locked in the PR that replaces it | No stretch where the screen says one rule and the database allows another. |

Looked at again and kept: the week lives in `person_available_hours` with a `kind`, the seven
numbers stay as a worked-out column, and hours hold from a Sunday.

## The asker's calls

His go of 2026-11-23, *build it all*, kept every pick.

Each has the pick the plan drew.

1. **The name.** *Working hours*. The pay word *A set week* stays as it is.
2. **The owner's box.** A pay-approved owner can type the seven hour numbers today. With hours held
   to a dev and the controller, that box goes read-only for him. Pick: yes.
3. **The person's own move.** A salaried person can move their own start in Settings and change
   today on the Calendar. Pick: the standing hours close to them, and one day's move stays.
4. **The office's answer.** The office can answer *Hours you can work* for someone on Utilization.
   Pick: it stays for people with no working hours, since it moves no pay and no session.
5. **A dated pay week.** Should a salaried person's new hours leave unreported past weeks at the
   old hours? Pick: yes, as its own PR after these five.
6. **Hours past the working hours.** Pick: paid as logged and shown as over. No note asked for and
   no approval added.
7. **A company holiday list.** Pick: not in this. It is its own card.

## How to verify

- The SQL bed for PR 1: the helper's week, a short Friday, a split day, a time off the quarter
  hour, three ranges in a day, a past Sunday, and each role at the door.
- On the dev server, as the dev: a `ZZ Test` person with a login, salaried on a set week. Set
  6:00 AM to 12:00 PM on five days. Read the seven numbers, the line on My Time through View as, and
  Utilization. Then give them a schedule row and watch one day's session open and close.
- As the owner's and an assistant's sample accounts: the row reads locked, and a direct write is
  refused by the database.
- Delete the `ZZ Test` rows, and name any the database will not let go.
- After the build: the run sheet for an outside session is [`LIVE_TEST.md`](LIVE_TEST.md).
