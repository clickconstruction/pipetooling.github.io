---
name: "Needs me: one rail or one order for the office's morning"
number: 178
group: gated
status: proposed 2026-10-26 · three mock-ups drawn, then a live read of the marks the same day · the pick rewritten to D, the doors on Today's lines become work in place · PR 1 built 2026-10-26 as v2.5907, the deck as the station's body · the owner's go 2026-10-29 on the canvas · PR 2 built 2026-10-29 as v2.6071, her own card purchases · PR 3 built 2026-10-29 as v2.6086, the move window, with a not-needed account leaving it · PR 4 built 2026-10-29 as v2.6093, the idle lane on Job follow-ups · next unpriced work orders
summary: >
  An assistant arriving on a desktop reads three "what needs me" counts that grew one ask at a
  time: the Messages count on the header's word, everyone waiting on us; the Needs you card on
  the Dashboard, worst first, with Quickfill's Today's lines station mirroring it; and the
  Roller's deck on Quickfill, every station with a count and a rhythm. A customer's text waiting
  on a reply is in all three, a dispatch request is on the card and in a station, and nothing
  says which press is first. Four after mock-ups: A one rail on the Dashboard under one rule,
  B the Roller's deck as the morning with Messages as a station, C one number on the header
  whose tap opens a sheet of all three, D the doors on Today's lines become fill-outs in place.
  A live read of the mark histories on 2026-10-26 settled the pick: the stations marked every
  workday are the ones whose body is the work, and Today's lines, a list of doors, has 7 marks
  in 35 days and none since it moved to first in the round. The pick is D, with the station's
  open count as the measure; B's Messages station follows it.
next: PR 5, unpriced work orders as a Fill them in kind; then one kind a PR in the drawn order, and after each the station's mark history read for two weeks, the open count falling or not. Read Today's lines' history around 2026-11-09 for PR 1 and around 2026-11-12 for PRs 2 and 3. Push the 20261029233000 migration after PR 3 merges.
size: D is a train of S PRs, M in all · B is M · A and C are L
blocker: None. The owner gave the go on 2026-10-29.
ver: v2.5907 · 6071 · 6086 · 6093
opinion: build D — the live read says the stations that get done are the ones whose body is the work, and Today's lines, a list of doors to other pages, has 7 marks in 35 days with something open at every one; make its doors fill-outs in place and read the open count, then put Messages in the round
mockup: to-dos/needs-me-rail/mockup.html
---

# Needs me: one rail or one order for the office's morning (#178)

## The ask

The owner, 2026-10-26, in a holistic look at the app's experience, the first lens being *one
place to start the day, per role*. In his words as the session kept them: the office has three
doors to what needs me, the Needs you card, the Messages count and Quickfill's stations, and
each grew one ask at a time. He asked for before and after mock-ups that merge the three counts
into one rail or one order, so an assistant's morning has a first press.

Later the same day, on the first draft: *I think this has a lot of potential, but first I think
we need to explore seeing what items are in Needs you that are not in Quickfill for assistants.
If we are able to pull the component pieces of the app that assistants often need to fill out
into Quickfill, we will get better compliance from the assistants.* He signed in and the pages
were read as him, read-only. The counts are in *What the marks say* below. No names.

This is a design to-do. Nothing is built. The mock-up is `mockup.html` beside this file; every
person, customer, street, count and amount in it is made up.

## Today

What an assistant reads on arriving, on a desktop, on 2026-10-26. The counts in the mock-up are
made up; every source here is the code's.

### The header

| What | Who sees it | Where it comes from | The press |
|---|---|---|---|
| **Messages · 7**, a red pill on the word | the GC office team: dev, owner, assistant, controller, estimator (`canOpenMessages` in `src/lib/gc/access.ts`) | `src/components/MessagesBadge.tsx` → `supabaseFollowUpIo().count()` → the RPC `follow_up_count()` (`supabase/migrations/20261016050000_call_tasks.sql`): everyone waiting on us, each person once. A contact in Needs a reply or New, one whose snooze is up, an open We owe them row, an open call task, a standing note whose day has come. Supply houses and candidates are left out. Hidden at zero. Re-read on every settled change and on focus (`useMessagesLive`). | the word opens `/messages` |

