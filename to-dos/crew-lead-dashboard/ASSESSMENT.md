# A crew lead's Dashboard on his phone: assessment and proposal (2026-11-20)

Not a to-do card yet: no number is claimed, nothing is committed, nothing is built. This file and `mockup.html`
are untracked in the worktree until the owner picks. The mock-up is also a private artifact:
https://claude.ai/artifact/5i62GEMwTpnNMkJXZ2J78c. Its names, jobs and counts are made up. The repo is public,
so this file names no person, customer or job. The screenshots show real names and stay outside the repo.

## The ask

The owner, 2026-11-20: imitate one man who works on jobs, look at his Dashboard on a phone. It "feels rather
chaotic and the new titles work but there are other issues". Three doubts: that he is given good tool
locations for the job he is working on, a good story of the work going on around him, and that he is asked
for things to fill out in the right way.

## Who he is on the page

Read through the dev seat, as counts and kinds.

- A master technician, salaried. His hours are written from his schedule, 8:00 to 4:00.
- Job Mode is on, switched on from the first-run card on his own phone. His Dashboard view is Full. Nobody is
  on Short.
- In 32 days he worked 25 days. On 21 of them he had one job all day. Ten were on the same job, with one
  partner scheduled beside him every day this week. One day had three jobs.
- He opens the Dashboard once or twice a day. In two weeks the page recorded three opens of the job window
  and one On my way from him. The drive was stamped on one day of the 25 and an arrival on two.
- He left seven reports in the month, on four days. The last was two weeks ago.
- He has already thinned his own page: six of his quick buttons are switched off.

So the man is a crew lead on a long job, and the page he opens was built for a day of several stops.

## How it was walked

The dev server on fresh `main` (v2.8060), signed in with the dev-login and then the app's own View as, driven
by Playwright at 390 by 844 and 320 by 568, light and dark. Every write to a table was refused at the network,
so nothing was pressed or saved as him.

His real state that day was a job ahead with the salaried clock running and no job on it. The other states
were drawn by answering the page's own reads differently, with no write: the schedule read answered empty (no
job), the clock read answered with the job and a drive begun (on the way), with an arrival (on site), and
closed at 4:00 (after work).

Two things ran as him before the walk blocked them: the app's activity stamp and the salaried clock sync,
once each on the first load. The app's own View as runs both every time.

Not seen: his own phone, so the install banner may already be dismissed there. Task Mode. The report form and
the photo sheet, which were not opened. A day of several stops.

## 1. The inventory

Lengths are in phone screens of 844 px, measured on the page. On site, top to bottom:

| Piece | Screens | What it is |
|---|---|---|
| The install banner (*Add a one-tap Add Task icon*) | 0.07 | An ask, for the app's sake |
| The header: nine icons, four of them in colour | 0.09 | Tools for other work |
| The day's row: Photo, Job details, On site, Paint a map, My spend | 0.07 | Tools, and one ask as a badge |
| Quick buttons: Bid, Inspections, Builder Review, Bills sent | 0.10 | None of the three |
| The job card's top: name, place, Job calendar, Materials on site | 0.13 | Tools |
| Today's list, one line | 0.06 | Story, thin |
| *Hand the phone to the customer to sign* | 0.05 | An ask of somebody who is not there |
| Paint a map, Place on this job, Photos, Ticket, Customer, Job detail | 0.24 | Tools, three of them said again |
| Job updates and its note box | 0.73 | Story, mostly clock punches |
| Your record | 0.19 | An ask |
| The hours card | 0.20 | None: he is salaried and has nothing to answer |
| My Schedule: today's card and tomorrow's | 0.88 | The job said again, twice |
| Training | 0.37 | An ask |
| Show full dashboard | 0.04 | A door |
| Pinned: the press bar and the tabs | 22% of every screen | Tools |

How long the page is:

| State | 390 px | 320 px |
|---|---|---|
| No job scheduled | 1.9 | |
| A job ahead (his real day) | 2.5 | 4.0 |
| On the way, on site | 3.7 | 5.8 |
| After work | 3.7 | |
| Behind **Show full dashboard** | about 15 | |

By lens, on site: tools about 0.6 of a screen, story about 0.8 and nearly all of it clock lines, asks about 0.6,
things said again about 0.9, none of the three about 0.8.

Behind **Show full dashboard** his role gets the leader's page of card #365: the Lien desk, Needs you with
35 lines, the three money cards, Money in, Projects, the clock table, Crew Day, My Inbox, Your people, My
Bids, Recent reports, the map, the Billing pipeline, the lien month, the HR report, My Team with My crew, My
Time, My Vehicle and Training.

## 2. What feels chaotic, and why

Each point names its sheet in the notes folder.

