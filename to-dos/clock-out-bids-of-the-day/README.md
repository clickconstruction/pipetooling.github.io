---
name: "Clock out: the bids of the day"
number: 445
group: gated
status: asked 2026-11-25 · the traces read in the code and counted on prod the same day · mock-up drawn with three ways and a pick · the owner's first look the same day, one line shape for every row · nothing is built
summary: >
  An estimator works one bid at a time, and the app already records most of that work without being asked.
  This card reads those records into a list at clock out: the bids the person worked on today, with nothing
  to type. The person takes one off or adds one the app missed in one press. Step 1 needs no new table. The
  later steps add one small beat so the list also holds bids a person read and did not change.
next: The owner looks at `mockup.html` and answers the six calls. Then build step 1, which needs no migration.
ask: owner · decide · Open the mock-up, then answer the six calls on the card. Is the pick the one to build?
size: L as a train of six (S · M · M · S · S · M)
blocker: The owner's look at the mock-up and the six calls. Steps 2 and 3 each owe a migration and its push.
opinion: build step 1 now — it reads what the app already keeps and takes the typing away on most days
---

# Clock out: the bids of the day (#445)

The repo is public. Every bid, job number, time and count in `mockup.html` is made up. The counts in this
card are real counts with no name beside them. The two people measured are called **E1** and **A1**.

## The ask

Asked by the owner on 2026-11-25, in the owner's words:

> Right now people who are estimators spend almost all their time in the app focused on one bid at a time.
> I don't think it's unreasonable for us to use the app and what's already available to measure what bids
> they work on throughout a given day. Would you be able to help me look at what we have and how well we
> can measure that? The immediate effect of this is that when a user goes to clock out, we can list the jobs
> that they worked on that day, but just by reading the app and not having to have them type in or clock in
> and out of them. Take a look, let me know what we have and let me know what you think we can add and then
> come up with a plan and a mock-up of what the before and after could look like

This pass read and measured. It built nothing and wrote nothing on prod.

## The short answer

- **The app already knows which bids a person changed.** The bid history ledger from #73 writes one row
  for every change on a bid, with the person and the time. It has run since 2026-10-08.
- **The app already counts minutes on the Bids page.** A beat goes out every 60 seconds a tab is in
  front. It names the tab, such as Bids · Pricing. It does not name the bid.
- **The open bid is already in the address** (`/bids?tab=pricing&bidId=…`), at the place the beat is sent
  from. So naming the bid in the beat is a small change.
- **"These are the bids you worked on today" is a claim we can make now.** "About this long on each" is
  a much weaker claim, today and after the build.

## What we have

Every trace a person leaves on a bid without being asked. *Proves* is the most a row can show.

