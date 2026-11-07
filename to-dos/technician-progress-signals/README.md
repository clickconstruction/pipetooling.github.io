---
name: "Your week: one progress signal a tech can watch move, every week"
number: 255
group: ready
status: card and mock-up 2026-11-03 · the owner answered the calls the same day and named three builds first (the teammate's logbook, the Google review tools, job targets) · the logbook train shipped: v2.6472 (a spike against live data, then built), its license edit v2.6473, the dev seat's license verbs v2.6475, the logbook shown to its teammate v2.6483, the TDLR check's levels v2.6485, `/my-logbook` on every role's path and in the phone dock's More sheet v2.6502 · the finishing train of 2026-11-06, each pushed and walked the same day: the review credit v2.6584 (a four or five star answer reaches every tech clocked on the job as a green strip on their home, `my_customer_words()`, `rating_credit_seen`; the office's lines name who was on the job), the Target line on any job's window v2.6585 (`JobTargetLine`, the crew signal's kernel), and the Your week card v2.6589 (`users.week_signal` and the desk's picker, `my_week()`, the Rework view's It was a callback / Not a callback on `job_callbacks`, the card on both homes with the eight-week dots and the customer's words) · the train's PR 7 landed 2026-11-07: the sheet after the week's last clock-out v2.6606 (`YourWeekSheet`, dealt by the clock-out hook when no block follows in the pay week, skipping a crew-deck day) and the Monday email v2.6607 (`your-week-email`, Mondays 6 AM Central while the switch on What the team sees is on; `week_card_data(user)` for the service role; `my_week()` its wrapper), deployed and pushed the same night · PR 3 built 2026-11-07 on `claude/255-your-week-opening-balance-8b114a`: license targets v2.6626 (`license_targets`, the Goals block on the Licenses tab and `LicenseTargetWindow`, the opening balance and the office's class and number read by `goalsFor`, the logbook, `my_week()` and `week_card_data()`) · left: the Monday email's switch, the raise ladder
summary: >
  The app records nearly everything that shows a tech is getting better: the clock, the jobs, the
  customer's stars and words, the crew's ratings, the callbacks Job Summary already finds. Every one
  of them stops at the office. A tech opens the app to a list of things to fix and never sees a number
  move. One card on the tech's home screen, Your week, shows the one signal the office picked for that
  person (license hours for an apprentice, jobs without a callback for a tech, the crew's hours
  against target for a lead), how far it moved this week, and the customer's words by name the day
  they land. Compared to themselves, never to each other. A sheet after the last clock-out of the
  week says the same thing once more, and a Monday email follows later.
next: the office puts in each apprentice's opening balance from the signed forms (v2.6626 merged and its migration was pushed 2026-11-07; the types PR #7218 and a dev-mcp redeploy for its catalog follow); the office picks each person's signal on the People desk, then a dev reads a Monday email preview on What the team sees and turns it on with the owner's yes (2026-11-07: nobody had a signal yet, so Preview mine read No card for you yet, and the owner left the switch off); the raise ladder as its own card once the owner writes the levels (asked 2026-11-07: not yet).
size: L as a train of seven (S · M · M · S · M · S · M); the raise ladder is its own card once the levels are written
blocker: The Monday email waits on signals picked on the People desk, a preview that reads a card, and the owner's yes. The raise ladder (call 5) waits on the owner's levels.
opinion: build draft 2 as drawn. Start with the card and the customer's words, which read data the app already has; the callback count waits for the office's confirm press, never an inferred pair.
mockup: to-dos/technician-progress-signals/mockup.html
---

# Your week: one progress signal a tech can watch move (#255)

## The ask

The owner, 2026-11-03, after reading Rían Doris's *You get twitchy right before it starts working* (FlowState, 2026-08-19):

> What I'm starting to notice is that in our plumbing electrical and HVAC company, we are not doing a great job
> showing our teammates the progress they are making week to week. What kind of signals could we send technicians?

Then, on the list of signals: *"I love your ideas. Can you take a look at the clicktooling.com app and let me know
how you think we could add these?"* and *"Yes, card + mock-up."*

## The idea in one paragraph

The article's claim: the reward system fires on a signal that the reward is getting closer, not on the reward. The
payoffs a tech works toward are months or years away (the raise, the journeyman license, a crew of their own). Week
to week nothing moves on a screen, and an apprentice who sees no progress for a year takes the next offer for $2
more. So each tech gets **one** leading measure that is in their own hands and moves every week, shown on a fixed
beat, compared only to their own past.

## What is already there

