# Working hours and My Time: the live test

A run sheet for a session that did not build these (punch list #429, working hours, and #427, the My Time
picture). It needs nothing from the session that built them. Read it whole before the first step.

## Before you start

**Check that it is all live.**

- These pull requests are merged: #9455 and #9471 (My Time), #9461, #9465, #9477, #9492 and #9493 (working
  hours), and #9499 (types). `gh pr view <number> --json state`.
- `npm run check:migration-drift` reads fully applied, and the dev seat's `check_migration_ledger` lists
  `working_hours_door`, `working_hours_lock`, `working_hours_clock` and `working_hours_schedule_lock`.
- The dev seat answers as server 0.129.0 or later, and `find_rpc set_working_hours` finds the door.

**The rules.** Each is in force for the whole test.

- A live look at the app is capped: one page at a time, by hand, at least 15 seconds apart, never a scripted
  capture, and the tab closed after (`docs/DB_FREEZE_RUNBOOK.md`, Standing protections).
- Test on `ZZ Test` people only. A session makes, edits and deletes `ZZ Test` rows on prod without asking
  (`AGENTS.md`). Never set or read a real person's hours or pay for this.
- The repo is public. Report what you checked and what you saw in words. Never commit a picture or a figure of
  the live app.
- If auto mode refuses a press on clicktooling.com or a seat apply, stop and ask the user for Ask mode or a yes
  that names the step. Do not route around it.

## The two people

- **ZZ Test Learner** (`57752819-aa3f-4804-b344-36ec3d7ff3a1`): a helper with a login and no pay row. Use them
  for working hours and for what the person reads, through View as.
- **ZZ Test Hand** (`afd9c13e-2191-495b-b28d-041589566b4c`): a helper with an hourly pay row and no login. Use
  them for the salaried checks in step 4, and only on the user's word.

## 1. The dev seat sets a week (no browser)

1. `plan_pay_setup` with `pay: { person: 'ZZ Test Learner', reason: 'Live test of working hours', working_hours:
   { mon: '06:00-12:00', tue: '06:00-12:00', wed: '06:00-12:00', thu: '06:00-12:00', fri: '06:00-12:00' } }`.
   Expect `working_hours.in_force` null, `working_hours.plan.from` this week's Sunday, `hours_per_week` 30, pay
   words that say an hourly person's pay does not move, one write (`set_working_hours`), and
   `working_hours.door.status` `planned`.
2. `apply_pay_setup` with the same `pay` and the `plan_hash`. Expect the step `working_hours` done and the week
   in `read_back.working_hours`.
3. `call_read working_hours_on { p_user_id, p_day }`: a weekday answers `[[360, 720]]` and a Saturday `[]`.
   `call_read has_working_hours { p_user_id }` answers true.
4. Plan and apply a half day on Wednesday: the same week with `wed: '06:00-09:00'`. Expect the change to read
   *6:00 AM to 12:00 PM Mon to Fri, 30 hours a week* before and *Mon, Tue, Thu, Fri* at 6:00 AM to 12:00 PM with
   *Wed* at 6:00 AM to 9:00 AM, 27 hours a week, after.
5. Plan only, each refused in words with nothing written: a time off the quarter hour (`'06:10-12:00'`), three
   ranges in one day, two ranges with no break between, and `working_hours_from: 'tomorrow'`.

## 2. What the office sees (browser, one page at a time)

Sign in as the dev on clicktooling.com with `node scripts/dev-pane-login.mjs /people`, in the app's browser
pane.

1. People, then ZZ Test Learner's sheet, then **Pay & schedule**. The **Working hours** row reads two lines:
   *Mon, Tue, Thu, Fri* at 6:00 AM to 12:00 PM, 6 h a day, and *Wed* at 6:00 AM to 9:00 AM, 3 h. The week reads
   27 h.
2. Press the first line's hours. Its field opens in place with a start, an end, *This week* and *Next week*,
   and a sentence of what the change comes to. Press **Cancel**.
3. **Earlier hours** lists both saves with who set them and the reason.
4. People, then **Utilization**: ZZ Test Learner reads 27 h from working hours, with no **Change**.
5. On a phone width the row's label sits above the lines and nothing runs off the screen.

## 3. What the person sees

1. Open View as for ZZ Test Learner (the guide *see the app as someone else* says where). Open the Dashboard.
2. **My Time** shows the week's time as one large number, a column for each day, and a column for each of eight
   weeks. Nothing is coloured as over or under a quota.
3. At the foot of the card: *Mon, Tue, Thu, Fri: 6:00 AM to 12:00 PM.* and *Wed: 6:00 AM to 9:00 AM.*, then
   *The office sets these hours.*, with no press.
4. Press a week's column: that week's days open. A day the clock stopped at midnight says so.
5. In Job Mode, the **My Time** card under Your record draws the same picture.
6. Come back from View as.

## 4. Salaried, the usual workday and the clock (ZZ Test Hand, on the user's word)

Making a person salaried shows on payroll screens until it is undone, so ask first.

1. `plan_pay_setup` for ZZ Test Hand with `is_salary: true`, its current `hourly_wage`, `start_date` today
   (which keeps past weeks off payroll catch-up) and `workday_start: '06:00'`. Read the plan, then apply it.
2. Plan `working_hours` at 6:00 AM to 12:00 PM, Monday to Friday. Expect the seven numbers on pay to move from
   8 h to 6 h a day, 40 to 30 hours a week. Plan the same with `working_hours_from: 'next_week'`: refused, since
   pay carries no date. Apply the first plan.
3. As the dev, ZZ Test Hand's **Workday schedule…** window says working hours drive the clock, and its fields can
   be changed. As anyone else the same window shows the usual day with its fields off, the line *A dev or the
   controller sets the usual day.*, and a press that reads **Save this date**. To see that without a real
   account, use the lens frame: in the pane, run `window.name = 'pipetooling-lens:' + JSON.stringify({ as:
   'master_technician', mood: 'full', theme: 'light' })` and reload. The app then boots as an invented owner
   over invented rows, and nothing reaches the database (`src/lib/lens/seal.ts`).
4. The clock. Today ZZ Test Hand's session runs the template's 8 hours from 6:00 AM, because hours saved during a
   day reach the clock from the next day. On the next weekday, read `clock_sessions` for ZZ Test Hand: a
   `salary_schedule` row from 6:00 AM to 12:00 PM. Skip this step if the person cannot stay salaried overnight.
5. Undo: `plan_pay_setup` with `is_salary: false` and its reason. That clears the workday template, the day
   overrides and the unapproved automatic sessions of that day and the day before. Each plan's `clock.words`
   says which sessions it makes; clear any it made on another day.

## 5. Clean up

- Take working hours off each person you set: `working_hours: null`. The rows stay, because the table keeps
  every save. Name them in your report.
- Put ZZ Test Hand back on hourly pay if step 4 ran.
- Close every tab.

## Report

For each numbered step: what you did, what you saw, and pass or fail. A failure names the screen, the press and
the words on it.