On a phone the word and its count sit inside the ☰ drawer (`Layout.tsx`'s `renderNavLinks` with
`onNavClick`). The phone's top bar carries no count.

### The Dashboard

In the order `src/components/dashboard/DashboardPinnedQuickRow.tsx` draws them:

1. **The Needs you card** (`DashboardNeedsYouCard`). `useNeedsYouInputs({ host: 'dashboard' })`
   (`src/hooks/useNeedsYouInputs.ts`) reads every source `needsYouSourceGates` allows the role
   (`src/lib/needsYouSources.ts`) and `buildNeedsYouItems` (`src/lib/dashboardNeedsYou.ts`) makes
   the lines. The order is `rankNeedsYouItems`: the tier in `NEEDS_YOU_RANK`, then the biggest
   figure, ties in build order. Since v2.5843 the viewer's own lines come first and the rest fold by
   actor (`src/lib/needsYouActor.ts`): the header reads **Needs you · 9 yours · 5 for others**.
   Cards or Walk the list; on a phone an office role opens on Walk. Every press goes through
   `needsYouDoors.ts`: a page, one of five windows in place, a station, a test report. Snooze and
   Dismiss only on the alert lines. The lines that are another count somewhere else:
   - **Customers** (`customer-messages`, rank 40): `useCustomerMessagesCounts` over
     `src/lib/followUp/customerCounts.ts`, the customers who need a reply, the ones we owe, the
     ones to sort. Every one of them is in the header's 7.
   - **Today's sends** (`todays-sends`, rank 40): the morning run's texts ready to press, a
     window over the Dashboard.
   - **Dispatch requests older than 2 days** (`dispatch-requests-aged`, rank 40): `dispatchAged`
     from the page's `useDispatchInbox`; the press scrolls to the Teams Inbox card.
   - **A customer waiting** (`customer-waiting`, rank 0, red): the dispatch customers nobody has
     called.
   - **Clock sessions waiting** (`hours-approvals`, rank 50): `usePendingHoursApprovalsNudge`,
     three days old or more.
   - **Jobs quiet past their stage** (`job-followups`) and **the GC weekly review**
     (`gc-review-weekly`): each is a Quickfill station too.
2. **The office round card** (`DashboardOfficeRoundCard`, v2.5845): `roundClose.ts` over the last
   ten days of `quickfill_section_mark_events`. **Today 9:51 AM · Rosa · 23 stations · 8 still
   open · 2 questions**, each still-open station a door into Quickfill. **No round yet today**
   with Friday's shape before it runs. **No round Thursday** in red the morning after a miss.
3. **The GC review week done** notice, green, on a Wednesday after the review.
4. **The Teams Inbox card** (`DashboardTeamsInboxCard`): the dispatch requests and the estimator
   inbox. The aged ones are the Needs you line above.
5. **The My Inbox card** (`DashboardMyInboxCard`): the viewer's checklists due today and overdue.
   Every role has it.
6. Outside the card: `DashboardMyTeamPendingBanner`, the clock sessions pending for a lead at My
   Team; `DashboardDevRejectedNotification` for a dev; the amber alert when the test-job list
   fails to read and the job lists are held. On a phone in Dispatch mode an office role gets a
   door line in the card's place, **Needs you · 9 · Allocate 2 bank deposits · Inbox ›**
   (`needsYouDoorWords`, `/dispatch-mode/inbox`).

### Quickfill

The Roller is the view the page opens in since v2.5813 (`QUICKFILL_DEFAULT_VIEW` in
`src/lib/quickfill/views.ts`); under 640 px the page is the round.

- **The round** (`roundRows` in `src/lib/quickfill/round.ts`): every station a row with a state
  from its own rhythm, the median gap of its last five marks. Fresh within 12 h, not yet, due
  today, due, never. `roundHeadline` reads **12 due · 2 due today · 7 not yet**. The queue is the
  due ones in list order. **The Roller's deck** (`rollerDeck` in `views.ts`): every station not
  marked today, due first, then due today, then not yet, the doors last. Its words:
  **1 of 24 · 15 left with work**. Dots in the freshness colours.
