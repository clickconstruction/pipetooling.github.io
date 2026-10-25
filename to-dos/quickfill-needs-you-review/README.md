---
name: "Quickfill and Needs you, read together: what the round holds, what gets stamped, and the five changes"
number: 176
group: close
status: BUILT as a train on 2026-10-25 after the owner's "I like it, please build it": change 1 #6128 (with migration 20261025010000), change 2 #6130, change 4 #6131, change 3 #6133 and #6134, change 5 #6136; stacked, armed in order as each base merges; left: the migration push after #6128, the owner's two clicks (decisions 4 and 5), the Prospects portion (decision 6), the sign-in-as-an-assistant check (8), the Google admin step (9)
summary: >
  The owner asked for a holistic look at Quickfill and Needs you: Quickfill was built so an
  assistant with ADHD finishes a daily round knowing everything is done, but they skip what
  they do not understand, and Needs you has grown past what he expected because Quickfill is
  not carrying the weight. This entry takes stock of both from the code (33 stations, 42
  Needs you sources, 70 lines, which are in both and which in neither), reads eight weeks of
  the mark tables (one assistant marks everything, 814 marks, a median nine seconds between
  presses, four stations whose count never moved), judges the words and the mechanism
  against the owner's goal, and proposes five changes in order of effect: the Mark says what
  happened (Done, Worked it, Not sure), every station carries a Next line instead of a bare
  count, the duplicates and the dead stations go, the Needs you sources get an actor so the
  assistant's lines and the owner's lines stop sharing one list, and the round ends on a
  close sheet the owner can read from the Dashboard.
next: the five PRs merge in order and the migration is pushed; then the owner's two clicks and decisions 6, 8 and 9
size: change 1 one PR with a migration · change 2 one PR · change 3 a train of three · change 4 hours · change 5 one PR
blocker: the owner's picks
ver: the six PRs #6128, #6130, #6131, #6133, #6134, #6136; their versions land with their fragments
opinion: do changes 1, 2 and 4 first, in that order; they fix the stamp without moving a line; change 3 is the owner's thesis in code and earns its train once 1 and 2 have shown what the assistant actually works
---

# Quickfill and Needs you, read together (#176)

## The ask

The owner, 2026-10-24: *"can you please look at quickfill and needs you holistically, I love
both sections but I don't think either is as put together as it could be. I want to focus on
quickfill. Quickfill was set up to be something our ADHD assistants go through every day as a
way to know they have accomplished everything they need to do; what I am finding is they will
sometimes skip over things they don't understand and parts of quickfill could be presented
better. Separately, Needs you has grown beyond the initial size I was expecting, and I think
this is because quickfill is not picking up the weight I was expecting of things that are
showing up in needs you. I think that all things that need attention should process through
quickfill (only for assistants) and needs you (for all other roles) but I don't think we've
taken a review of it and stock of what we have and could do."*

He wants recommendations, not code. This entry is the stock-take and the recommendations.
Names are left out: the repo is public, and the mark tables are about one real employee.

## The two surfaces in one paragraph each

**Quickfill** (`/quickfill`, [`src/pages/Quickfill.tsx`](../../src/pages/Quickfill.tsx)) is a
registry of 33 stations. Each has a banner question, a body, a count its body reports
(`useReportQuickfillSectionMetric`) and one **Mark**. A Mark writes the station's latest row
to `quickfill_section_marks` and a history row to `quickfill_section_mark_events` with the
count open at that moment and, on three stations, a note written from the rows. The desk has
three views, Page, Focus and the Roller (the default since v2.5813), and the phone has the
round. The Roller and the round walk the stations due by each station's own rhythm (the
median gap of its last five marks, [`lib/quickfill/round.ts`](../../src/lib/quickfill/round.ts))
and offer one big green press at the foot: **Looked · N open · next →**. The org has hidden
four stations (`quickfill_hidden_section_ids`: Banking sorting, Unpriced Fixtures, Jobs
Billing, Difficult people), so an assistant's round is 25 marked stations and 3 doors.

**Needs you** is one builder ([`lib/dashboardNeedsYou.ts`](../../src/lib/dashboardNeedsYou.ts),
70 line keys) over 42 sources ([`lib/needsYouSources.ts`](../../src/lib/needsYouSources.ts)),
each gated by role, shown on the Dashboard card and, since v2.5771, as Quickfill's last
station through the same hook and the same door table. The Quickfill host leaves out two
sources that stations carry (`jobFollowups`, `gcReview`) and holds back three (robot audits,
Division 22, submittals). Four lines have a **Fill them in** deck on Quickfill (lost bids,
vehicles, job accounts, contracts). The role gate has one office set, `isNeedsYouOfficeRole`:
the owner, the assistant and the controller read the same company list.

