---
name: "Job Mode, short: a superintendent's one-screen home"
number: 384
group: ready
status: the owner picked this direction on 2026-11-17 · PR 1 live 2026-11-18 (v2.7749, the setting opened to a superintendent, migration 20261118070000 pushed) · PR 2 built 2026-11-18 (v2.7752, the short page) · PR 3 not merged
summary: >
  A superintendent says there is too much on his screen and it overwhelms him. His daily page is the Job Mode
  Dashboard on his phone: about six screens and about eighty presses, of which he uses the first screen. The
  first screen is right. The weight is everything under it, and most of that repeats what the job already
  holds. The owner picked a short Job Mode page: the card's top, what waits on him, tomorrow in one line and
  one door to everything else, about one screen. It reuses the per-person Short setting from the leader's
  short Dashboard (#365), opened to a superintendent, so only the person the office sets changes.
next: Merge PR 3, the trims. Then the office sets one superintendent to Short on his People desk and walks the page with him on his phone.
size: M as a train of three (S · M · S)
blocker: None in the code. Setting a person to Short is the office's press, and the three questions below are the owner's to put to him.
opinion: build — nobody's page changes until the office presses Short for one person, so the risk is only in what the short page tucks away, and every cut stays one press from the page
---

# Job Mode, short (#384)

The mock-up is [`mockup.html`](mockup.html): the short page beside today's page drawn to scale, each block
marked with where it goes. Its names, jobs, addresses and counts are made up. The repo is public, so nothing
below names a real person, job, task or figure.

## The ask

The owner, 2026-11-17, in his words: a superintendent "believes that there is too much stuff on his screen
and that he is overwhelmed by it all. Can we take a look by impersonating him at what he sees and think about
what we might need to change or build to improve it?"

A session looked at his live screens through the app's own View as, read only, phone width first. It reported
to the owner, who picked the short Job Mode page and then asked for this card so that another session builds
it.

## What the look found

- **His daily page is Job Mode, not the full Dashboard.** Job Mode is on, on his own phone. A leader's short
  Dashboard (#365) is never reached there: Job Mode's early return in `Dashboard.tsx` comes first.
- **The page is long.** The Job Mode Dashboard measured about six phone screens and about eighty presses on a
  working day. The full Dashboard measured about seven screens and about ninety presses. The job window that
  opens from the card is a little over two screens.
- **He uses the first screen.** A month of his presses is one loop: open the job from today's list, Arrived,
  Leaving, sometimes Leave report, close. The other doors his role holds were barely pressed or not at all.
- **The first screen is right.** Next stop, today's stops, and the bar with Turnaway, Leave report and On my
  way. Nothing in this card changes it.
- **Everything under it is the weight.** In order: Materials on site, the pace card (#242), the stage
  checklists, Photos, Ticket, the customer and the street picture, the job updates feed with its filters and
  note box, Your record, the hours chart, My Schedule, Training, Show full dashboard.
- **It repeats.** My Schedule draws today's stops a second time as full cards, and carries about half the
  page's presses. The ask for a report is said three ways: on Your record, on the schedule card and on the bar.
- **Much is not his to act on.** The supply house chips on every schedule card, the pace card's fine print
  about the office's sign-off, the money percent, the eight weeks of hours for a salaried person.
- **What the office needs from him is buried.** Your record, the report and the percent only he can give,
  starts more than two screens down.
- **Standing marks never clear.** Old items stay red or yellow for months. Clearing them is the office's
  work, not this card's, and the owner has the list.

### Why no view that exists answers it

- He is already in Job Mode.
- Short is a leader's or a dev's only: `canHaveShortDashboard` in `src/lib/dashboard/shortDashboard.ts`, and
  `set_dashboard_view` refuses any other role's account. Job Mode's return also comes before Short's.
- Task Mode (Checklist → Today) is one clean screen, but his work is stops, not tasks.
- No phone fold applies to him: `isPhoneOfficeRole` is assistant, controller, primary and estimator.
- Nothing below `DashboardJobModeCard` in the Job Mode return is gated by role, and no setting hides or
  reorders a Dashboard section per person.

## The decision

The owner picked **Job Mode, short**, set per person. Considered and not picked:

- **A view that exists.** None answers it, as above.
- **Trims for everyone only.** Worth doing (PR 3), but they take away a screen at most.
- **A superintendent's own first screen for project work.** Large, and built for work this superintendent is
  not doing today: he holds no project and runs service stops. Not now.

### The short page

With Job Mode on and the person's view set to Short, the Dashboard is, top to bottom:

1. **The job card's top, as it is**: next stop, today's stops, the press bar.
2. **Open this job**: one row that opens what the card's lower half holds today. Customer, photos, ticket,
   stage checklists, materials on site, job updates and the note box.
3. **The pace line** (a superintendent only, #242): ahead or behind in one line. A press opens the card as it
   is today, with its bar, its percents and its fine print.
4. **Waiting on you**: Your record, moved up under the card. Same lines, same presses.
5. **Tomorrow**: one line with how many stops and when the first is. A press opens the Schedule tab.
6. **Everything else**: one door. Its second line says what is behind it and how many courses are owed. It
   opens the full Dashboard for the visit, with a way back on top.

Nothing is removed from the app. Each cut is one press from the page.

### Calls left for the owner, each with a default

| Call | Default |
| --- | --- |
| Who can be on short Job Mode | A superintendent. A leader in Job Mode keeps the full card, as #365 decided. Field crew wait for the walk. |
| Who presses the setting | The office on the People desk, as today, and the person for his own row in Settings. |
| Job Mode off, view Short | A superintendent gets the leader's short Dashboard: one setting, the short form of whichever home he uses. |
| What Open this job opens | A fold in place over the same two components, so nothing is lost. The job window only if it is shown to hold every piece. |
| Where the pinned quick row goes | Behind Everything else. The Tally square is one press further. |

## Where it plugs in

All of it exists except the short page itself.

- **The setting**: `users.dashboard_view`, the RPC `set_dashboard_view` (one definition, in
  `supabase/migrations/20261117030000_dashboard_view.sql`), `src/lib/dashboard/shortDashboard.ts`
  (`canHaveShortDashboard`, `canSetDashboardViewFor`, the words), `src/hooks/useDashboardView.ts`,
  `src/lib/dashboard/dashboardViewIo.ts`.
- **Where the setting is pressed**: `src/components/dashboard/DashboardViewPicker.tsx`, drawn by
  `PersonDeskDashboardViewSection.tsx` on the People desk and by `SettingsDashboardTab.tsx`. Both show the
  picker when `canHaveShortDashboard` passes for the person's role.
- **What else reads `canHaveShortDashboard`**: `Layout.tsx` (the bar's Dashboard tab as the way home),
  `DispatchModeFooter.tsx`, and `Dashboard.tsx`, where Short also turns on the phone folds of the full page.
  Opening the role opens all of these, so read each before changing the rule.
- **The page**: `src/pages/Dashboard.tsx`, the Job Mode early return (`if (jobModeEnabled &&
  !jobModeShowFullDashboard && authUser?.id)`) and the Short return right after it. The Job Mode return draws,
  in order: `DashboardPinnedQuickRow`, the hidden clock mount, `DashboardTrialVerdictSection`,
  `DashboardCustomerWordsStrip`, `DashboardJobModeCard`, `DashboardYourWeekCard`, `DashboardYourRecordCard`,
  `DashboardMyHoursBlock`, `MissedClockInDoor`, `myScheduleSection`, `DashboardTrainingSection`, **Show full
  dashboard**, and the Leave report and Turnaway windows.
- **The card**: `src/components/jobMode/DashboardJobModeCard.tsx`. Its lower half is the Materials on site
  link, `SuperintendentCard` (the pace card, a superintendent only) and `JobModeDetailsSection` (stage
  checklists, photos, ticket, customer, job updates). The rail's rows open the job window through
  `handleRailRowTap`. The press bar is `JobModePressBar`.
- **The way back from the full page**: the leader's short Dashboard has a button on top of the full page
  (`data-short-back` in `Dashboard.tsx`, the words in `SHORT_DASHBOARD_WORDS.back`). Job Mode's **Show full
  dashboard** has none today.
- **The docs that hold these facts**: `docs/DASHBOARD_SECTIONS_ARCHITECTURE.md` (rows 0 and 0b),
  `docs/GLOSSARY.md` → *Short Dashboard*, `docs/ACCESS_CONTROL.md` → *Dashboard view*, and the guides
  `use-the-short-dashboard.md` and `job-mode-clocking.md` in `src/content/help/`.

## The plan

### PR 1 · the setting opens to a superintendent (S)

- A kernel rule beside `canHaveShortDashboard`, with tests in `shortDashboard.test.ts`: which roles take a
  view, and which role gets which short page.
- One migration: `CREATE OR REPLACE` `set_dashboard_view` from the definition in
  `20261117030000_dashboard_view.sql`, taking a superintendent's account, and letting a person set his own
  row. Its refusal words change with it. The migration doc goes in `docs/migrations/`.
- The People desk and Settings pickers follow the kernel. `PersonDeskDashboardViewSection.render.test.tsx`
  gains the superintendent case.
- A superintendent set to Short with Job Mode off gets the leader's short Dashboard. Walk that once: its
  list reads Needs you by role, so check what it shows him.
- Docs: the *Dashboard view* section in Access control, the Glossary entry, the guide.

Nobody's page changes: no superintendent is on Short until someone presses it. Push the migration after the
merge. The client calls nothing new, so the order is not tight.

**Built 2026-11-18 as v2.7749.** What moved from the plan, and what the walk found:

- The rule is `DASHBOARD_VIEW_ROLES`, `shortPageFor` and `canSetDashboardView`, beside `canHaveShortDashboard`,
  which now reads the three roles.
- The migration is `20261118070000_dashboard_view_superintendent.sql`, the function alone, with a SQL bed
  (`scripts/pgtest-dashboard-view.sh`).
- **The walk, Job Mode off.** A superintendent on Short gets the leader's short Dashboard. His list holds only a
  job note that tagged him: the lien lines are the leader's. **Clock In** is behind **Everything else**, one
  press further than on the full page. The door's second line said *Money, crew, jobs*, which is not his page, so
  it now reads *Clock In, your hours, your crew and the full Dashboard.* for him.
- **Pushed 2026-11-18** right after the merge, the one file. The real press was walked on the sample
  superintendent: the office's press on his People desk, then his own press in Settings.
- **Until PR 2**, a superintendent on Short with Job Mode on keeps the Job Mode page as it is. On a phone My
  Schedule hides there while today and tomorrow hold no stop, as it does for a leader on Short. So the office
  sets nobody to Short before PR 2 is live.

### PR 2 · the short Job Mode page (M)

- A kernel, `src/lib/jobMode/jobModeShort.ts`, pure and tested: whether the short page is on (view, role,
  Job Mode), the Tomorrow line from the next day's blocks, the door's second line, and every word on the page
  under the plain words rules.
- `DashboardJobModeCard` takes a `short` prop. With it on, the lower half sits behind **Open this job**, and
  the pace card behind its one line. The rail, the press bar and every sheet stay as they are.
- The Job Mode return in `Dashboard.tsx` draws the short order when the kernel says so: the card, Your
  record as **Waiting on you**, the Tomorrow line, **Everything else**. The trial verdict and the customer's
  words strip stay on top: both are rare and draw nothing most days. The hidden clock mount stays, or the
  card's clock presses stop working.
- **Everything else** opens the full Dashboard for the visit and puts a way back on top, the #365 pattern.
- Render tests: the card with `short` on and off, and the Dashboard's short order.
- Docs: the sections architecture rows, the Glossary, the two guides, the release note and the fragment.

**Built 2026-11-18 as v2.7752.** What moved from the plan, and what the walk found:

- The page's order is its own component, `JobModeShortPage`, so a test holds it. `Dashboard.tsx` hands in the
  pieces.
- **Open this job** is the fold in place the card's default asks for. Open, the row reads **This job**.
- **Everything else** opens the full Dashboard past the leader's short one, and the way back is the button on
  top or Job Mode's **Dashboard** tab.
- The Tomorrow line says *Reading your schedule.* while the schedule is being read, so it never says no stops
  too early.
- With no job on the card the Materials on site link stays on the page: it is the only door to its picker.
- Walked as the sample superintendent at phone width: 1.0 screen with no job on the day and 1.06 clocked onto a
  ZZ test project, every cut opened, every clock press opened its window. The sample account has no stops, so
  a day of three or four is the office's walk to count.

### PR 3 · trims everyone gets (S, may ship first or last)

Each is small and stands alone. Split them if one grows.

- **Empty stage checklists** draw nothing in Job Mode while a job's stages hold no questions
  (`JobStageChecklistStrip`, `stripEmptyStageWords`).
- **Recent Reports** stops counting the viewer's own reports as new. The count reads `report_reads`, nothing
  writes a row when a person saves his own report, and the section opens itself when anything is new
  (`DashboardRecentReportsSection.tsx`, `reportRowState`).
- **Supply house chips** on a schedule card fold to one line while every chip reads none yet
  (`useJobAccountStrips`, the Job Accounts train).

## How to verify

- **Walk it as the role first.** View as a superintendent's test account, turn Job Mode on from the gear
  menu, set Short on its People desk, and count the screens at phone width. The short page should end within
  about one screen with three or four stops on the day.
- **Then press every cut.** Each thing tucked away must open from the short page: the customer, photos, the
  ticket, stage checklists, materials on site, job updates, the note box, the full pace card, tomorrow's
  stops, hours, training, the full Dashboard, and the way back.
- **The clock presses.** Arrived, Leaving, On my way, Leave report and Turnaway on a test job, since the card
  depends on the hidden clock mount.
- **Nobody else moved.** A superintendent on Full, a leader on Short and a crew member in Job Mode each see
  the page they see today.
- **Then the real walk.** The office sets one superintendent to Short and sits with him on his own phone.

## Three questions for the superintendent

The owner puts these to him before or during the walk. The answers settle the calls above.

1. When you open the app, what are you looking for first?
2. Show me the part that bothers you most. Is it the long page under your job, or the red and yellow marks?
3. If the screen showed only your next stop, Arrived, Leaving and Leave report, what would you miss?

## Seen along the way, not checked

- A job's updates feed held a run of *Specific work added* lines that grow a few letters at a time, as if
  each pause in typing saved an event.
- The Projects board draws wider than a phone screen.