- **Each card** (`QuickfillRoundScreen`): the name and the count, the station's question, the
  **Next line** (`src/lib/quickfill/nextLine.ts`, v2.5868: *Lean on Ridgeway Builders · $29,323 ·
  38 days*), the body, and at the thumb Skip, **Done · 0 open · next**, **Worked it · N left ·
  next**, **Not sure what to do** (`markOutcome.ts`). Previous and Next, ← and →.
- **The stations** (`src/lib/quickfill/sections.ts`): 32 in the list, Today's lines first since
  v2.5843, Office Leaving only after 3 p.m. The ones that are another count somewhere else:
  - **Today's lines** (`QuickfillNeedsYouSection`): the Needs you card again, `host: 'quickfill'`.
    The same builder, less the four sources a station on this page carries
    (`QUICKFILL_CARRIED_BY_STATION`: Job follow-ups, GC weekly review, People Hours, the
    Dispatch inbox) and the three held back (`QUICKFILL_HELD_BACK`: robot audits, Division 22,
    submittals). The Customers line leaves out the texts here (`textsElsewhere`), since the
    Texts station holds them. Plus the Fill them in deck.
  - **Texts** (`textsLedger.ts`, v2.5816): the day's text ledger read from Messages. Needs a
    reply narrowed to texts, Not delivered, Went out today, the quiet lines for Today's sends
    and New. Its count is the ledger's.
  - **Email** (`emailStation.ts`, v2.5827): Gmail's counted labels, work@ and bids@, with ages.
  - **Dispatch inbox**: the Teams Inbox card's own inbox. Carries `dispatch-requests-aged` and
    `customer-waiting`.
  - **People Hours**: the approvals queue. Carries `hours-approvals`.
  - **Job follow-ups** and **GC weekly review**: each carries its line.
  - **My Inbox**: a door to the checklists, the Dashboard's My Inbox card.
  - There is no Messages station. The people waiting on us reach Quickfill only as the
    Customers line's non-texts and the Texts station's texts.

### What overlaps

| The thing waiting | The header | The Dashboard | Quickfill |
|---|---|---|---|
| A customer's text waiting on a reply | in the 7 | the Customers line | the Texts station · left out of Today's lines |
| A customer's email or call waiting | in the 7 | the Customers line | Today's lines, the Customers line |
| A trade partner or a lead waiting | in the 7 | — | — |
| A text the morning run prepared | — | Today's sends | Today's lines, Today's sends · a quiet line on Texts |
| A dispatch request 2+ days old | — | the Needs you line · the Teams Inbox card | the Dispatch inbox station · left out of Today's lines |
| A clock session 3+ days old | — | the Needs you line · My Team's banner for a lead | the People Hours station · left out of Today's lines |
| A job quiet past its stage | — | the Needs you line | the Job follow-ups station · left out of Today's lines |
| Deposits to apply, lost bids, vehicles, contracts, the lien desk | — | the Needs you line | Today's lines, the same line |
| A station still open | — | the office round card | the Roller's deck |
| A checklist due today | — | the My Inbox card | the My Inbox door |

An assistant on a desktop reads, in order: the badge, the card's two numbers and nine figures,
the round card's three numbers, the Teams Inbox card, My Inbox; then on Quickfill the Roller's
*1 of 24 · 15 left with work* and 24 station counts, six of them figures already read on the
Dashboard. There is no first press. The card's top line, the Roller's first card and the badge
each start somewhere.

### The assistant's lines, by how each is worked

Read from the gates and the door table for the assistant role. On Quickfill almost nothing of
hers is missing. What is missing is the work itself: about half her lines there still open
another page's form.

| How | Her lines |
|---|---|
| Filled in on the page, a few fields a row (the Fill them in deck) | lost bids with no reason, vehicles missing a record, jobs bought with no account, contracts out a week, live jobs with no contract |
| A window over the station | bank deposits, team purchases, cleared releases, Today's sends, test reports |
| A station on the page | clock sessions, dispatch requests and the customer waiting, quiet jobs, the GC week |
| A door out to another page | Customers to Messages, GC follow up, the statement round on the Pipeline, a returned check's case in Accounts receivable, unpriced work orders under Jobs › Subs, idle jobs in the Follow-ups deck, the supply-house move list in Materials, legal firm fees, her own card purchases on Tally, the eight lien desk lines, a stale paid claim with no landing |