## Inventory A · every Quickfill station

Read from `SECTIONS`, the eligibility switch, the banners and each body's reporter. **Who** is
the eligibility: *office* = dev, owner and assistant-like (assistant, controller). **Marks** is
the count of mark events in the eight weeks 2026-08-31 to 2026-10-23 (40 workdays), **fast**
the share of those marks that landed under 20 seconds after the previous press, **count** the
open count at the median mark and at the last. A station's words are its default banner;
*(none)* means the strip shows no question at all.

| Station | Asks | Counts | Marks how | Who | In the Roller | Marks · fast | Count med · last |
|---|---|---|---|---|---|---|---|
| Warnings | Is anything flashing that nobody owns? | stale team card purchases | snapshot | office | a station | 33 · 33% | 1 · 0 |
| Office Arriving | Is the workspace ready for the day? | unticked boxes of 3 (shades, lights, mop) | boxes | office | a station | 37 · 0% | 0 · 0 |
| Assistant Dailys | Are today's assistant dailys done? | unticked boxes of 5, with who ticked | boxes | office | a station | 38 · 61% | 1 · 0 |
| My Inbox | Anything due today or overdue? | your tasks | no mark | anyone signed in | a door | — | — |
| People Hours | Are yesterday's and today's hours right? | clock sessions pending approval | snapshot · close-week chip | office | a station | 37 · 54% | 33 · 25 |
| Unassigned field time | Is every paid field hour tied to a job? | person-days with no job | snapshot · close-week chip | office | a station | 34 · 56% | 0 · 0 |
| Vehicle check-ins | Do we have a reading and a check-in on every truck? | trucks due a reading | snapshot | office | a station | 36 · 89% | 10 · 10 |
| Difficult people | Who needs a conversation this week? | people not yet talked to | snapshot | office | **hidden by the org** (last mark May) | 0 | — |
| Banking sorting | Is every bank transaction sorted to a job? | unsorted bank rows | snapshot · close-week chip | controller and up | **hidden by the org** | 0 | — |
| Lost bid reasons | *(none)* | lost bids with no reason (the Dashboard card) | snapshot; card hides at zero | office | a station | 24 · 71% | 60 · 60 |
| Billed Awaiting Payment | Who owes us, and who do we lean on first? | billed bills, by customer | snapshot | office | a station | 37 · 81% | 66 · 50 |
| GC weekly review | *(none)* | GCs still to certify this week | snapshot; carries Needs you's `gcReview` | office | a station | 34 · 65% | 8 · 7 |
| Job follow-ups | *(none)* | jobs waiting on a follow-up (the Dashboard card) | snapshot; carries `jobFollowups` | office | a station | 28 · 54% | 0 · 2 |
| Unpriced Fixtures | Does every fixture in the book have a price? | unpriced fixtures | snapshot | office | **hidden by the org** | 0 | — |
| Unreachable Prospects | Can we reach every prospect we promised to? | can't-reach prospects | snapshot; the whole station hides at zero | prospects roles | hidden today (zero) | 0 (last July) | — |
| Prospects | Did every prospect hear from us on time? | the warmth totals | snapshot | prospects roles | a station | 32 · 81% | 268 · 268 |
| Supply Houses | Is anything past due with a supply house? | houses 60+ days past due | snapshot · close-week chip | office | a station | 36 · 81% | 4 · 3 |
| Jobs Billing | Is every finished job billed? | HCP jobs missing specific work, materials or a total | snapshot | office | **hidden by the org** (last mark April) | 0 | — |
| Complete, no Total Bill | Does every finished job have a bill total? | 100% jobs with no total | snapshot | office | a station | 34 · 74% | 1 · 0 |
| Missing bill dates | *(none)* | billed or paid bills with no date | snapshot, the fix typed in the row | office | a station | 36 · 81% | 0 · 0 |
| Missing job info | Can every job be billed — customer, pictures, email? | jobs missing one of three | snapshot, two fixes typed in the row | office | a station | 36 · 50% | 1 · 2 |
| Property kinds | Is every unpaid job's property marked residential or commercial? | unset properties | snapshot, the pick in the row | office | a station | 13 · 62% | 1 · 0 |
| Percent complete | Does every open job's % done agree with its ticked stages and its paid money? | jobs where they disagree | snapshot, the slider in the card | office | a station | 0 (new, v2.5764) | — · 5 open today |
| Jobs Cleanup | Is every sub labor sheet attached to a job, and is today's money moving? | sheets + the Pipeline's money cards | snapshot | office | a station, rhythm every 3 days | 16 · 63% | 5 · 0 |
| Dispatch inbox | Has every field request been answered or sent on? | open requests | snapshot | dispatch roles | a station | 26 · 58% | 2 · 0 |
| Field photos → Drive | *(none)* | estimates still holding photos | snapshot, **no count reported** (header reads —) | everyone eligible | a station | 35 · 86% | — · — |
| Schedule | Are there any obvious schedule conflicts? | nothing (null metric) | a door on the round and the Roller; the Page still offers a Mark | schedule roles | a door | 38 · 29% | — |
| Tomorrow's Schedule | Who is on what job tomorrow? | nothing | the same | schedule roles | a door | 20 · 50% | — |
| Email | the org's own words: *Are my work@ and bids@ inboxes clean?* | Gmail labels once the owner's Google step is done; **until then three typed boxes** | note from the rows | office | a station | 37 · 0% | 7 · 6 |
| Texts | Is anything on texts still waiting on us? | texts needing a reply + texts not delivered | note from the rows (v2.5816) | Messages roles | a station | 38 · 71% | 1 · 1 |
| Physical inbox | Has every paper in the tray been decided? | undecided papers in the deck | the deck is the note (v2.5818) | office | a station | 37 · 8% | 5 · 7 |
| Office Leaving | Is the office closed up for the night? | unticked box of 1 (the trash) | boxes | office | a station | 34 · 82% | 1 · 0 |
| Needs you | *(none)* | the card's lines for this host | snapshot; Fill them in offers the Mark at its end | office | a station, rhythm every 3 days | 8 · 75% | 3 · 3 |