| Signal | The data | Today it reaches |
|---|---|---|
| The customer's words | `customer_ratings` (`job_id`, `score`, `words`, `answered_at`); the techs on the job from `clock_sessions` (the one with `travel_started_at` pressed On my way) | The office only: the job window, Needs you for 3 stars or fewer, Customer Hub, What customers see → Reviews. No notice to anyone. |
| License hours | `list_user_license_hours_log` + `src/lib/licenseHoursLog.ts` (`buildLicenseHoursSummary`); imported days (v2.6425) once approved | Dev, assistant, pay-approved master. The RPC refuses a tech. |
| Callbacks | `src/lib/jobs/jobSummaryRework.ts` (`findReworkPairs`, `ReworkKind = 'callback'`), Jobs → Job Summary → Rework | The office, inferred only: a second visit to the address in 30–180 days that billed nothing. No way to mark a pair *not a callback*. Credits `master_user_id` only. |
| Crew hours vs target | `job_budgets.labor_hours`, `job_expected_hours` (open row), hours from `clock_sessions` | The Costs tab and the project board, in dollars. Many jobs carry no target. |
| Crew ratings | `team_member_reviews` (`source = 'crew'`), `crew_review_aggregates` (2+ raters) | The office. The guide promises the rated person never sees them. |
| Firsts | `jobs_ledger.service_type_id`, `jobs_ledger_fixtures.name` (free text) | Nobody; names need a catalog first. |
| The raise | `people_pay_config` (own row readable), `trade_levels` (the hiring scale, 0–3 a trade) | No ladder, no criteria, no history a tech can read. |

Where a tech already looks: the Job Mode home (`src/pages/Dashboard.tsx:1212`, beside `DashboardYourRecordCard`,
which holds only things to fix) and the post-clock-out hook (`src/components/ClockInOutButton.tsx`, the hook that
deals `TrialVerdictPrompt` and `CrewReviewDeck`). Nothing in the app texts staff today; the Monday model is
`supabase/functions/bridge-weekly-sheet` (a Monday tick, an on switch, a dry preview).

## The decision (draft 2)

1. **One signal per person, picked by the office.** On the person's People desk: *License hours*, *Jobs without a
   callback* or *Crew hours against target*. The default by role is a guess the office corrects once; the app does
   not know an apprentice from a journeyman until it is told.
2. **The card says three things at most.** The signal and where it stands. How far it moved this week, with the last
   eight weeks as dots climbing a line. The customer's words, when a customer wrote some this week.
3. **License hours** show approved hours solid and hours waiting for approval hatched, so a slow approval week never
   freezes the bar. The board's targets are seeded in the logbook's `REQUIREMENTS` (v2.6472; opening balances and a stored signer per trade are still to build), and the class is the office's to set on the Licenses tab (*Journeyman plumber,
   8,000 hours* as an example; the board's own number goes in). Hours before the clock started (2026-03-12) are an
   opening balance the office types with its source.
4. **Jobs without a callback** is a rolling count, *29 of your last 30 jobs*, not a streak. One callback does not
   wipe out a year, and nobody has a reason to hide one. A pair counts against a tech only after the office presses
   *It was a callback* on the Rework view; an inferred pair alone never reaches the card. Credit goes to every tech
   clocked on the first job, not the lead alone.
5. **Crew hours against target** is the lead's signal, never a tech's: framed as the crew's craft, counted only on
   finished jobs that carry a target, and saying how many had none.
6. **The customer's words arrive the day they land**, as a green strip on the tech's home with the customer's first
   name, the stars and the words, then fold into the week's card. Credit goes to the techs clocked on the job; a
   rating with no job credits nobody.
7. **After the last clock-out of the week** a sheet says the week once: the signal, the move, the words. It skips a
   day the crew deck deals.
8. **No leaderboard, no points, no dollars.** A tech is compared to their own last eight weeks.

## The calls

1. **Low stars.** Answered 2026-11-03: five stars is the goal, and Google reviews are the basis, since they are how
   customers find us. The customer's words signal reads Google reviews, which needs the review tools refined first.
2. **The crew-rating trend.** Answered 2026-11-03: yes, techs see their own crew rating.
3. **A callback's confirm.** Answered 2026-11-03: yes, a callback counts only after the office presses *It was a callback*.
4. **License targets.** Answered 2026-11-03: every license counts for each trade. An hour counts toward the license of
   its job's trade (v2.6472).
5. **The raise ladder.** Open: the owner is not sure yet. A card of its own once written; `trade_levels` could seed the rungs.
6. **Who picks each person's signal.** Answered 2026-11-03: the office picks.