Off Quickfill by design and not hers: submittals and robot audits, the estimators' lines, which
fold for her on the Dashboard too. One stray: the owner's typed-hours line rides the
hours-approvals source, so it falls off Quickfill's *Waiting on the owner* fold.

### What the marks say

Read on 2026-10-26 at about 11:10 AM as the owner, read-only, from the Mark history window of
each station and the Dashboard's round card. The window draws 35 days. One assistant marks every
station. No names here; the full read is in the session's private notes.

- The office fold on the Dashboard held 14 lines and the same fold on Today's lines held 11. The
  three missing were exactly the three a station carries: the jobs waiting on a follow-up, the
  dispatch requests, the clock sessions. The code read holds. The lien lines load several seconds
  after the rest on Quickfill, so a quick look at the station undercounts.
- The Fill them in deck held 205 rows. The lost-bids figure was 60 on 2026-10-23, the day the deck
  shipped, and 61 on 2026-10-26. The deck's rows are not falling.
- The round card read *ran today · 11:05 AM · 2 stations*. By 11:06 five stations were marked,
  all within one minute: Office Arriving, Texts, the Dispatch inbox, Email, the Physical inbox.

| Station | Marks in 35 days | Streak | Marked today | Open at a look |
|---|---|---|---|---|
| Today's lines | 7 | 0 | no, last on 10/21 with 3 open | something open at every look |
| Texts, Email, Physical inbox, Office Arriving | 33 to 34 each | 16 | yes, all four in one minute | about 1, 8, 6 and 0 |
| Dispatch inbox | 23 | 1 | yes, 2 open | about 1 |
| People Hours | 32 | 15 | no, 25 open on 10/23 | rising, about 27 to about 44 |
| Billed Awaiting Payment | 32 | 15 | no, 50 open on 10/23 | about 65 |
| Vehicle check-ins | 31 | 15 | no, 10 open on 10/23 | 10 at every look, never moves |
| Job follow-ups | 24 | 3 | no | 0 at 18 of 24 looks |

Three things the table says.

1. **Today's lines is not worked.** Seven marks ever, something open at every one, and none
   since it moved to first in the round on 2026-10-24 (v2.5843). The doors and the deck are not
   being pressed.
2. **The round is a stamp pass.** The stations with a 16-day streak are the ritual bodies: a tick
   list, a ledger, the tray's deck. Four were marked inside one minute. The Physical inbox's
   one-time sort did happen, from 7 undecided to 0.
3. **A mark is not the work.** People Hours and Vehicle check-ins are marked daily while their
   counts climb or never move. Moving a count into the round is not enough by itself. The
   station's body has to be the fill-out, and the measure has to be the open count.

## Options

All four are drawn in `mockup.html`, each as a desktop frame and a phone frame, with today
beside them. The viewer is Rosa, an assistant, on Monday 2026-10-26 at 8:05 AM. The Needs you
rules hold in every option: the card's figure equals the destination page's, a door opens in
place where the destination is a window, Snooze and Dismiss only on alert lines.

### A · One rail on the Dashboard

The Needs you card and the office round card become one card, **This morning**, for the office
roles. Every count is a line under one rule, `rankNeedsYouItems`' tiers: the alerts, then money,
then the hard deadlines, then revenue, then people, then hygiene. The people waiting on us join
as one line at tier 40 beside the Customers line, **7 people waiting on us · 3 need a reply, 2 we
owe, 2 to sort**, with the lanes as sub-figures. A due station with work joins at tier 50,
**People Hours · 14 sessions · due**, its Next line as the gloss; a station due today at tier 60;
the stations at zero fold to one line, **5 stations at zero**. The top line's button is drawn
big, **Start here ›**, and that is the first press. Walk the list walks the rail.