| Trace | Proves | Written when | For whom | Names the bid |
|---|---|---|---|---|
| `bid_changes`, the bid history ledger (#73) | changed | By a trigger on every insert, change or delete on the 18 tables a person types into on a bid. Kept three years. | Everyone who writes a bid. Robots and cron write with no author. | Yes |
| `user_app_activity_page_daily`, the app-time beat | page in front | Every 60 seconds a tab is visible, plus the part minute on leaving. One row a person, a day and a page. | Every signed-in role. Held under View as. | No. It keeps the page and tab only. |
| `ui_nav_clicks`, the usage log | pressed a nav control | One row a press on the top bar, the icon cluster, the phone menu and a few named events. | Every signed-in role. Only a dev reads it. | No. It drops the query string, so a press on a bid reads `/bids`. |
| `clock_sessions.bid_id` | clocked onto one bid | When the person picks a bid at clock in, at **Update Focus** or at clock out. | Anyone with a clock. | Yes, one bid a session. |
| `bids_submission_entries` | changed | A note or a contact logged on Submission & Followup. | Staff, and twins through their own seat. | Yes |
| `bid_rfqs`, `bid_quotes`, `bid_count_sources`, `bid_best_efforts`, `bid_audit_notes`, `bid_version_sends` | changed | When a price is asked, a quote lands, counts are imported, a note is left or a bid is sent. | Staff | Yes |
| `bid_plan_sets`, `bid_photos`, `bid_submittals`, `bids_rfis`, `bid_working_board_placements` and about thirty more tables with a bid, a person and a time | changed | On their own press. | Staff | Yes |
| `user_bid_notes_read_state` | looked | When a Bid Board row is opened or a bid is picked on Submission & Followup. It keeps the latest time only. | The person's own rows. | Yes, but one time a bid, not a history. |
| The Labor tab's own sync | opened Labor | On opening Labor when the book or the counts differ. It lands in the ledger marked as the app's own write. | Whoever opened the tab. | Yes |
| The estimator inbox, `estimator_requests` | asked or closed | When a request is made, called or closed. The inbox is shared, with no addressee. | Staff | Yes, when the request is on a bid. |
| Mail tagged to a bid, `email_tag_threads` and `messages` | tagged | When a person tags a thread, or the app places one from their Sent mail. | The mailbox's owner. | Yes |
| CountTooling | nothing while the person is in it | It is a separate app and database. Its work comes back as an import of counts, a link on the bid and a plans export. | The person who imports. | Only at the import. |
| The twins, `twin_runs` | worked, with a start and an end | The twin's own heartbeat extends one row a mission. | Twins only. | Yes |

Nothing records that a person opened a bid or read it. That is the first hole.

**Do the twins count?** They are estimators by role and their work on a bid is logged better than a
person's: `twin_runs` holds the bid, the start and the end. They have no clock and no clock out. So they
stay out of this list. A lead's view of a bid's day can show a twin's run beside the people later.

## How well it measures

Counted through the dev seat on 2026-11-25. The window is 2026-10-08 to 2026-11-24, the life of the
ledger. Days are the company's days.

**Who estimates.** Three accounts hold the estimator role and are not twins. One is in daily use, **E1**.
A second person, **A1**, holds an office role and does as much bid work: 98% of A1's app time is on Bids.
So the list should follow the work, not the role. Five twins hold the estimator role.

**The ledger.** 13,257 rows. E1 wrote 4,763 and A1 wrote 4,776. A dev wrote 842. 2,754 carry no author,
and 2,610 of those are a robot's paste.

**Person-days each trace exists on.**

| On a clocked day | E1 (28 days) | A1 (25 days) |
|---|---|---|
| A bid change in the ledger | 18 | 24 |
| An app-time row | 25 | 25 |
| Time on the Bids page | 23 | 25 |
| A usage-log row | 26 | 25 |
| A usage-log row that names a bid | 0 | 0 |
| A clock session put on a bid | 0 | 0 |

No bid change fell outside a clocked day for either person.

**Bids touched in a day.** The median is 3.5 for E1 and 4 for A1. The range is 1 to 11. Of 161 bid-days
in the ledger, 57 are a touch of one or two changes, such as a date set down a list of bids. 11 held an
hour or more of steady edits.

**The smaller traces add little.** Notes, price requests, imports and sends add 23 bid-days on top of the
ledger's 161. They add no person-day: every day they cover, the ledger covers too.

**How much of the clocked day falls between the traces.**

| Share of the clocked day | E1 median | A1 median |
|---|---|---|
| Between the first and the last bid change | 45% | 78% |
| In a quarter hour that holds a bid change | 23% | 43% |
| That a change can vouch for, at ten minutes a change | 19% | 39% |
| With the Bids page in front | 42% | 85% |
| Longest stretch with no bid change | 108 minutes | 110 minutes |

**Where the Bids time goes.** Over half is on the Bid Board tab: 51% for E1 and 59% for A1. The other
half is on tabs that need a bid open: Pricing, Takeoffs, Counts and Cover Letter.

**The clock itself.** 203 clock sessions were ever put on a bid. The last was in August 2026. In this
window every session of E1 and A1 sits on a job row, nearly always the same one. Both type the required
note. E1's note has a median of one word. A1's has a median of 19 words, about three items.

## What can be claimed

| Claim | Today | After the build | Why |
|---|---|---|---|
| These are the bids you changed today | High | High | A trigger writes it. It cannot miss a change on its 18 tables. |
| These are all the bids you worked on today | Medium | Medium to high | Today it misses a bid that was read and not changed. The beat closes that. Work outside the app stays out until the person adds it. |
| About this long on each | Low | Medium at best | A change vouches for a fifth to two fifths of the day. The beat adds the time a bid was open. It cannot see a call, a set of plans or CountTooling. |
| This is how the day's hours split across bids | No | No | Too much of the day is out of sight. A split would be a guess with a decimal point. |

## A made-up day

The shape is real. The names and times are invented.

A person clocks in at 7:02 and out at 2:38, one session of 7 hours 36 minutes.

- 7:34. One change on *B420 · ZZ Test Lakeside Dental*: a follow-up date.
- 7:40 to 10:30. 45 changes on *B412 · ZZ Test Ridgeway Clinic*, on Takeoffs and Pricing.
- 10:40 to 12:35. 181 changes on *B398 · ZZ Test Harbor Lofts*, on Pricing and Cover Letter.
- 1:05 to 1:35. Six changes on *B377 · ZZ Test Cedar Row Homes*, which is now job J1007.
- Two more bids were opened for a few minutes each and nothing changed.
- The beat reads 4 hours 10 minutes on Pricing, 3 hours 27 minutes on the Bid Board and 57 minutes on
  Takeoffs. That adds up to more than the clocked day.

What the app can say today: four bids were changed, two of them for most of the morning. What it cannot
say: which bids the two short opens were, and what the 3 hours 27 minutes on the Bid Board went to. The
beat's total passes the clock because a tab left in front on a second screen keeps counting.

## The holes

1. **A bid that was read and not changed.** No row is written. On four of E1's clocked days the Bids
   page was in front for up to 3.7 hours and no bid changed.
2. **The Bid Board.** Over half the Bids time is there, with no bid in the address.
3. **A parked tab.** The beat counts while the tab is visible, not while the person is working. A board
   left open on one screen counts while a takeoff runs on another.
4. **CountTooling.** The takeoff happens in another app. This database sees only the import.
5. **Work outside any app.** A call, a site walk, a set of plans on paper, mail.
6. **Two tabs or two devices.** Each visible tab sends its own beat. Two bids open in two windows both
   count. The app cannot tell which one the person is on.
7. **The day line.** The beat keeps the UTC day. Work after 6 pm lands on the next day. E1 made 1,050 of
   4,763 changes after 6 pm.
8. **The beat can fail quietly.** It never retries. One day holds 156 changes and no app-time row.

## The clock out as it is

One component draws it for every role: `src/components/ClockInOutButton.tsx`. It is the same window on a
phone and on a desktop, a centred sheet at most 480 px wide.

- The title is **Clock out**.
- **What did you work on?** is a note, and it is required. **Complete clock out** is dead until it holds
  a word. For a field tech the day's reports fill it since #189. For an estimator nothing fills it.
- **What Job or Bid were you working on?** takes one job or one bid for the whole session. It offers the
  day's scheduled jobs, the bids on the person's Working board, a search and the last pick.
- On a phone the clock is one line: **Clocked in**, the time, **Focus** and **Clock out**.
- **A salaried person with a schedule sees no Clock In and no Clock Out.** Their sessions are made from
  the schedule. The Dashboard shows them the My Time card instead.

**Bids or jobs?** The owner said jobs. An estimator's unit is a bid, so the list holds bids. A bid that
became a job keeps its bid name and shows the job number beside it, as *B377 · ZZ Test Cedar Row Homes*
with a **J1007** chip. An estimator cannot read most job rows, so the bid's name is the one they know.

## What we add, smallest first

1. **Read what is there.** A kernel reads the person's own ledger rows and the smaller traces for the
   day and lists the bids. The clock-out note fills from it, as it fills from reports for a tech.
   *Cost:* client code only. *Proves:* nothing new, it shows what the ledger holds. *Risk:* the read
   filters the ledger by person and day, and the ledger's one index is by bid. It is 13,000 rows now and
   grows by about 8,000 a month, so the read is fine for a year and wants an index in step 2.
2. **The beat names the bid.** The same 60-second call carries the bid from the address, and counts only
   while the person has pressed, typed or scrolled in the last five minutes. It writes one row a person,
   a day and a bid, on the company's day. *Cost:* one table, one function changed, about ten rows a
   person a day, no new request. The ledger's new index is built `CONCURRENTLY`, as its table comment asks. *Proves:* a bid was open and in use, with no change needed. *Risk:* it
   is a new measure of a person, so who reads it is call 4.
3. **The list, with corrections.** The sheet draws the pick: two shelves, **Take off**, **Add** and the
   board's bids as chips. The press saves the list the person left. *Cost:* one table for the kept list,
   the sheet's new section. *Proves:* the person saw the list and let it stand or changed it.
   *Risk:* a press is not proof of a read.
4. **The Bid Board says which bid.** An opened row or a bid's window on the board sets the bid in front.
   *Cost:* client code. *Proves:* part of the board's hours. *Risk:* a board is often scanned, not
   worked, so a scan must not count as a bid.
5. **A place for a person with no clock out.** The same list on the My Time card, for a salaried person
   and for a day the sheet was never opened. *Cost:* client code.
6. **CountTooling sends the same beat.** Its project already links to the bid. *Cost:* a change in the
   other app and a door for it here. *Proves:* takeoff time, the largest piece still unseen. *Risk:* two
   apps and one beat, so the day could count twice.

**How it feels to be measured.** The list is a thing a person confirms about their own day. It is not a
stopwatch. So the pick shows a rounded size, no count of changes and no total against the clock. It says
the sizes are rough. It lets the person take a bid off with no reason asked. It never blocks clock out.

## The mock-up and the pass

`mockup.html` draws the clock out as it is today beside three ways to change it, then the pick. It has a
**Width** switch for phone and desktop and a **The day** switch for a usual day, a day of small touches
and a day the app saw nothing. The rows and buttons work.

- **A, the note writes itself.** The smallest. A correction is typing, and nothing can count a note.
- **B, a list with the minutes.** One row a bid and a tick to take one off. The minutes and change counts
  read like a stopwatch, and the app cannot stand behind them.
- **C, the day as a strip.** The shape of the day at a glance. The grey reads as time not worked, and most
  of it is work the app cannot see.

**Is this the best we can do?** No. Each gets one thing right. The pick keeps those:

- Two shelves. **Bids you worked on today** holds bids the person changed. **Opened, nothing changed**
  holds the rest, each with one **Add** press.
- Every row's line reads the same way: the size, then the tab, as **2 hours · Pricing** or
  **5 minutes · Counts**. The size is rounded, and one line under the list says the sizes are rough.
- **Take off** leaves the row in place, struck through, with **Put back**.
- **Add a bid the app missed** offers the bids on the person's board as one-press chips, then the search
  the sheet already has.
- **Complete clock out** is live the moment the list holds one bid, and says the count. The note becomes
  **Anything else?** and can stay empty.
- On a day the app saw nothing the sheet says so, offers the board's bids and asks for the note.

**What is still weak.** A press on **Complete clock out** does not prove the person read the list. Time
in CountTooling stays unseen until step 6. The rough sizes can still be wrong on a day with two windows
open.

## The owner's look

2026-11-25, on the pick, in the owner's words:

> Your pick isn't too bad. I'd think that we could do a better job standardizing what lines are showing. So
> instead of saying open about five minutes We can remove the words open about.

What changed in `mockup.html` the same day:

- **One line shape for every row, on both shelves: the size, then the tab.** A worked bid reads
  **3 hours · Takeoffs and Pricing**. An opened bid reads **5 minutes · Counts**. The words *Open about*
  and *About* are gone.
- **The tab is always a tab's name.** A line no longer names the act, such as a date that was set.
- **The size is always a number.** *A few minutes* is gone. A size is rounded to the minute under ten
  minutes, to five minutes under an hour and to the half hour above that.
- A bid added from the lower shelf keeps its own line. A bid the app never saw reads *Added by you*.

The six calls below are not answered yet.

## The calls

Six calls for the owner, each with a pick.

1. **Which way?** *Pick: the pick in the mock-up, the list with two shelves.* Step 1 ships way A first,
   since it needs no table, and step 3 replaces it.
2. **Bids or jobs in the list?** *Pick: bids. A bid that became a job shows its job number beside it.*
3. **Does the list show a size?** *Pick: yes, rounded, and only once step 2 is live. No total against the
   clock.*
4. **Who sees it?** Today the clock-out note is read by the person, the office and anyone with payroll
   access. The app-time beat is read by the person, a dev, the owner and anyone the owner grants
   (`docs/ACCESS_CONTROL.md`, the People page's Activity tab). *Pick: split it the same way. The list the
   person kept rides with the clock session, so whoever approves the hours reads it. The beat's rows
   under it follow the Activity tab's rule and go no wider.*
5. **Who gets the list?** *Pick: anyone whose day held a bid, by the work and not by the role.* Half of
   the bid work measured was done from an office role.
6. **Do the hours split across the bids?** A session takes one job or one bid today, and bid labor cost
   reads it. *Pick: no. The list is saved beside the session and the session stays as punched.* The
   sizes are too rough to turn into cost.

## Where it plugs in

What exists:

- The ledger: `bid_changes`, written by `record_bid_change()` (`20261007040000_bid_changes.sql`). Whoever
  can read the bid reads its history.
- The beat: `useAppActivityHeartbeat` in `src/hooks/`, mounted in `src/components/Layout.tsx` with the
  page key from `src/lib/appActivityPage.ts`. It calls `bump_user_app_activity`.
- The open bid: `selectBidAndSyncUrl` in `src/pages/Bids.tsx` sets `bidId` in the address.
- The sheet: the Clock out window in `src/components/ClockInOutButton.tsx`. The note that fills itself
  is `src/lib/clock/clockOutNote.ts`. The board's bids are `fetchWorkingBoardClockBidPicks`.
- A bid's label: `src/lib/bids/bidFormatting.ts`. A bid's job: `list_bid_jobs_opened`.
- A precedent for the read: the Day book on People lists what each office person did, from the records
  the app stamps, never typed.

What is new: a kernel `src/lib/clock/bidDay.ts`, a table for the beat by bid, a table for the kept list
and the sheet's section.

## The plan

| Step | What | Size | Owes |
|---|---|---|---|
| 1 | The kernel that reads the day's bids, and the note that fills from it for anyone whose day held a bid | S | Nothing |
| 2 | The beat names the bid and counts only an active person, with its table, its read rule and an index on the ledger by person | M | A migration and its push |
| 3 | The pick in the sheet: the two shelves, **Take off**, **Add**, the chips, the kept list saved at the press | M | A migration and its push |
| 4 | The Bid Board sets the bid in front | S | Nothing |
| 5 | The list on the My Time card, and where the office reads it beside the hours | S | Nothing |
| 6 | CountTooling sends the beat | M | A change in the other app, and a function deploy if it comes through a function |

Each step ships its help guide, release note and docs the usual way. Step 1 stands alone and answers the
ask on most days. Steps 2 and 3 each push right after the merge.

## How to verify

- **Step 1, by test.** The kernel takes rows and returns the list. Fixtures cover a worked bid, a touch,
  a bid with only the app's own write, a bid that became a job and an empty day.
- **Step 1, walked.** On the live site with ZZ Test rows: change a ZZ Test bid, press **Clock out**
  and read the note. Then a day with no change, where the note is empty as today.
- **Step 2, walked.** Open a ZZ Test bid on Pricing for three minutes and change nothing. The bid appears
  under **Opened, nothing changed**. Leave the tab in front and untouched for ten minutes: the size does
  not grow.
- **Step 3, walked on a phone and a desktop.** **Take off**, **Put back**, **Add** from a chip, **Add**
  from the search, the count in the button, the empty day, and the saved list read back after the press.
- **The count again.** Run the counts in this card once more a month after step 2. The share of the day
  a trace can vouch for should rise, most of all for the days that held no change.

## Where it stands

Read and measured on 2026-11-25. The mock-up is drawn. Nothing is built. The card waits on the owner's
look and the six calls.
