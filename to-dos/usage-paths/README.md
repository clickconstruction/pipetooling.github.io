---
name: "Usage paths: what people do most, how far each press is, and what to move to the front"
number: 190
group: gated
status: PROPOSED 2026-10-26. Sixty days of the app's own ledgers read as aggregates, twenty-two paths counted in the browser pane and the guides, the moves ordered as three small PRs. Waiting on the owner's go on PR 1 and a morning for the walk.
summary: >
  The owner asked to look at what people are primarily doing, find the actions with many
  clicks and much navigating, and decide which buttons to move up toward the front. This
  to-do measures it from what the app already records: the nav-click ledger, the job
  activity events, the schedule blocks, the clock, Quickfill's marks, the documents that
  went out. The finding is plainer than the ask expected. The office's ten most frequent
  actions are already one to three presses from the Dashboard, because the Pipeline row
  and the Needs you card have been carrying buttons forward all month. The long paths
  left are a job's stage move on a desk (four presses where the phone has two), a person
  onto a job's crew by hand (four), and the field's note, percent and report (a scroll
  and three), which the phone-first to-do already redraws. The biggest gap is not a path
  at all: calls, texts and the Pipeline row's own buttons leave no row, so the count
  cannot see them. The plan is three small PRs, the recorder first, and the walk the
  owner was advised to take, which this to-do narrows but cannot replace.