| Today's count | Becomes |
|---|---|
| The Needs you card | the rail; every line keeps its door |
| The office round card | the rail's station lines, and a foot line **Round · 12 due · Open the Roller ›** |
| The Messages count on the header | kept; the same number as the rail's people line |
| The Customers line | folded into the people line as its customer figures |
| Quickfill's Today's lines | unchanged; the rail is the Dashboard host |
| The Teams Inbox card, My Inbox | kept; the dispatch line still scrolls to the card |

A tech sees no rail: their card has only their own purchases and the alerts, and it stays a
card. An estimator's card becomes the rail with their lines and the people line; no stations,
since Quickfill is not their page. Their My Bids dock and the badge stay.

**What it costs.** L. A kernel `lib/dashboard/morningRail.ts` that merges three lists with a tier
for each new kind. The hard part is the stations' counts: the Dashboard has only the last look's
`outstanding_count` from `quickfill_section_mark_events`, a day stale, since the live counts come
from the stations' own hooks on the Quickfill page. The rail's station lines either read *at last
look* or 28 hooks mount on the Dashboard. Marking a station at zero from the Dashboard needs
`markSectionUpToDate` lifted out of the page.

### B · The Roller's deck as the morning

Needs you is already the first station. Messages becomes the second: **Messages · 7**, the
question *Is everyone who wrote to us answered?*, the Next line **Answer Priya Natarajan · a text
· 2 days**, the body the page's five lanes with their counts, each a press into its lane, and the
Texts ledger as the first fold. The Roller walks Today's lines, Messages, then the due stations in
list order, then due today, then not yet, the doors last. The first press is the one the Roller
draws today: the first card's Next line, **Allocate 2 bank deposits ›**, the first of the viewer's
own lines. On the Dashboard the office round card gains that press before the round runs: **No
round yet today · Start › Today's lines · Allocate 2 bank deposits**.

| Today's count | Becomes |
|---|---|
| The Needs you card on the Dashboard | kept as it is; the owner's lines live there |
| The office round card | kept, with the Start press before the round runs |
| The Messages count on the header | kept; it is the station's figure, the same read |
| The Customers line and Today's sends on Today's lines | moved into the Messages station on Quickfill; kept on the Dashboard's card |
| The Texts station | folded into the Messages station as its first fold, its ledger and its history kept |
| The Email station | kept; mail is not in Follow up |
| The Teams Inbox card, My Inbox | unchanged |

A tech sees nothing new: no Quickfill, no Messages word, Job Mode and My Inbox as before. An
estimator sees nothing new either: Quickfill is not their page, and their card, their My Bids
dock and the badge are unchanged.

**What it costs.** M, as three PRs. PR 1, S: the station. `lib/quickfill/messagesStation.ts`,
the lanes and the count from Follow up's own loaders, which `textsLedgerIo.ts` already reads;
`QuickfillMessagesSection.tsx`; a second entry in `sections.ts` with `SECTION_INSERT_AFTER`;
eligibility `canOpenMessages`. PR 2, S: the lines move. `customerMessages` and `todaysSends`
become sources of their own in `needsYouSources.ts` so `QUICKFILL_CARRIED_BY_STATION` can name
the station; the Texts ledger folds into the station and `texts` leaves the list, its mark
history read under the new id. PR 3, S: the Start press. `roundClose.ts` learns the deck's first
card and the Dashboard card draws it with `todaysLinesNextLine` over the items it already has.

B was the first draft's pick. The live read moved it behind D: the morning's shape matters less
than whether the first station gets worked, and today it does not.

### C · One number on the header

The Messages word loses its pill. One number takes the pill's place at the right of the header,
**Needs me · 25**, on every page, for the roles with sources. Its tap opens a sheet, the shape of
the Bid Board's robot sheet: the viewer's lines worst first, then the people waiting as the five
lanes, then the stations due with work, under one head, **9 lines · 7 people · 9 stations**. The
first press is the sheet's top row, drawn big. On a phone the number sits beside ☰ and the sheet
slides up.

| Today's count | Becomes |
|---|---|
| The Messages count on the header | gone from the word; inside the number |
| The Needs you card | kept; the sheet's long form |
| The office round card | kept; the sheet's station rows are its doors |
| Quickfill's Today's lines, the Roller | unchanged |
| The Customers line | kept on the card; a lane in the sheet |