## Alternatives weighed

- **Three tiles (draft 1): hours, jobs, stars, plus a bar.** Lost: a dashboard dilutes the one signal, the opposite of
  what the article asks. Draft 2 keeps one big signal and two lines under it.
- **A streak of jobs without a callback.** Lost to the rolling count: a streak's reset to zero punishes a whole year
  for one return and teaches people to hide a callback.
- **A leaderboard.** Lost: it rewards the top two and discourages the rest.
- **Points and badges.** Lost: techs see through a game. Every number on the card is a real outcome.
- **Dollars billed this week.** Lost: not in a tech's hands, and it lags.
- **A Monday text.** Later: nothing texts staff, and it needs each tech's number, an opt-in and STOP. The Monday email
  comes first.
- **Hours against the bid for every tech.** Lost: it turns into a speed race. Leads only, at the crew level.

## Is this the best we can do? The second pass

Written after looking at the first render of draft 2 (`mockup.html`; the box at its foot says the same).

- **Jordan's bar did not move.** 41 hours is half a percent of 8,000, so the long bar looks the same every week: the
  article's exact problem. A short bar to the next 500 hour mark replaced the eight-week dots on the license card.
- **The lead's arrow read backwards.** A green ▲ beside *12 hours under* asked whether up was good. Now a ✓ and a note
  that the dashed line is the target.
- **The dots had no time.** *8 weeks ago* and *This week* under them.
- **The callback press leaned one way.** *It was a callback* was the solid red button. Both presses now weigh the same.
- **No signal yet.** A tech with no signal picked has no card; the People desk offers the picker.

## The PR train

| PR | What | Size |
|---|---|---|
| 1 | Kernel `src/lib/techWeek/weekSignal.ts` + tests: the week's move, the eight-week dots, the rolling callback count, the hatched waiting hours, the three-line rule | S |
| 2 | Migration: `people.week_signal`; self-only RPC `my_week()` (own clock hours, own credited ratings, own license hours); the Your week card on the Job Mode home; the People desk picker; guide + release note | M |
| 3 | License targets: class, target hours and opening balance on the Licenses tab, read by `my_week()` | M |
| 4 | The customer's words the same day: the green strip on the tech's home | S |
| 5 | The Rework view's *It was a callback* / *Not a callback* press, credit to every tech clocked on the first job, the rolling count on the card | M |
| 6 | The lead's crew hours against target | S |
| 7 | The sheet after the week's last clock-out, then the Monday email registered in What the team sees | M |

## The logbook, shown to its teammate (shipped v2.6483; every role's path and the More sheet v2.6502)

The owner, 2026-11-04: *"Some employees have a log of the work that they've done. I would like to offer a button to
expose that log."* Mock-up: `own-logbook.html`. The office turns it on one teammate at a time, from the logbook.

- **The office's press.** A strip under the logbook's header says who can see the page. *Show Dario this logbook*
  turns it on; the strip then names the day and who pressed, and the button reads *Stop showing*. The Licenses tab
  row says *Dario sees it* beside Open logbook.
- **The teammate's door.** A *My logbook* row in the app's menu, only once shown, opens `/my-logbook`: the same page
  written to them (*Your logbook*), with the goal cards, the licenses they hold, the log and Print summary sheet. No
  Edit, no Add a license, nobody else's hours.
- **Data.** Migration: `logbook_shares` (one row a teammate shown: who pressed, when; the Licenses audience writes,
  the teammate reads their own row) and `my_logbook()`, a SECURITY DEFINER read on `auth.uid()` that answers only
  with a share row: their approved hours, their licenses, and the current teammates' supervising licenses for the
  signer line. The office's `list_user_license_hours_log` and `person_licenses` stay closed to teammates.
- **Kernel** `src/lib/logbook/logbookShare.ts`: the strip's words and the parse of `my_logbook()`'s answer, with
  tests. A SQL bed proves the gate: unshown answers nothing, shown answers only the caller's own hours.
- **Ship.** Guide section in `keep-a-teammates-logbook-and-print-it-for-the-board` and a teammate's guide; release
  note; the migration pushed right after the merge (the client calls a name only it creates).

## How to verify

Sign in as a ZZ Test tech in a localhost preview. The card shows the signal the office picked, the hatched hours
match the pending sessions, and a 5-star answer on a test job the tech clocked onto shows the same day. A tech never
sees another person's numbers (`my_week()` reads `auth.uid()` only).