Three things the table shows before any judgement: six stations ask no question
(`sectionBanners.ts` has no entry for them); one station reports no count and was stamped 35
times on a dash; the two schedule doors carry 58 marks because the Page view still offers a
Mark the round and the Roller do not.

## Inventory B · every Needs you line

By source, as [`needsYouSources.ts`](../../src/lib/needsYouSources.ts) gates it. **Who** reads
the Dashboard gate for the three roles the owner named: A the assistant, O the owner
(`master_technician`), C the controller; E the estimator where it matters. **Quickfill** says
whether the station reads the source (✓), which station carries it instead, or why it is held
back. **Fill in** names the deck kind. **Today** is the count the dev saw on the Dashboard on
2026-10-24 (the dev reads every gate, so it is the ceiling); a dash is a line that was not
showing.

| Source | Lines (key) | Who | Quickfill | Fill in | Door | Today |
|---|---|---|---|---|---|---|
| tally | purchases need a job (`tally-self`) | everyone with a card | ✓ | — | /tally | 67 |
| tallyStaff | team purchases waiting (`tally-team`) | A O C | ✓ (Warnings counts the same stale rows) | — | sort-for-the-team window | — |
| arBank | allocate N bank deposits (`ar-deposits`) | A O C | ✓ | — | AR matcher | — |
| bankReturned | checks came back (`returned-check`) | A O C | ✓ | — | AR / the job | 3 |
| lostBids | lost bids with no reason (`lost-bids`) | A O C E | ✓ **and** the Lost bid reasons station | lost-bid | Why we lost | 61 |
| bidFollowups | bid follow-ups due | A O C E | ✓ | — | Call queue | — |
| staleClaims | a customer said they paid | A O C E | ✓ | — | the bid / Stages | — |
| myMoney | money on your bids | E | — | — | Money lens | — |
| teamReviews | team reviews due | A O C E | ✓ | — | Hiring → Review | 21 |
| roadmap | roadmap tasks need a person | anyone (dev's in practice) | ✓ | — | Plan | 56 |
| gcReview | GC review due this week | A O C | GC weekly review station | — | GC Review | 6 |
| statementRound | GC statements ready · GCs waiting on your statement | A O C | ✓ | — | the list / the round | 2 |
| bulkDelete · bulkHours · claimDev | data-safety alerts | everyone (alerts) | ✓ | — | Settings | 5 · 2 · — |
| robotAudits | robot questions and audits | A O C E | held back (the estimator's judgement) | — | Audits | 23 |
| robotBlocked | the robot is blocked on N bids | A O C E | ✓ | — | needs sheet | 5 |
| robotBacklog · robotSilence | robots have work · asleep | dev · O dev | ✓ | — | Console | — |
| d22 | fixture names with no Division 22 code | dev E | held back | — | Pricing audit | 99+ |
| hoursApprovals | clock sessions waiting on approval (`hours-approvals`) · typed hours (`typed-hours`) | A O C | ✓ (door = the People Hours station, which counts the same queue) | — | People → Hours | 32 · 2 |
| hrReports | field reports waiting to be filed | dev | ✓ | — | People → HR | 5 |
| labelApprovals | bank-label suggestions waiting | C O dev | ✓ | — | Banking → Accounting | 99+ |
| lien | suit year · serve copy · tracking owed · Docsmit credit · owner records signed · notice draft · letter two · window missed · approve the run · approve notices · sign notices · filing window · demand deadline · releases | A O C | ✓ | — | Lien desk / the job | $30,203 · 3 to approve |
| lienWaiversToSign | waivers wait for your signature | O dev | ✓ | — | the waivers | — |
| contracts | live jobs with no contract (`contract-missing`) · out for signature a week (`contract-stale`) · clauses (`contract-clauses`) | A O C | ✓ | contract (stale only) | the sweep / See them | 84 · 1 · — |
| unpricedWorkOrders | sub work orders waiting for a price | A O C | ✓ | — | Work orders | — |
| jobFollowups | jobs waiting on a follow-up | A O C | Job follow-ups station | — | Follow-ups deck | 26 |
| staleOpen | open jobs idle 21+ days | A O C | ✓ (the same deck's Idle lens) | — | Follow-ups deck, idle | 19 |
| capacityUnder | field capacity under 60% three weeks | A O C | ✓ | — | Capacity | — |
| jobAccountGaps | jobs bought parts with no job account | A O C | ✓ | job-account | Job accounts | 50 |
| supplyMoveWindow | invoices not on a job account, window closing | A O C | ✓ | — | movable list | 12 |
| vehicleRecordGaps | vehicles missing insurance, registration or service | A dev | ✓ | vehicle | Vehicles | 3 |
| priceMatrix | robot price matrix ready · price requests late | A O C E | ✓ | — | Pricing | — |
| gcFollowUp | people waiting on us (GC projects) · Customers (`customer-messages`) · Today's sends | GC roles | ✓; the texts of Customers go to the Texts station | — | Follow up / Messages | 4 · 1 · 1 |
| contractClauses | clause changes wait on your approval | C dev | ✓ | — | Contracts and clauses | — |
| legalReview | Collections accounts await your review | dev | ✓ | — | Legal desk | 2 |
| legalFirmActivity | the law firm has N things for you | A O C | ✓ | — | Legal desk fees | — |
| testReports | test reports ready to send | A O C | ✓ | — | the report | 2 |
| submittals | not started · unopened · sent back · lead time | A O C E | held back (the estimator builds Rev 1) | — | Submittals | 13 |
| customerWaiting | customer portal, uncalled | anyone (hook gates) | ✓ | — | the inbox | — |
| dispatchAged | dispatch requests waited 3+ days | anyone (hook gates) | ✓ (door = the Dispatch inbox station, which is the same inbox) | — | Dispatch inbox | — |

The dev's Dashboard card held **31 lines** on 2026-10-24; the same person's Quickfill station
held **21**, and its Fill them in deck **124 rows**. The assistant's station reported **2 to 4
open** at each of her eight marks. Either her role reads a far shorter list than the gates
say, or the count is taken before the card's forty hooks have loaded; it is worth a sign-in
as an assistant before change 3 (decision 8).

### The join

**In both, by design.** Every ✓ above: an assistant on Quickfill does see the Dashboard's
lines, as the last station of 28. The mechanism carries the weight the owner wanted. The
presentation drops it: the station is marked once in five workdays and its longest gap was 26
days.

**Needs you shows what no station owns.** Contracts (84 jobs on no signed agreement, the
largest figure on the card), idle jobs (19), job accounts (50) and the move window (12),
returned checks (3), statements ready to send (2), test reports (2), the lien desk's lines,
the law firm's items, GC projects waiting (4). Each is real office work with a door and no
station. Four of them have a Fill them in deck; the deck opens only from the last station.

**Stations do what Needs you never surfaces.** The office boxes, Email, Texts (only its
Customers slice reaches the card), Physical inbox, Billed Awaiting (the AR card is a figure,
not a line), Supply Houses, Prospects, Missing bill dates, Missing job info, Property kinds,
Percent complete, Complete no bill, Jobs Cleanup's sheets, Vehicle check-ins, Field photos,
Unassigned field time. These are the round's reason to exist and the Dashboard knows nothing
of them: the owner cannot tell from his Dashboard whether the round ran.

**Shown twice.** Lost bids: the Needs you line (with Fill them in) and the Lost bid reasons
station are the same card. Hours approvals: the line counts sessions 3+ days old, the People
Hours station counts every pending session, and the line's door is the station. Aged dispatch
requests: the line's door is the Dispatch inbox station. Team card purchases: Warnings counts
the same stale rows the `tally-team` line counts. Assistant Dailys' five boxes restate four
stations (schedule conflicts, email clear, physical inbox clear, trash when leaving) plus one
real duty (tell the dispatcher about time off); Office Leaving's one box is the fifth daily
again.

## The evidence · eight weeks of marks

Read on 2026-10-24, read-only, from `quickfill_section_mark_events` and
`quickfill_section_marks` for 2026-08-31 to 2026-10-23 (40 workdays), as the dev.

| Fact | Number |
|---|---|
| Mark events in the window | 814 |
| People who marked, ever | one assistant (997 of the 1,000 all-time events); the dev 3 |
| Assistants in the org | 5 |
| Workdays with a round | 37 of 40 |
| Marks per round day | 21 to 26 (every eligible station) |
| Sittings per day (marks within 30 min of each other) | 2 to 3; median 6 marks a sitting, 9 minutes |
| Median gap between one press and the next | 9 seconds |
| Marks under 20 seconds after the previous press | 464 of 814 (57%) |
| Marks at zero, or with no count, under 60 seconds after the previous | 175 |
| Time of day the round starts | 8:35 to 11:52; the median station is marked at 11:06 |
| Office Leaving's median mark | 11:18 in the morning |
| Stations never marked in the window | Percent complete (new), Jobs Billing, Unpriced Fixtures, Difficult people, Banking sorting (four hidden by the org) |
| Marks per ISO week | 103 · 45 · 109 · 114 · 87 · 117 · 123 · 116 |

**The fastest rounds.** On Friday 2026-10-16 the whole round, 26 stations, took 5.5 minutes:
20 presses under 20 seconds, 9 at zero. On Monday 2026-10-19, 21 stations in 6.5 minutes.
The slow days are not slower looks: a 317-minute day is three sittings with the same
nine-second presses inside each.

**Counts that never move.** Prospects read 268 at all 32 marks. Lost bid reasons read 59 or
60 at all 24. Vehicle check-ins read 8 to 10 at all 36 (91% the same as the mark before).
Billed Awaiting read 50 to 78, the same as the mark before only 9% of the time, because bills
come and go on their own; 30 of its 37 marks were under 20 seconds. Texts read 1 at all 38
marks, the one typed line the old station counted. These are the stations with the most
work in them and the least time spent on them.

**Counts that do move.** People Hours fell 77 → 25 across the window and was never the same
twice: someone approves hours. Email's typed numbers ran 5 to 11. Physical inbox 5 to 7.
Missing job info 0 to 7, Warnings 0 to 8, GC weekly review 0 to 14 across the week: these
are the stations being worked.

**Notes.** The Email station holds 37 typed notes, its three boxes (the live Gmail labels
wait on the owner's Google admin step from #159). Texts holds 38 notes that are all repeats,
the old "up to date" box; since v2.5816 the note is written from the rows. No other station
has ever carried a note.

**The Needs you station.** 8 marks in 40 workdays; 6 of them under 20 seconds; gaps of 11, 14
and 26 days. The round's rhythm rule reads that as *every 3 days* and the Roller shows it
amber, not red.

**The Dashboard card's growth.** The dev's card carries 31 lines today: 7 the owner's own
(approve notices, sign, team reviews, the law firm, legal review, bulk alerts), 6 the
estimator's or the robots' (audits, blocked, sealed numbers, submittals, Division 22), 2 the
controller's (bank labels, clauses) and about 16 the assistant's by trade (contracts, job
accounts, the move window, hours approvals, returned checks, statements, test reports,
lost bids, vehicles, idle jobs, GC projects, purchases, Today's sends, GC review, the lien
desk's drafts). The card has no way to say which is whose. The assistant's station shows her
the owner's calls too, and she marks the whole station at 3.

## Judgement · against the goal

The goal: an assistant with ADHD finishes the round knowing everything is done, and skips
nothing she does not understand. Measured against the evidence:

1. **The Mark is free.** The Roller's foot is one big green press, *Looked · 50 open · next →*,
   and Focus folds a station at zero with *still gets a ✓*. Nothing asks whether the station
   was opened. A nine-second median says the round is a stamp pass. The honest press at 50
   open is not "Looked" and the app offers no other word.
2. **A count does not say what to do.** *Did every prospect hear from us on time?* over a 268
   that never changes is a question nobody can answer from the number, so it is stamped.
   Needs you's lines are the better shape: a sentence, a figure, one verb on a button. Eleven
   stations lead with a bare count and a question; five lead with no question.
3. **Words assume knowledge.** *Is anything flashing that nobody owns?* (Warnings, which
   counts stale team purchases), *Is today's money moving?* (Jobs Cleanup), *Who do we lean on
   first?*, *GC weekly review* and *Job follow-ups* with no question at all, *Field photos →
   Drive* with no count. The guide explains each; the station does not.
4. **The Roller hides what Focus shows.** The Roller walks stations not yet marked today, so
   a station stamped at 9:51 with 50 open is gone from the deck for the day; *1 of 28 · 14
   left with work* counts stations, not work. The desk's Page still offers a Mark on the two
   schedule doors the round calls doors; 58 marks went there.
5. **The round's end says "looked", not "done".** *Round done ✓ · Every group has been looked
   at today* is true after a six-minute stamp pass. It does not say what is still open, and
   the owner's Dashboard never hears that the round ran.
6. **The last station is the heaviest.** Needs you sits 28th with 21 lines inside and the only
   Fill them in deck. The Roller reaches it last; the rhythm rule has learned it is a
   three-day station.
7. **Duplicates teach that marks are ceremony.** Five boxes that restate four stations, a
   card shown twice, a queue counted two ways, an evening box stamped at 11 a.m.
8. **Where a line should have become a station or a kind.** Contracts (84, the sweep), job
   accounts (50) and the move window (12), returned checks, statements ready to send, test
   reports: each is assistant work with a door, shown only as a line in the last station.
   Each is one step from a Fill them in kind or a station of its own.

**Does the code support the owner's thesis today?** Half. Since v2.5771 every line an office
role may read reaches Quickfill, so "everything through Quickfill for assistants" is true in
the data. What breaks it is one gate for three roles (`isNeedsYouOfficeRole`): the assistant
gets the owner's decisions and the owner gets the assistant's chores, in one list, and the
assistant's chores are not visible to the owner as hers. The shortest path is an **actor** per
source (change 3), not new hooks.

## The five changes

In order of effect on the assistant's day, then by size. *Words* changes copy, *mechanism*
changes what a press does or records, *move* puts a line where it is worked.

### 1 · The Mark says what happened (mechanism · one PR with a migration)

Replace the one green press with three on every station bar, on the Roller, the round, Focus's
folded line and the Page's foot:

- **Done · 0 open** — green. Offered when the count is zero or every row was handled this
  visit. On a boxes station, when every box is ticked.
- **Worked it · N left** — blue. Offered when the count is above zero. It records the count
  and asks nothing more; it is the honest press on Billed Awaiting at 50.
- **Not sure what to do** — grey. Records the press as a question and files a Dispatch inbox
  request to the owner with the station's name, its count and the banner question, so the
  thing skipped becomes a row someone answers, and the next day the station shows the answer.

Each press writes an `outcome` on `quickfill_section_mark_events` (`done` · `worked` ·
`question`; one additive migration, `SET lock_timeout`, idempotent). The rhythm rule and the
freshness colours do not change. The Mark history tiles (v2.5817) draw the outcome in the
cell, so the owner reads a week of grey cells on Prospects as the answer it is.

- Files: [`QuickfillRoundScreen.tsx`](../../src/components/quickfill/QuickfillRoundScreen.tsx)
  (the bar), `Quickfill.tsx` (`markSectionUpToDate`, `rollerLooked`, `roundLooked`, the Focus
  fold's ✓ Mark), `QuickfillSectionWrapper` (the foot), [`lib/quickfill/markHistory.ts`](../../src/lib/quickfill/markHistory.ts),
  `QuickfillSectionMarkHistoryModal.tsx`, a kernel `lib/quickfill/markOutcome.ts` (which press
  a count and a kind allow; tests), `supabase/migrations/<next>_mark_outcome.sql`.
- Option A: the outcome as a column (the pick). Option B: encoded in `note_text`; cheaper,
  but the history kernel would parse words and the Texts and Email notes already use the
  field.
- Option for the question's door: the Dispatch inbox (the pick; the owner reads it daily and
  it has a thread) or the person's own My Inbox task.

### 2 · Every station leads with a Next line (words · one PR, no server)

Under the banner question, one line that names the next row and its verb, in plain words
(`plainWords.ts`): *Lean on Loberg · $5,622 · 24 days* on Billed Awaiting; *Approve
Thursday's 3 sessions for the crew on 1007* on People Hours; *Read the 2007 Ram's miles* on
Vehicle check-ins; *Decide the toll paper from Oct 2* on Physical inbox. The body already
sorts its rows worst first; the line is the first row's sentence. A station with no row-level
next step (Prospects at 268) has nothing to say here, which is the signal it belongs in
change 4.

In the same PR: a banner for the six stations that have none (`sectionBanners.ts`:
Lost bid reasons, GC weekly review, Job follow-ups, Missing bill dates, Field photos, Needs
you), a count on Field photos, and three banners rewritten so a first-timer can act on them
(Warnings → *Are any team purchases over a week old still on nobody's job?*; Jobs Cleanup →
*Is every sub labor sheet on a job?* with the money cards' own words under; Billed Awaiting →
*Who is longest past due, and have we leaned on them this week?*).

- Files: `useReportQuickfillSectionMetric` gains a `nextLine` beside `markNote`
  ([`src/contexts/QuickfillSectionMetricsContext.tsx`](../../src/contexts/QuickfillSectionMetricsContext.tsx)), each body passes
  its first row's sentence, `QuickfillRoundScreen` and the Focus fold draw it,
  `sectionBanners.ts`, the guide `quickfill.md`.

### 3 · An actor on every source, and the office list split by who acts (move · a train of three)

The owner's thesis in code. Each source in `needsYouSources.ts` names its **actor**:
`assistant` (contracts, job accounts, the move window, vehicles, lost bids, statements, test
reports, returned checks, purchases, Today's sends, GC review, the lien desk's drafts and
tracking, dispatch requests, hours approvals as the preparer), `owner` (approve and sign
notices, team reviews, legal review, the law firm, capacity, waivers, bulk alerts), `controller`
(bank labels, clauses), `estimator` (bid follow-ups, money on my bids, robot lines, submittals,
Division 22), `dev` (HR reports, robot backlog, roadmap). The gate stays; the actor is one
more column, and `needsYouSources.test.ts` holds that every source has one.

- **PR 1 (S)**: the actor column and a `needsYouActorOf(source)`; the Dashboard card groups
  its lines **Yours** first and the office's under a fold, *The office is on these · N · last
  round 9:51*; the Quickfill station shows only the assistant's lines, the owner's calls
  folded under *Waiting on Robert · N* so she sees them without owning them.
- **PR 2 (M)**: the assistant's heaviest lines become Fill them in kinds, in the order of their
  figures: contracts missing (the sweep's Send, one row at a time), job-account window
  (*Move it* or *Leave it*), returned checks (*Unlink and remove* or *They paid again*),
  statements ready (*Send*), test reports ready (*Send to the GC*). Each kind is a kernel and
  an io beside `fillInContracts.ts`.
- **PR 3 (S)**: the Needs you station leaves last place. It opens the round as **Today's
  lines**, above the office boxes, since it now holds only her lines; `SECTION_INSERT_AFTER`
  moves it, the org's saved order is respected by the same anchor rule.
- Option A: the actor column (the pick). Option B: a station per assistant line (Contracts,
  Job accounts, Returned checks …); more stations in a round already stamped in nine seconds
  is the wrong direction until change 1 has landed.

### 4 · Retire the duplicates and the dead stations (words and move · hours)

- Assistant Dailys: keep the one box that is not a station (*Let the dispatcher know of
  anyone's upcoming time off*) and drop the four that restate Schedule, Email, Physical inbox
  and Office Leaving; or retire the station and move the time-off box to Office Arriving.
  A dev edit of `quickfill_assistant_dailys_items`, no code.
- Lost bid reasons station: retire it; the line with Fill them in is the better card
  (`SECTIONS`, `lostBids` into `QUICKFILL_CARRIED_BY_STATION` is then unnecessary).
- `hoursApprovals` and `dispatchAged` into `QUICKFILL_CARRIED_BY_STATION` (People Hours and
  Dispatch inbox carry them), so neither counts twice in the round.
- Schedule and Tomorrow's Schedule: doors on every view; the Page's Mark on them goes
  (`QUICKFILL_PERSONAL_SECTIONS` read by the Page wrapper too).
- Field photos: report its count (the body knows its rows) or retire it; a station stamped
  35 times on a dash is not a station.
- Jobs Billing: hidden by the org since April while *Is every finished job billed?* has no
  owner; the Bridge's bill card found 15 finished-looking jobs on 2026-10-24. Unhide it, or
  fold its three checks into Complete, no Total Bill. The owner's call (decision 4).
- Office Leaving: the one box is the fifth daily; retire the station or make it an afternoon
  station the Roller shows after 3 p.m. only.

### 5 · The round ends on a close sheet the owner can read (words and mechanism · one PR)

*Round done ✓ · Every group has been looked at today* becomes a sheet: *Round done · 9:51 ·
23 stations. Clean: 11. Worked, still open: 8 (Billed Awaiting 50 · People Hours 25 · …).
Questions for Robert: 2.* It is drawn from the day's mark events and their outcomes (change
1), nothing new on the server. The same sheet becomes a Dashboard card for the owner and the
controller, **The office's round**, under the Needs you card: *Today 9:51 · 8 still open · 2
questions*, with the questions as rows; *No round yet today* before it runs; *No round
yesterday* in amber on the morning after a miss. That is how the Dashboard learns the round
ran, and how a skipped station reaches the person who can explain it.

- Files: `views.ts` (`rollerWords`, the done card's words as a kernel `roundCloseSheet.ts`),
  `Quickfill.tsx` (the done card), `src/components/dashboard/DashboardOfficeRoundCard.tsx`
  over `lib/dashboard/officeRound.ts` reading `quickfill_section_mark_events` for the company
  day, the Dashboard page, `DASHBOARD_SECTIONS_ARCHITECTURE.md`, the guide.

### What is deliberately not proposed

- No new rhythm rule, no new view: Page, Focus and the Roller stay as built on 2026-10-24.
- No change to the four stations rebuilt from the 2026-10-24 review (#156 to #159) beyond
  the words change 2 adds; the Email station's live labels wait on the Google admin step.
- No automatic marking from a body's own saves. A station that reaches zero by work should
  show *Done* lit, not press itself; the press is the assistant's record.

## Decisions for the owner

1. **Change 1, the three presses**: build it? And the *Not sure* question goes to the Dispatch
   inbox (recommended) or to the asker's My Inbox?
2. **Change 2, the Next line**: build it? And the three rewritten banners above, or your own
   words?
3. **Change 3, the actor split**: the actor column (recommended) or a station per line? And is
   the actor list above right, in particular hours approvals (the assistant prepares, the
   owner approves) and the lien desk's lines?
4. **Jobs Billing**: unhide it, fold it into Complete, no Total Bill, or leave it hidden?
5. **Assistant Dailys**: trim to the one box (recommended) or retire the station?
6. **The standing backlogs**: Prospects (268), Lost bids (61), Billed Awaiting (50) are never
   going to zero. Each could offer a daily portion, *3 for today*, oldest first, with *Done*
   lit when the three are handled. Yes to the portion, and how many a day?
7. **Who runs the round**: five people hold the assistant role; one has pressed every mark
   since April. Is the round one person's job, in which case the close sheet names her, or
   the office's, in which case the owner says who covers a missed day?
8. **A check before change 3**: sign in as an assistant and read the Needs you station's count
   against the Dashboard card's; the mark events say 2 to 4 where the dev sees 21.
9. **The Email station**: the Google admin step from #159 is still the owner's; until it is
   done the station is three typed numbers a day.

## How to verify, once built

- Change 1: on the Roller, a station at 50 open offers Worked it and Not sure, never Done;
  press Not sure on Prospects and the Dispatch inbox holds a request naming Prospects, 268
  and the banner; the mark event row carries `outcome = 'question'`; the history tile is
  grey.
- Change 2: every station in the round shows a Next line under its question or says why it
  has none; `sectionBanners.test.ts` holds a banner for every id in `SECTIONS`; Field photos
  shows a count.
- Change 3: an assistant's Quickfill Needs you station lists no *your signature* or *your
  call* line; the owner's Dashboard card shows *Yours* then the fold; `needsYouSources.test.ts`
  fails on a source with no actor.
- Change 4: the round is shorter by the retired stations and `check:todos` still renders;
  People Hours and Dispatch inbox are the only places hours approvals and aged requests
  count.
- Change 5: after a round, the Dashboard card reads the time, the stations still open and
  the questions; the morning after a day with no marks it reads *No round yesterday*.
- The measure, eight weeks later: the share of marks under 20 seconds after the previous
  press (57% today), the count of *question* outcomes, and the figures on the three standing
  backlogs.

## Where it stands

Built 2026-10-25 as a train of six PRs on the owner's "I like it, please build it", each decision taken at its recommended answer: change 1 (#6128, the `outcome` column and the three presses, with migration `20261025010000_quickfill_mark_outcome.sql`), change 2 (#6130, the Next line and the nine banners), change 4 (#6131, the retirements and the afternoon station), change 3 (#6133, the actor and the folds, Today's lines first; #6134, the contracts-missing deck), change 5 (#6136, the close sheet and The office's round). The PRs are stacked and arm in order as each base merges; the migration is pushed from the main checkout the moment #6128 lands, since every later client writes the column. Each PR's fragment in `docs/recent-features/` says what it built; this entry takes their version numbers once they are on main.

Not built, by the decisions list: the Prospects portion (decision 6, the one Next line the station cannot write), the two clicks that are the owner's (decision 4 Jobs Billing unhidden, decision 5 Assistant Dailys trimmed to its one real box), the sign-in-as-an-assistant check of the station's count (decision 8) and the Google admin step for the Email station (decision 9). The mock-up stays as the drawing the build followed.