A tech gets no number: their only sources are their own purchases and the alerts, which stay on
their card. An estimator's number counts their lines and the people waiting on them.

**What it costs.** L. The merge kernel from A with the same stale station counts; a
`NeedsMeSheet.tsx`; a header slot in `Layout.tsx`. The real cost is the read: `useNeedsYouInputs`
mounts about forty hooks and today mounts on two pages. A number on every page mounts them
everywhere, or a summary RPC that does not exist yet counts the lines on the server.

### D · The doors on Today's lines become work in place (recommended)

The station keeps the Needs you card's lines and their order. What changes is the press. A line
of the assistant's whose press leaves Quickfill today gets its fill-out under the line instead:
the rows behind it, a few fields a row, **Save and next**, **Skip**, a trail with **Undo**, the
shape the Fill them in deck already has for five kinds. The deck stops being a chip behind the
card and becomes the station's body: the Roller's first card opens on the first row, and the
first press is that row's save. The lines whose rows cannot be a few fields keep their door.

The kinds to build, by the live read and by fit, one kind a PR:

1. **Her own card purchases**: pick a job per charge. The Banking sorting station already walks
   this shape for the controller; this is the same card for her own charges.
2. **The supply-house move window**: moved, asked the house, or not needed, per charge. The
   job-account kind's three answers on different rows, with the window's date on the card.
3. **Idle jobs**: the Follow-ups deck already walks one card with call, note or close, and it
   rides the same read as the Job follow-ups station. A second lane on that station.
4. **Unpriced work orders**: a price per line on a sub's draft.
5. **The statement round**: one press, so a window over the station, like Today's sends.
6. **A returned check**: the case's three decisions, so a window.
7. **Messages as a station**, B's PR 1, with the texts folded in, once the lines above are in.

GC follow up, legal firm fees and the paid claim stay doors. Each is a conversation or a read,
not a fill-in.

**The measure.** The station's Mark history window already draws it: the marks per week, the
streak, and the open count at each look. Today the station reads 7 marks in 35 days with
something open at every look. Two weeks after each kind lands, the same window is read again.
The kind earned its place if the station is marked on most workdays and its open count falls.
A mark alone does not count; People Hours is marked daily while its count climbs.

| Today's count | Becomes |
|---|---|
| The Needs you card on the Dashboard | kept as it is, with its doors; the owner works from pages |
| Today's lines on Quickfill | the same lines; the deck is the body, the doors become fill-outs one kind at a time |
| The Fill them in chip | gone; the deck is the station |
| The office round card | kept; it reads the station's mark like any other |
| The Messages count on the header | kept; the station comes in step 7 as in B |
| The Texts station, Email, the Teams Inbox card, My Inbox | unchanged until step 7 |

A tech sees nothing new. An estimator sees nothing new: their lines are doors to the Bids tabs,
and Quickfill is not their page.

**What it costs.** M in all, as a train of S PRs. Each kind is a kernel and an io file in
`lib/needsYou/` beside the five that exist (`fillInLostBids.ts`, `fillInVehicles.ts`,
`fillInJobAccounts.ts`, `fillInContracts.ts`, `fillInContractsMissing.ts`), a card in
`NeedsYouFillInDeck`, a kind in `fillIn.ts`'s `FILL_IN_KINDS_BUILT`, and the line's button on the
station. The purchases kind reuses the Banking sorting station's job picker; the move-window
kind reuses the job-account kind's answers; the idle lane reuses the Follow-ups deck's card. Making
the deck the station's body is one PR of its own in `QuickfillNeedsYouSection`, the Cards and
Walk views kept behind a chip. The measure costs nothing; the history window draws it.

### Side by side