next: The owner reads part 3 and says go on PR 1 (the recorder) and PR 2 (the row's next move). Then one morning beside an assistant and one beside a tech, counting taps, screens and words retyped, so the slow parts the ledgers cannot see get their number.
size: S as three PRs, XS S S. The walk is two mornings.
blocker: The owner's go on PR 1, and two mornings for the walk.
ver: proposed
opinion: build PR 1 now and PR 2 after it; the rest of the front is already one press, and the counts cannot see the slow parts, so take the walk before moving anything else
mockup: to-dos/usage-paths/mockup.html
---

# Usage paths: what people do most, how far each press is, and what to move to the front (#190)

## The ask

The owner, 2026-10-26, in a holistic look at the app's experience with Claude. The closing
advice of that look was: *walk one real day with an assistant and one with a tech, and count
three things per task: taps, screens crossed, and words retyped. That gives one number per
role to move.* His ask for this to-do, in his words:

> look at what people are primarily doing and use that to estimate what needs to be
> addressed… actions with many clicks and navigating we should be able to identify and
> decide if we should move the buttons up towards the front.

So: measure from what the app already records, find the frequent actions with long paths,
and decide which to move forward. Four parts. What people do most. The path for each. The
moves. Then the argument against it, and the plan changed where the argument wins.

This is a design to-do. Nothing is built. The mock-up is `mockup.html` beside this file;
every person, customer, street, count and amount in it is made up. The counts in this file
are real aggregates by role and surface. No person is named and no customer appears.

## 1. What people do most

### How it was read

Sixty days, 2026-08-27 to 2026-10-26, about 43 working days. Every number is an aggregate
read from prod through the management API's query endpoint, read only, grouped by role and
surface. Digital twins and sample accounts are left out. The roles are folded four ways:
**office** is assistant, master and controller; **tech** is helpers, subs and superintendents
(the masters' field presses are counted with the tech where the row says so); **estimator**
is estimator; **owner** is the dev seat. The dev seat's rows hold the owner and every agent
session that walks the app signed in as the dev, so they are inflated and read last.

Who was there: 4 assistants, 2 masters, 1 controller; 8 helpers, 3 subs, 2 superintendents;
5 estimators; 2 dev accounts. Settings → System → **Usage** (dev only) already shows minutes
by page and role, the control totals from the nav-click ledger, the Needs you presses, the
dock ranking and the quiet pages. It does not show the hour of day, the job activity events,
the schedule blocks, the clock, Quickfill's marks or what went out, so those were read by hand.

| Ledger | What one row is | Rows in 60 days |
|---|---|---|
| `ui_nav_clicks` | a press on instrumented chrome or a named action, with `control`, `target`, `from_path` | 9,145 (plus 28,700 `dispatch_badge_shown` rows, which are not presses) |
| `job_activity_events` | a job's write, by type, with the actor | 3,833 with a person, 290 by the machine |
| `jobs_ledger_thread_notes` | a note on a job | 871 |
| `job_schedule_blocks` | a person on a job for a day | 534 |
| `quickfill_section_mark_events` | a station marked | 854 |
| `clock_sessions` | a clock in and out | 518 |
| `user_app_activity_page_daily` | a person's active minutes on a page, per day | by page below |
| `reports` | a field report | 74 |
| `sent_documents` | a paper that went out, with its kind and how | 97 |
| `email_send_log` | an email the app sent | 1,142 |
| `prospect_comments` | a prospect call logged | 41 |
| `messages` | a line in or out on the Messages spine | 23 |
| `job_pay_applications`, `bridge_calls`, `call_tasks` | a pay app, a Bridge call, a call task | 2, 0, 1 |

### The actions taken most, by role

Each row names the ledger it came from. Presses are the nav-click ledger; writes are the
job activity events and the tables named.

**The office** (assistant, master, controller)

| Action | Rows | From |
|---|---|---|
| A line item added to a job | 1,553 | `fixture_added`; one row per line, so an import from a bid lands many at once |
| Quickfill station marked | 854 | the mark events, one person, 26 stations |
| A job's window opened | 804 | `job_window_opened`: 613 from the Pipeline, 54 from Schedule, 21 from the Dashboard, 16 from AR, 6 from Quickfill, 4 from Materials, 3 from a customer's page |
| A note written on a job | 615 | thread notes |
| A person put on a job for a day | 533 | schedule blocks, one assistant |
| A job's field edited | 364 | `field_edited` |
| A Needs you line pressed | 334 | `needs-you`: 254 from the Dashboard, 65 from Quickfill, 9 from Dispatch mode; the top doors Team purchases 84, Bank deposits 74, Lien notice drafts 34, Returned checks 27, GC review 20, Test reports 14 |
| A job moved to its next stage | 219 | `status_change`; 54 more by the machine |
| A person added to a job's crew | 207 | `crew_added` |
| A bill made | 179 | `invoice_created`; Bill Customer committed 98, all from the Pipeline; 42 sent by a person, 40 by Stripe's run |
| A percent done set | 81 | `job_pct_events` |
| A payment recorded | 80 | `payment_added`; 56 more by the machine |
| A job created | 57 | `job_created`: 37 pressed from the Schedule's picker, 16 from Jobs |
| A dispatch request closed | 44 | `dispatch_request_closed`: 29 from Quickfill's station, 11 from the Dashboard's card |
| A prospect call logged | 41 | `prospect_comments`: 21 answered, 17 no answer |
| An estimate made, and sent | 27, 27 | `estimates` |
| A test report filed, and sent | 16, 12 | `job_test_reports`, `sent_documents` |
| A lien notice emailed, a packet printed | 12, 7 | `sent_documents` |
| A bid created, and sent | 14, 10 | `bids` |
| A text sent to a customer | 2 | `messages` |
| A customer call logged | 2 | `customer_contacts` |

**The tech** (helpers, subs, superintendents; the masters' field rows)

| Action | Rows | From |
|---|---|---|
| Job Mode opened | 498 | `job_mode_enabled`, once per session |
| A bottom tab pressed | 484 | `bottom-tab`: Dashboard 214, My Schedule 216, Inbox 33, Customers 17 |
| Clocked in and out | 244 punched | `clock_sessions`: helpers 187, subs 51, a master 6; 99 more sessions come from a salary schedule and are not pressed |
| A note written on a job | 234 | thread notes: superintendent 207, helpers 20, subs 7 |
| A job opened, read only | 210 | `job_window_opened`: 116 from the Dashboard, 88 from My Schedule |
| A status report filed | 72 | `reports`: superintendent 48, master 14, subs 7, helpers 3; 2 turnaways |
| A percent done set | 55 | `job_pct_events`: superintendent 35, master 12, subs 5, helpers 3 |
| A dispatch request made | 30 | `dispatch_requests`, by a master |
| A job moved on | 17 | `status_change` |
| On my way pressed | 8 | `job_mode_on_my_way`; 4 travel stamps on the clock |
| A test report filed | 5 | `job_test_reports`, by a superintendent |

**The estimator**

| Action | Rows | From |
|---|---|---|
| A bid created | 72 | `bids` |
| The top nav pressed | 401 | Dashboard 198, Bids 174, Messages 20 |
| Clocked in and out | 61 | `clock_sessions` |
| A counts import undone | 17 | `discard_guard_shown` |
| A bid sent | 11 | `bids.bid_date_sent` |
| A bid's outcome set | 4 | `bid_outcome_set` |

**The owner** (the dev seat, which also holds the agents' walks)

| Action | Rows | From |
|---|---|---|
| A clock session approved | 357 | `hours_approved`, all on People: 196 the clock strip's pill, 153 the grid's cell, 5 the queue |
| A job's window opened | 425 | `job_window_opened`, 405 from the Pipeline |
| A job's field edited | 409 | `field_edited`; 358 more rows are `job_renamed_from_work`, a sweep |
| A Needs you line pressed | 93 | Lien notice drafts 15, Bulk deletions 11, GC review 8, Bank deposits 6 |
| A dispatch request made, closed | 21, 6 | `dispatch_requests` |
| A GC statement emailed | 9 | `sent_documents` |
| Hours approved from the Dashboard's card | 0 | none of the 357 came from the Dashboard |

The 1,087 `job-summary-view` rows and the 203 `station_deep_link` rows on the dev seat are a
view's render and the agents' walks, not presses, and are left out above.

### At what hour

Chicago time, presses from the nav-click ledger without the badge noise, and the writes'
most common hour.

| Role | The day's shape | Peak |
|---|---|---|
| Office | 8 AM 237 · 9 AM 515 · 10 AM 425 · 11 AM 600 · noon 545 · 1 PM 515 · 2 PM 441 · 3 PM 423 · 4 PM 218 · 5 PM 75 | 11 AM |
| Quickfill's round | the inbox stations at 9, the money stations at 11; the round runs about 9:30 to 11:30 | 9 to 11 AM |
| Bills made, payments recorded, blocks made | 10 AM to 1 PM, 11 AM, 9 AM | late morning |
| Helpers | 5 AM 17 · 6 AM 53 · 7 AM 114 · 8 AM 100 · 9 AM to 3 PM 40 to 70 · 4 PM 52 · 5 PM 60 · 6 PM 56 · 7 PM 50 | 7 AM and 5 PM |
| The clock | helpers in at 7, out at 5; the office in at 8, out at 4; estimators in at 9 | |
| Superintendent | flat, 16 to 23 presses every hour from 7 AM to 7 PM; reports at 5 PM, notes at 5 PM | none |
| Estimator | 9 AM 50 · 10 AM 81 · 11 AM 70 · 1 PM 39 · 3 PM 54 | 10 AM |
| Owner | 8 AM to 7 PM, and 7 PM to midnight; the night rows hold the agents' walks | 2 PM and 7 PM |

### Which pages are opened most, and which never

Minutes by page over 60 days for everyone but the dev seat, from the activity heartbeat.

| Page | Minutes | People |
|---|---|---|
| Dashboard | 5,732 | 15 |
| Bids → Bid Board | 4,954 | 5 |
| Jobs → Pipeline | 4,117 | 3 |
| Bids → Pricing | 2,005 | 3 |
| Bids → Takeoffs | 1,970 | 4 |
| Schedule Dispatch | 1,860 | 2 |
| Quickfill | 993 | 1 |
| Materials → Supply houses | 881 | 3 |
| Bids → Counts | 314 | 4 |
| Estimates | 263 | 3 |
| Bids → Cover letter | 246 | 3 |
| Prospects → Follow up | 218 | 3 |
| Bids → Waiting to hear | 204 | 2 |
| Dispatch mode | 203 | 3 |
| Bids → Submittals, Job Mode, Messages | 158, 154, 154 | 2, 6, 3 |
| My statement, Customers, Help | 142, 129, 120 | 1, 4, 3 |
| Jobs → Subs, AR, People → Hours, GC | 107, 81, 71, 61 | 1, 1, 1, 2 |

Never opened by anyone but the dev in 60 days, or under five minutes in all: the pages
**Banking** (1 minute), **The Bridge**, **Map**, **Moneyfill**, **Partnerships**, **Punch
list**, **Templates**, **Duplicates**, **Projects**, **Workflows**, **Documents**; the tabs
**Jobs → Billing** (0 minutes, where 98 bills were made on the Pipeline instead), **Reports**,
**Parts**, **Crew P&L**, **Combined labor**, **Work orders**, **Inspections**; **Bids →
Estimators**, the five **Robot** tabs, **Change order**, **Day book**, **Lien release**, **Bid
costs**, **Job accounts**; **People →** every tab but Hours, Users and Vehicles; **Materials →
Purchase orders**, **Assemblies**, **Directory**. Checklist, Calendar, Roadmap and Training
each saw under 15 minutes. Tally saw 38.

### Which Quickfill stations are marked most

854 marks by one person over 39 days. The stations marked on 38 or more of those days:
Assistant Dailys, Schedule, Texts, Physical inbox, Email, Billed Awaiting Payment, People
Hours, Vehicle check-ins, No customer stages, Office Arriving, Undated bills, Supply Houses.
Then Field photos 37, Unassigned field time and Complete no bill 36, Warnings and Office
Leaving 35, GC weekly review 34, Prospects 33. Lower: Dispatch inbox and Job follow-ups 28,
Lost bid reasons 25, Tomorrow's schedule 22, Jobs cleanup 18, Property kinds 13, Needs you 8
(Today's lines, new 2026-10-23). Only Texts, Email and Physical inbox carry a typed note, on
every mark. No mark carries an outcome yet. The quickfill-read-state to-do (#180) audits what
each mark's count says; this one only counts the presses.

### What goes out most

| What | Rows | From |
|---|---|---|
| Emails the app sent, with no kind on the log | 915 | `email_send_log`, the older senders |
| Status reports | 72 | `reports`; 46 recurring report emails by the machine |
| Task reminder emails | 41 | by the machine |
| Bills | 42 sent by a person, 40 by Stripe's run; 34 Stripe bill emails | `jobs_ledger_invoices`, `email_send_log` |
| Test reports | 12 sent; 28 emails with their copies | `sent_documents`, `email_send_log` |
| GC statements | 9 by hand, 22 scheduled | `sent_documents`, `email_send_log` |
| Lien notices | 12 emailed, 7 packets printed, 12 filing notices | `sent_documents`, `email_send_log` |
| Estimates | 27 sent, 10 emailed through the new sender, 5 resent | `estimates`, `sent_documents` |
| Contracts for signature | 7 | `email_send_log` |
| Texts to customers | 6 | `messages` |
| Pay applications | 2 | `job_pay_applications` |

### What is not recorded at all

An action with no row is invisible to this method. These are the ones that are surely common
and leave nothing:

- **A phone call.** The Call button on seven sites (v2.5803) is a `tel:` link and writes no
  row. Sixty days hold 2 customer call logs, 41 prospect call logs and 1 call task, for a
  company that calls all day.
- **A text from Quo's own app or a personal phone.** The Messages spine holds 6 texts out.
  The morning run's sends and the thread's Send land there; nothing else does.
- **An email written in Gmail.** The Email station counts labels, not sends. The 915 untyped
  rows on the log are the app's senders, not a person's.
- **A press on the Pipeline row's own buttons.** Call, Assign work, Send to Dispatch, Share,
  the speech bubble, the % box, the Edit door: none writes a row. Only the window's open, the
  bill and the test report do. The row is where the office lives, and the ledger is blind to it.
- **A look.** A row read and left, a window opened to check one fact. The window's open is the
  only read that is recorded.
- **A line item typed by hand against one imported.** Both are a `fixture_added` row.
- **A search typed.** The magnifier, the # jump chip and the Pipeline's search box write nothing.
- **A photo filed to Drive**, a print, a Settings change, a Quickfill *Open now* peek, Dispatch
  mode's Assign work, a PO raised, a supply-house bill marked paid. Not counted here.

**The one line that would record them.** The nav-click helper already resolves a press inside
any container marked `data-navtrack` to one row, but only for `<a href>` links. Extend
`resolveNavClick` in `src/lib/navClickTelemetry.ts` to take a `button[aria-label]` too, with
the label as the target, and mark two containers: the Pipeline row's action stack
(`StagesRowActionButtons.tsx`) and the job window's action bar (`JobWindowActionBar.tsx`).
Every press on either then writes `control: pipeline-row` or `job-window` and the button's
own words. The Call button's seven sites call `recordNavClick(userId, role, 'call_pressed',
'#surface=<site>')` on the press. That is PR 1.

## 2. The path for each

The start of the day: the Dashboard on a desk for the office, the owner and the estimator;
the Job Mode card, which is the Dashboard on a phone, for a tech. A press is a click or a tap.
Typed is a field a person fills. Screens crossed counts pages and windows, not tabs inside a
window. The office paths were counted in the browser pane as the dev on 2026-10-26 at 1280
wide and at 375 wide, reading the controls and pressing only what reads; the tech paths are
the phone-first to-do's counts, checked against the guide *clock in and out with Job Mode*.
The score is rows in 60 days times presses from the start.

| # | Action | Who | In 60 days | Presses | Screens | Typed | Already on more than one surface | Score |
|---|---|---|---|---|---|---|---|---|
| 1 | Add a line item to a job | office | 1,553 | 4: Jobs, Open job, Bill, Add a new line item row | 2 | 3: name, count, price | the row's *no price yet* chip lands on ① Line Items in 2 | 6,212, but one import lands many rows in one press |
| 2 | Write a note on a job | office | 615 | 3: Jobs, Add a note on the row, Post | 1 | 1 | the window's Add a note; the phone bar's Note | 1,845 |
| 3 | Open a job's window | office | 804 | 2: Jobs, the row | 1 | 0 | seven surfaces; the magnifier is 2 and a typed name | 1,608 |
| 4 | Put a person on a job for a day | office | 533 | 3: Schedule, the cell's +, pick the job | 1 | 1: the filter | the row's Assign work; Dispatch mode's ⚡ Assign work | 1,599 |
| 5 | Edit a job's field | office | 364 | 3: Jobs, Open the Edit tab on the row, the field's ✎ | 2 | 1 | the window's Edit tab | 1,092 |
| 6 | Approve a clock session | owner | 357 | 3: People, the strip's pill, confirm | 1 | 0 | nine surfaces can; the Dashboard's My Team card has Approve and Approve all, pressed 0 times | 1,071 |
| 7 | Clock in and clock out | tech | 244 sessions | 2 in: Clock In or On my way, confirm; 2 out: Clock out, the note | 0 | 1: the note | one card | 976 |
| 8 | Move a job to its next stage | office | 219 | 4: Jobs, Open job, Move to Working, confirm | 2 | 0 | the phone's swipe is 2; Ready to bill → Billed is the row's Bill Customer | 876 |
| 9 | Mark a Quickfill station | office | 854 | 1 per card after Quickfill once: Done or Worked it | 1 | 0 | one surface | 854 and 43 |
| 10 | Add a person to a job's crew | office | 207 | 4: Jobs, Open job, Edit, Edit Team, pick | 2 | 1: the filter | the window only by hand; a block placed from the job's own week grid adds the person, and the clock's sync adds whoever clocked in there, so the by-hand share of the 207 is unknown | 828 |
| 11 | Make a bill | office | 179 | 4: Jobs, Bill Customer on the row, Make a bill, Send | 2 | 0, or 1 for a part | the window's Bill tab | 716 |
| 12 | Write a note on a job | tech | 234 | 2 and a scroll: the job, scroll to the box, Post | 1 | 1 | the Dashboard's job row and My Schedule | 468 and a scroll |
| 13 | Open a job from the field | tech | 210 | 2: My Schedule, the job | 1 | 0 | My Schedule and the Dashboard's Today | 420 |
| 14 | Press a Needs you line | office | 334 | 1 | 0 | 0 | the Dashboard, Quickfill's Today's lines, Dispatch mode's inbox | 334 |
| 15 | Set a job's percent done | office 81, tech 55 | 136 | office 2: Jobs, the row's % box; tech a scroll and 3 | 1 | 1 | the Quickfill station, the window's Set % complete, the row's box | 162 and 165 |
| 16 | Create a job | office | 57 | 4: Schedule, the cell's +, Create new job, Create Job | 2 | 4: name, address, customer, kind | Jobs → New job is 3 | 228 |
| 17 | File a status report | tech | 72 | 3: Leave Report, Save, confirm | 1 | 2 | one card | 216 |
| 18 | Create a bid | estimator | 72 | 3: Bids, New Bid, Save | 2 | 6 | one surface | 216 |
| 19 | Record a payment | office | 80 | 2 for a deposit: the Needs you line, match; 5 for a check on the window | 1 or 2 | 0 or 2 | two surfaces | 240 |
| 20 | Log a prospect call | office | 41 | 3: Prospects, Answered or Didn't Answer, Next | 1 | 0 or 1 | the deck | 123 |
| 21 | Close a dispatch request | office | 44 | 2: the Teams Inbox card's note and close; 3 from Quickfill's station | 0 or 1 | 1 | three surfaces | 110 |
| 22 | Make a dispatch request | tech lead | 30 | 2: Task Dispatch in the header, Send | 1 | 1 | the header on every page | 60 |

Below the line, under 30 rows each: an estimate made and sent (4 presses and 4 typed), a test
report sent from the Needs you line (3), a lien notice approved and sent from the Needs you
line (3), a text to a customer from Messages (3 and typed, 6 in 60 days). The Pipeline's row
holds 27 controls at 1280 wide, so *one press after Jobs* is the honest count for everything
the row carries.

## 3. The moves

Three answers per action: **move it forward**, **keep**, or **already one press**. Grouped by
the surface the move lands on, so one PR carries a surface. Where another session is drawing
the move today, it is named and not drawn again.

### The Pipeline row, on a desk

- **Move a job to its next stage (row 8) · move it forward.** Today the desk row has *Send
  Job Back* and *Bill Customer* and nothing for Waiting → Working or Working → Ready to bill;
  those live on the window's Status chips, four presses from the Dashboard. The phone already
  has the move at two presses: swipe the row, confirm. The move is the phone's button drawn
  on the desk row's action stack, in the phone's own words: **Move to Working ✓** on a Waiting
  row, **Ready to bill ✓** on a Working row, with the same confirm sheet and the same line under
  the title about the money, the agreement and the block it leaves. Four presses become two,
  219 times in 60 days. Cost S: the swipe's confirm already exists; the row draws one more
  button and the stack is already 27 wide, so it goes where *Send Job Back* sits and that one
  folds under the ⋯ when the row is narrower than 1100 px. PR 2.
- **A person onto a job's crew by hand (row 10) · move it forward, small.** The Edit tab's
  Team row is four presses. The row's crew chip (*Crew on Ridgeway Builders · open hours by
  person*) opens hours; a **+** at its end opens the same Team picker in place. Four become
  two. But a block placed from the job's week grid adds the person already, and the clock's
  sync (`sync_crew_jobs_from_clock`) adds whoever clocked in on the job, so the by-hand
  count is a remainder the ledger cannot size. Cost S. PR 3, and only if PR 1's rows say
  the window's Team row is still pressed daily.
- **Add a line item (row 1), a note (row 2), open the window (row 3), bill (row 11), edit a
  field (row 5), set the percent (row 15) · already one press after Jobs.** The row carries
  each: the *no price yet* chip, Add a note, the job name, Bill Customer, the Edit door, the
  % box. The press count that is left is the form's: the line's three fields, the bill's
  amount. Nothing to move.
- **Open a job by name · keep, and name go-anywhere (#181).** Two presses and a typed name
  from any page, today. The go-anywhere to-do widens the same box to pages, Settings cards,
  guides and windows; a job's path does not change.

### The Dashboard

- **The morning's first press · name needs-me-rail (#178).** The office pressed the top
  nav's *Dashboard* 799 times in 60 days, 20 a day, more than any other page: it is the hub
  they return to between tasks, for the Needs you card, the Teams Inbox and the clock strip.
  That to-do's pick B gives the round card a **Start ›** and makes Messages a station, so the
  first press is drawn once. Not drawn again here.
- **Press a Needs you line (row 14), record a bank deposit (row 19), send a test report, send
  a lien notice, close a dispatch request (row 21) · already one press.** Each is a line on
  the card with its door. Keep.
- **Approve hours (row 6) · already one press, and unused.** The Dashboard's My Team card
  carries Approve per session and Approve all, and 0 of 357 approvals came from it; all 357
  came from the People page, one session at a time, 196 from the clock strip's pill and 153
  from the grid's cell. The pill shows the job and the hours beside the name; the Dashboard's
  card lists sessions. Nothing to move. The question for the walk is why the pill wins.
- **Make a bill from the Dashboard · keep.** A *Ready to bill · 3 · $215* line with the Bill
  Customer window as its door would save one press, four to three, on four bills a day, and
  the card already holds eleven lines. Rejected in part 4.

### Quickfill

- **Mark a station (row 9) · already one press.** The Roller's Done and Worked it. The round
  itself is 22 presses a day plus the reading; the reading is the work and no button shortens
  it. The quickfill-read-state to-do (#180) is about what the count says, not the press.

### Job Mode and the phone

- **Clock in and out (row 7), the note (row 12), the percent (row 15), the report (row 17),
  On my way · name phone-first.** That to-do's mock-up counts each: clock in 2 presses stays
  2 at the thumb; the report with a photo goes from not possible to 1 press, 2 chips and
  Save; the percent from a scroll and 3 presses to 2; the note from 2 and a scroll to 2 at the
  thumb; clock out from 2 and a typed note to 1 with the note prefilled from the day's
  reports. Those are the field's five screens and they are drawn there. Not drawn again.
- **Open a job from the field (row 13) · already one press** after the My Schedule tab, and on
  the Dashboard's Today list. Keep.
- **Make a dispatch request (row 22) · already one press.** *Task Dispatch* sits in the header
  on every page. Keep.

### Schedule Dispatch

- **Put a person on a job (row 4), create a job (row 16) · keep.** Three presses and a typed
  filter, 13 times a day, and the grid is the only place the week is in view, which is what
  placing a block needs. The office creates most new jobs from the cell's picker (37 of 57),
  which already offers *Create new job*; the cost is the form's four typed fields, not the
  presses. The Pipeline row's Assign work and Dispatch mode's ⚡ are the same picker. Nothing
  to move.

### Bids, Estimates, Prospects

- **Create a bid (row 18), an estimate, log a prospect call (row 20) · keep.** Three or four
  presses and the form. The deck already deals one prospect at a time with the outcome
  buttons under the number. Nothing to move.

### The recorder

- **PR 1 · record what the row and the Call button do.** The one line from part 1: buttons
  inside a `data-navtrack` container write a row, the Pipeline row's stack and the window's
  action bar are marked, the Call button's seven sites write `call_pressed`. XS. It ships
  first because PR 2 and PR 3 are sized on counts this ledger cannot yet give, and because
  the next time this question is asked, the row's own buttons should answer it.

### The order

| PR | Lands on | Size | What it changes |
|---|---|---|---|
| 1 | the recorder | XS | `resolveNavClick` takes a labelled button; two containers marked; `call_pressed` on seven sites; a Usage panel row for `row-action` |
| 2 | the Pipeline row | S | the next-move button on the desk row, the phone's confirm sheet reused |
| 3 | the Pipeline row | S | **+** on the crew chip opens the Team picker in place; only after PR 1's rows say the Team row is still pressed daily |

The named sessions' PRs run on their own: #178 the first press, #181 the box, the
phone-first to-do the field's five screens.

## 4. Is this the best we can do?

Argued against, and the plan changed where the argument wins.

**Counts measure what the app records, not what people struggle with.** A row is a write.
The slow parts of a day are reads and forms: the hundred-row Pipeline scrolled to find the
job, the New Job form's four fields typed from an email, the bill's amount worked out from a
draw, the takeoff's hours. None of those is a row, so none of them scores. The highest score
in part 2 is a line item at four presses, and the four presses are not the cost; the three
typed fields are, and the ledger cannot tell a typed line from an imported one. *This wins.*
The recorder goes first, and part 2's scores are read as a floor, not a ranking of pain.

**A button moved forward crowds the front for everyone else.** The Pipeline row already
carries 27 controls at 1280 wide; the Needs you card eleven lines; the Roller 26 stations.
Every button moved forward costs every other press a few pixels and the first-timer one more
thing to read. *This wins against the Dashboard's Ready to bill line*, which would save one
press four times a day on a card everyone reads. It does not win against the row's next-move
button, which replaces a press the phone already made cheap and sits where *Send Job Back*
already sits.

**Frequent is not the same as slow.** The office's ten most frequent actions are one to
three presses from the Dashboard today, because the row, the card and the Roller have been
carrying buttons forward all month: the customer's speech bubble on every row, the Call button
on seven sites, the Lien and Legal desks on the stage bar, Quickfill's Today's lines mirroring
the card. The long paths left are rare: a lien notice, a contract, a GC statement, a pay app,
each a few a month, and their cost is the reading, not the walking. *This wins in part*: the
plan is three small PRs, not a redesign of the front.

**The walk this replaces, and what it would still catch.** The owner was advised to walk one
real day with an assistant and one with a tech and count taps, screens and words retyped per
task. This to-do counts taps and screens from the ledgers and the browser, and it cannot count
words retyped at all. The walk would catch: a call made on a personal phone and then typed
into a note; a text sent from Quo's app and then the thread opened to see it; the Pipeline
kept open in a browser tab all day, which makes the 799 Dashboard presses tab switches and not
navigation; an address typed from an email into the New Job form, then into the schedule's
filter; a superintendent's 207 notes typed on a truck at 5 PM, and whether the phone bar's Note
would be pressed there; why the owner approves hours one pill at a time on People when the
Dashboard's card approves all in one. None of those is in any ledger. *This wins.* The walk is
the next step after PR 1, not something this to-do closes, and it carries the fourth count
the ledgers cannot: words retyped.

**Where the argument does not win.** The ledgers do say three things the walk would take a
week to notice: the Billing tab had 0 minutes in 60 days while 98 bills were made on the
Pipeline, so the Pipeline is the billing surface and the tab can go; the dispatch requests
are closed from Quickfill's station (29) more than the Dashboard's card (11); and the field
opens a job from the Dashboard's Today list (116) more than from My Schedule (88). Those stay.

## Decisions

1. **PR 1, the recorder** · build now. XS, no schema change, and every later count rides on it.
2. **PR 2, the row's next move on a desk** · build, or keep the window's Status chips as the
   only desk path. Recommended: build. The phone made it two presses; the desk should match.
3. **PR 3, the crew chip's +** · wait for PR 1's rows, then build only if the Team row is
   pressed daily by hand.
4. **The walk** · two mornings, one beside an assistant and one beside a tech, the three counts
   per task, in a notes file in this folder. Who takes it and which mornings.
5. **The Billing tab** · 0 minutes in 60 days. Retire it, or leave it as the audit view the
   guide *audit job bills on the Billing tab* describes.

## Where it plugs in

- **The recorder**: `src/lib/navClickTelemetry.ts` (`resolveNavClick`, `recordNavClickFromEvent`),
  `data-navtrack` on `src/components/jobs/StagesRowActionButtons.tsx` and
  `src/components/jobs/JobWindowActionBar.tsx`, the Call button's sites (v2.5803), and
  `controlLabel` in `src/lib/usageDashboard.ts` so Settings → Usage names the two new controls.
- **The row's next move**: the stage move the phone's swipe runs (`StagesCardMoreActionsSheet.tsx`
  and the confirm it opens), drawn as a button in `StagesRowActionButtons.tsx`; the words and
  the money line are the phone's.
- **The crew chip's +**: the Team picker the Edit tab's *Edit Team* row opens (`JobFormEditFactRows.tsx`),
  opened in place from the row's crew chip.
- **The ledgers read**: the tables in part 1, each read through `scripts/check-migration-drift.mjs`'s
  endpoint, read only. Settings → Usage's four RPCs in
  `supabase/migrations/20260826161242_usage_dashboard_rpcs.sql` cover the pages and the clicks;
  an hour-of-day reader and a job-events reader would let the Usage tab show parts 1 and 2 itself.
- **The sibling to-dos**: `to-dos/needs-me-rail/` (#178), `to-dos/go-anywhere/` (#181),
  `to-dos/phone-first/`, `to-dos/quickfill-read-state/` (#180).

## How to verify

PR 1: on the Pipeline as the dev, press Call, Assign work and the speech bubble on one row,
open the window and press Share; Settings → Usage → the control totals show `pipeline-row` and
`job-window` with those words as targets, and `call_pressed` with the site. PR 2: on a
Waiting row at 1280 wide, **Move to Working ✓** sits beside Send Job Back; a press opens the
phone's confirm with the money line; Not yet closes it and nothing moves; under 1100 wide the
button is in the ⋯. PR 3: the crew chip's **+** opens the Team picker in place; Escape closes
it; the Edit tab's Team row still works. Nothing in this to-do was pressed live; every count
in part 2 was read from the controls, not written.

## Where it stands

| What | PR | State |
|---|---|---|
| Proposal and mock-up | this PR | drafted 2026-10-26; waiting on the owner's go |
| PR 1 · the recorder | v2.5904 | built 2026-10-26: `resolveNavClick` reads a `tel:` link and a labelled button, the Pipeline's rows and the job window's header row and phone bar are marked, both Call buttons take a `site`, Settings → Usage names the three controls |
| PR 2 · the row's next move | | not started |
| PR 3 · the crew chip's + | | not started, gated on PR 1's rows |
| The walk | | not taken |