1. **The job is not first.** On the first screen a banner, the header, four squares and four blue buttons
   come before the job card. That is 36% of the screen, and the pinned bars take another 22%. At 320 px the
   first screen shows the job card's top edge and no job name at all. *(A screen 1, G screen 1)*
2. **Nothing is the main thing.** One screen holds four coloured header icons, two blue squares, four blue
   buttons, an orange Report, a red training line further down and a green press. Every one of them asks to
   be first. *(A screen 1)*
3. **Before he is on the job, the card says nothing useful.** It reads *Clocked in* and *No job or bid linked
   yet*. The job's name is cut off. There is no address and no partner. His clock is written for him, so this
   is the card he sees every morning. *(A screen 1)*
4. **The same job is on the page six times** on site: the squares, the card, today's list, Your record,
   today's schedule card and tomorrow's. Tomorrow's card is today's card again, word for word. *(D)*
5. **The same door is drawn twice, four times over.** On site and Materials on site. The Paint a map square
   and + Paint a map. The Photo square, Photos and the schedule card's photo icon. Job details and Job
   detail. *(D screens 1 and 2)*
6. **The report is asked in four places, three ways**: *Report* in orange, *Leave report* in the bar, *Leave
   Report* on today's card and on tomorrow's, a day he has not worked. *(A screens 1 to 3)*
7. **The bar's presses are wrong for his day.** Before the job the big press is On my way, which he pressed
   once in two weeks. On site with one job it is a dead grey *Last job of the day*, the largest thing on the
   screen. After work it is On my way again, to the job he just finished. Leave report is dead before the job
   and after work, while Your record asks for a report 150 px above it. *(A, D, E)*
8. **Cards that are not for him.** The hours card tells a salaried man his week is 40 h. Training lists two
   optional courses under the one he owes. *Hand the phone to the customer to sign* shows on a job where no
   customer is on site. *(A screen 2, D screen 1)*
9. **The story is clock punches.** Job updates held about 30 lines and 23 were crew clock lines, each with
   another person's hours and approval state. *(D screen 2)*
10. **The door at the foot opens the office's page.** 15 screens, starting with the Lien desk and the money
    cards. His own crew, the reports he owes by day, his crew to rate and his truck's mileage are on screens
    13 to 15 of it. *(H)*
11. **Dark holds, with one fault.** The install banner's words are dark orange on dark brown and cannot be
    read. A dead Leave report looks like a live grey button. *(F, J)*
12. **A whole-screen question.** Clocked onto a site far from home, the page is covered by *This site is a
    trip from home. Is this a trip?* Its words are good and it says what the answer costs. It still takes
    the whole screen before he has seen his job. *(trip-question)*

## 3. The three lenses

### Tools for the job he is working on

**Good.** The day's row changes with the day, which is the right idea. Materials on site carries its count.
On site the job card holds what he needs: place, calendar, materials, photos, the customer, the job window.

**Wrong.** The tools are in four places and none of them is under the job's name at the top. The best seat
on the phone, the pinned 56 px press, belongs to a route he does not drive. Before the job the card does not
say where he is going or with whom. Dead presses take the bar. The day runs Directions, then Photo and
plans, then the report, and the page offers them in the order chrome, squares, buttons, card, bar.

**What I would do.** One job card first, with the name, the place and the partner on it, and the job's tools
in one grid inside it. Each tool says its own state, so the card shows as well as tells: 12 photos, plans
changed Wednesday, 93 boxes. One pinned press that follows his day: Directions before he is there, Photo on
site, Leave report from mid afternoon. Everything not about this job moves below it.

### The story of the work around him

**Good.** The parts exist. Job updates is a true feed. My crew, on the full page, already knows who he
supervised each day and says *with* and the name. Crew Day knows who is where.

**Wrong.** In Job Mode there is no story. The page never names his partner. It does not say what changed
since he last looked. It shows *75% done, no change today* twice and gives him no press to move it, since
the percent press is for subs, helpers and superintendents. The feed is other people's clock punches. What
the company is doing sits five to nine screens down the office's page, between the money and the bids.

**What I would do.** A band called **Around me**, three sentences at most, in plain words: his crew today,
what the office changed on his job, what is coming to it. One line for his week and the next. One line for
the company that opens Crew Day. Clock lines stay out. Whether a lead may set the percent is a rule for the
owner, and I would let him: he is the one standing there.

### Asking him for things the right way

What the page asks him, where, and how:

| The ask | Where it is asked | What is wrong |
|---|---|---|
| A report | Four places, three wordings | Two counts disagree: Your record says one thing, My crew says seven days. Asked on a day not yet worked. The bar's press is dead when it is owed. Never says who reads it. |
| Card charges to put on a job | A 7 on the My spend square | A number with no words. The full page says it in a sentence. |
| A required course | A red line on the job page, every day | Thirty lessons and three hours, no next step, no progress, two optional courses beside it. |
| His crew to rate | Screen 13 of the full page | He never sees it in Job Mode. |
| His truck's mileage | Screen 15 of the full page | Asked 74 days ago. |
| Overdue tasks | The Inbox tab | Fine where it is. Not counted with the rest. |
| Add an icon to the Home Screen | A banner over every page | An ask for the app, ahead of his job. |
| Is this a trip? | A whole screen on clocking on | Good words, wrong size. |
| Hand the phone to the customer | The job card on site | Asked where no customer is. |
| Hours a week, a missed day | Not asked | Right: he is salaried. |
| The percent, a finish date | Not asked | Those reach a superintendent, not him. |

Nine asks. Job Mode shows six of them in four colours and hides three that are his alone. Two counts
disagree about the same thing. Nothing tells him how many there are in all, which one matters today, what
each costs him or what he gets for it.

**What I would do.** One list, **Waiting on me**, with one count. Every ask he has is on it and nowhere
else. Each row is in his words, says what it costs (*a minute each*, *lesson 1 of 30, 6 minutes*) and has one
press. The report row counts days, as My crew does, and says who he was with. The list is short while he is
on site and whole when he is off the clock. The trip question becomes a row on the job card.

## 4. Three shapes

Drawn at phone width beside today's page in `mockup.html`.

| | What he sees | What it costs | What it leaves |
|---|---|---|---|
| **A. Thin it** | Today's page with the job card first, the squares inside it, one waiting list of three, tomorrow in a line, quick buttons at the foot. One screen. | Small. Four or five client PRs, no database change. The short Job Mode page of #384 is most of it and is closed to his role by one line. | No story. The bar still leads with On my way. |
| **B. Three bands** (my pick) | **My job** with six tools in a grid, **Around me** in three sentences, **Waiting on me** as one list with a count, his week in a strip, one door to everything else. 1.6 screens. | Medium. Five or six client PRs. The waiting list gathers five reads that exist. Around me is the new read. | The page is new to him. |
| **C. The page follows the day** | One card and one press that change four times: before work, on site, wrapping up, off the clock. The report is the page for the last hour. | Large. A day rule for a man who never presses the clock, asks held by the hour, the report built into the page. Eight PRs or more. | The page moves under him, and the hour is guessed. |

What moves, what goes behind a door and what is removed is written beside each shape on the mock-up.

## 5. The pick

Build **B**, starting with A's cuts, and borrow one rule from C. A is worth doing whatever is picked and its
PRs are B's first PRs. B is the only shape that answers all three doubts: the tools sit together under the
job's name, the story is three sentences he can take in, and every ask is on one list with one count. C is
the better phone in the end, but it moves the page under a man who barely presses it today, so take only its
safe rule now: the bar's one press follows his day. Decide by the day and not by the person. A day with one
job gets this page. A day with three stops keeps On my way and the route it has now.

### Quick wins, a day's work whichever shape is picked

1. The job card names the job, the place and the partner before the clock is on the job.
2. One report ask. The bar's Leave report opens the day that is owed. Tomorrow's card loses Leave Report.
3. Your record counts reports by day, as My crew does, and says who he was with.
4. In Job Mode the quick buttons sit under the job card.
5. On site, one door for each thing: materials, the painted map, photos, the job window.
6. The bar drops a press that is dead. After the day's only job it stops offering On my way to that job.
7. Training is one line on the job page. The optional courses go behind it.
8. Job updates opens without the clock lines.
9. The card charges are a sentence on the waiting list, where today they are a badge.
10. The install banner can be read in dark, and waits while a job is on.

### The one question

Does the owner want On my way and I'm here from him on a day with one job? His hours come from his schedule
and he pressed it once in two weeks. If not, the pinned press becomes Directions, then Photo, then Leave
report. If so, for the customer's text or the travel stamps, it stays and the page has to ask for it another
way.

Two smaller things for the owner's eye, neither a design call: his role opens the company's receivables,
payables and the Lien desk behind Show full dashboard. And a salaried lead cannot set his job's percent from
Job Mode.

## Where it plugs in

- `src/pages/Dashboard.tsx`: the Job Mode early return and its order of cards.
- `src/components/jobMode/DashboardJobModeCard.tsx`, `JobModeDetailsSection.tsx`, `JobModeTopRow.tsx`,
  `JobModePressBar.tsx`; the rules in `src/lib/jobMode/topRow.ts`, `pressBar.ts` and
  `src/lib/jobModePickCurrentNext.ts`.
- `src/lib/jobMode/jobModeShort.ts` and `shortPageFor` in `src/lib/dashboard/shortDashboard.ts`: the short
  Job Mode page, a superintendent's today.
- `src/lib/dashboardYourRecord.ts`: the waiting list's first source. My crew's reports owed, Rate my crew, My
  Vehicle, the Tally count and Training are the others.