| | Today | A | B | C | D |
|---|---|---|---|---|---|
| The first press | none | the rail's top line, **Start here ›** | the Roller's first card's Next line, and **Start ›** on the Dashboard | the sheet's top row | the first row's **Save and next** on Today's lines |
| Where | three places | the Dashboard | Quickfill, with a door on the Dashboard | the header, every page | Quickfill, Today's lines |
| The rule | three rules | one tier table | worst first inside Today's lines, then the round's order | one tier table | worst first inside the station, the round's order after it |
| The Messages count | the badge | kept, equal to the people line | kept, equal to the station | the number | kept; a station in step 7 |
| The Needs you card | the card | the rail | kept | kept | kept |
| The doors on Today's lines | doors | doors | doors | doors | fill-outs, one kind a PR |
| A tech | unchanged | unchanged | unchanged | unchanged | unchanged |
| An estimator | the card, the dock, the badge | the rail with their lines | unchanged | the number with their lines | unchanged |
| Live station counts | on Quickfill | stale on the Dashboard, or 28 hooks | live, the stations' own | stale, or 28 hooks on every page | live, the stations' own |
| The measure | — | — | — | — | the station's marks and open count |
| Cost | — | L | M, S S S | L | M, a train of S |

## The recommendation

**D.** The live read answers the question the first draft could only argue. The stations that
get done every workday are the ones whose body is the work: a tick list, a ledger, the tray's
deck. The station that lists doors to other pages has 7 marks in 35 days and none since it moved
to first in the round. Merging the counts into one rail or one order would put the same doors in
one place, and the read says doors do not get pressed. So the first move is not the shape of the
morning but the shape of the first station: its doors become fill-outs, one kind a PR, and the
station's own history window says after each whether it worked. B's Messages station follows,
because the people waiting on us are the one count still outside the round, and A's rail stays
open for the day the stations' counts come from one read both pages call.

## Is this the best we can do?

The case against D.

1. **A mark is not the work, and neither is a form.** People Hours is marked daily while its
   count climbs. A fill-out in place can be skipped like a door, with Skip one press away. The
   measure has to be the open count, and a count can fall for reasons that are not the deck.
2. **Five kinds already exist and 205 rows sit unpressed.** Adding kinds to a deck nobody opens
   adds nothing. The deck is a chip behind the card. The honest first PR is the one that makes
   the deck the station's body, before any new kind; D says so, but it is easy to build the kinds
   first because they are the clearer work.
3. **It leaves the three counts as they are.** The owner's ask was one rail or one order. D
   answers compliance, not the morning's shape. The badge, the card and the Roller still start in
   three places until step 7.
4. **The round is a stamp pass.** Four stations were marked inside one minute. A station with
   real work in it takes minutes, and the pass may skip it as it skips Today's lines today. The
   round's order may need the work first and the stamps last, and that is a change to the round,
   not to the station.
5. **Two writers for one row.** Each in-place form duplicates a page's form: the Tally page's job
   picker, the Materials list's answers, the Follow-ups deck's card. The kinds reuse the kernels,
   but the cards are drawn twice, and a field added to the page is not added to the deck.
6. **One person's habits.** One assistant marks every station. The read is one person's two
   weeks, and a change in her day moves every number. Two weeks after each kind is a short
   window.

What would beat it: the deck as the station's body with the round's order changed so the work
comes first and the stamps last, measured by the open count over a month, then the kinds in the
order the counts ask for.

## Decisions

1. **D's first PR**: the deck as the station's body, or the purchases kind first. D as drawn
   builds the body first.
2. **The measure's window**: two weeks after each kind (drawn), or a month.
3. **The round's order**: unchanged (drawn), or the work-shaped stations first and the stamps
   last.
4. **B's Messages station**: step 7 of D (drawn), or beside D's first PR.
5. **The Texts station**, when Messages comes in: fold it into the Messages station (drawn), or
   keep it beside with each text counted once.
6. **The Customers line**: stays on the Dashboard's card (drawn), or goes once Messages is a
   station.

## Where it plugs in

- **The counts**: `src/components/MessagesBadge.tsx` and `follow_up_count()`;
  `src/lib/dashboardNeedsYou.ts` (`NEEDS_YOU_RANK`, `rankNeedsYouItems`, `buildNeedsYouItems`);
  `src/hooks/useNeedsYouInputs.ts`; `src/lib/needsYouSources.ts` (`QUICKFILL_CARRIED_BY_STATION`,
  `QUICKFILL_HELD_BACK`, `QUICKFILL_CUSTOMER_TEXTS_HOST`); `src/lib/needsYouDoors.ts`;
  `src/lib/needsYouActor.ts`; `src/lib/followUp/customerCounts.ts`.
- **The deck** (D): `src/lib/needsYou/fillIn.ts` (`FILL_IN_KINDS_BUILT`, `FILL_IN_KIND_ITEM`),
  the five kind kernels and their io files beside it, `src/hooks/useFillInRows.ts`,
  `src/components/needsYou/NeedsYouFillInDeck.tsx`, `QuickfillNeedsYouSection.tsx`; the job picker
  on the Banking sorting station, the Follow-ups deck's card, the Materials list's answers.
- **The round**: `src/lib/quickfill/round.ts`, `views.ts`, `sections.ts`, `nextLine.ts`,
  `markOutcome.ts`, `roundClose.ts`, `markHistory.ts`, `textsLedger.ts` and `textsLedgerIo.ts`;
  `src/components/quickfill/QuickfillRoundScreen.tsx`, `QuickfillRollerStrip.tsx`,
  `QuickfillRoundList.tsx`, `QuickfillSectionMarkHistoryModal.tsx`, `QuickfillTextsSection.tsx`.
- **The Dashboard**: `src/components/dashboard/DashboardPinnedQuickRow.tsx`,
  `DashboardNeedsYouCard.tsx`, `DashboardOfficeRoundCard.tsx`, `DashboardTeamsInboxCard.tsx`;
  `src/lib/dashboard/phoneFolds.ts`, `phoneOffice.ts`.
- **The header**: `src/components/Layout.tsx` (`renderNavLinks`), `src/lib/gc/access.ts`.
- **Docs and words**: `docs/QUICKFILL_ARCHITECTURE.md`, `docs/MESSAGES_ARCHITECTURE.md`,
  `docs/DASHBOARD_SECTIONS_ARCHITECTURE.md` → Needs You card, the Glossary's *Needs You card*
  and *Quickfill* entries, the guides `needs-you-card.md` and the Quickfill guides; a release
  note and a fragment per PR.

## How to verify

D, on a local preview as the dev, then as the sample assistant. The Roller opens on Today's
lines and its body is the deck's first row, the first of the viewer's own lines with its fields.
Save and next writes what the row's page writes and the line's figure falls by one. Each new
kind's card shows what the app knows, its fields, and the record's own page as a door. A line
with no kind keeps its button and its door. Cards and Walk the list are still there behind a
chip. The station's Mark records the open count. Then the measure: two weeks after each kind
lands, the station's Mark history window on prod, read as the owner, shows marks on most
workdays and an open count lower than the day the kind landed. The Dashboard's card is unchanged.
A tech's and an estimator's Dashboard and header are unchanged.

## Where it stands

| What | Version | PR | State |
|---|---|---|---|
| The inventory and the three mock-ups | — | #6178 | merged 2026-10-26 |
| The live read and the pick rewritten to D | — | | proposed 2026-10-26 |
| PR 1 · the deck as the station's body for the assistant (`needsYouStationOpening` by role, the card's `fillIn.opensFirst`, the other lines under the deck, the Next line from the first row); the owner and the controller open on their own lines | v2.5907 | | built 2026-10-26 |
| PR 2 · the purchases kind: the viewer's own card charges over two days old with no job, the Sort screen's day-job chips and search, Save the Sort screen's RPC, Undo clears it; the measure's read around 2026-11-12 | v2.6071 | | built 2026-10-29 |
| PR 3 · the move-window kind: the still-current charges not on a job account, moved, asked by email or not needed per charge; a job account marked not needed leaves the window (migration `20261029233000`, pushed after the merge); the measure's read around 2026-11-12 | v2.6086 | | built 2026-10-29 |
| PR 4 · the idle lane on Job follow-ups: the station's two lanes, Quiet and Idle, over one read, each opening the Follow-ups deck in place on its lens; the idle line leaves Today's lines on Quickfill; the measure's read around 2026-11-12 | v2.6093 | | built 2026-10-29 |
| PR 5 · unpriced work orders | | | not started |
| PR 6 · the statement round and the returned check as windows | | | not started |
| PR 7 · the Messages station (B's PR 1) | | | not started |
