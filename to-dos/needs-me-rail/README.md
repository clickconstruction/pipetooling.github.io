---
name: "Needs me: one rail or one order for the office's morning"
number: 178
group: gated
status: proposed 2026-10-26 · the before inventoried and three after mock-ups drawn · waiting on the owner's pick
summary: >
  An assistant arriving on a desktop reads three "what needs me" counts that grew one ask at a
  time: the Messages count on the header's word, everyone waiting on us; the Needs you card on
  the Dashboard, worst first, with Quickfill's Today's lines station mirroring it; and the
  Roller's deck on Quickfill, every station with a count and a rhythm. A customer's text waiting
  on a reply is in all three, a dispatch request is on the card and in a station, and nothing
  says which press is first. Three after mock-ups: A one rail on the Dashboard under one rule,
  B the Roller's deck as the morning with Messages as a station, C one number on the header
  whose tap opens a sheet of all three. The pick is B: it finishes the round the owner has been
  building all week, the first press is the Next line the Roller already draws, and it costs
  three small PRs.
next: The owner picks A, B or C, or says the three doors stay as they are; then the PR train under the pick, PR 1 first.
size: B is M as three PRs, S S S · A is L · C is L
blocker: The owner's pick.
ver: proposed
opinion: build B — the Roller is the morning the office already walks, Messages is the one count that is not a station yet, and the first press is drawn today on every card as the Next line; the Dashboard keeps the owner's card and gains one Start press
mockup: to-dos/needs-me-rail/mockup.html
---

# Needs me: one rail or one order for the office's morning (#178)

## The ask

The owner, 2026-10-26, in a holistic look at the app's experience, the first lens being *one
place to start the day, per role*. In his words as the session kept them: the office has three
doors to what needs me, the Needs you card, the Messages count and Quickfill's stations, and
each grew one ask at a time. He asked for before and after mock-ups that merge the three counts
into one rail or one order, so an assistant's morning has a first press.

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

## Options

All three are drawn in `mockup.html`, each as a desktop frame and a phone frame, with today
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

### B · The Roller's deck as the morning (recommended)

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

### Side by side

| | Today | A | B | C |
|---|---|---|---|---|
| The first press | none | the rail's top line, **Start here ›** | the Roller's first card's Next line, and **Start ›** on the Dashboard | the sheet's top row |
| Where | three places | the Dashboard | Quickfill, with a door on the Dashboard | the header, every page |
| The rule | three rules | one tier table | worst first inside Today's lines, then the round's order | one tier table |
| The Messages count | the badge | kept, equal to the people line | kept, equal to the station | the number |
| The Needs you card | the card | the rail | kept | kept |
| The Texts station | a station | a station | the Messages station's first fold | a station |
| A tech | unchanged | unchanged | unchanged | unchanged |
| An estimator | the card, the dock, the badge | the rail with their lines | unchanged | the number with their lines |
| Live station counts | on Quickfill | stale on the Dashboard, or 28 hooks | live, the stations' own | stale, or 28 hooks on every page |
| Cost | — | L | M, S S S | L |

## The recommendation

**B.** The round is the morning the owner has been building all week: Today's lines first in it
(v2.5843), the three presses (v2.5837), the Next line (v2.5868), the close sheet and the
Dashboard's round card (v2.5845). Messages is the one count that is not a station yet. Once it
is, the Roller is the one order, every card already says what to press first, the marks record
the morning, and the Dashboard's round card tells the owner what the office's first press was.
Everything B needs exists, and the station's figure is the badge's own read, so the figure rule
holds without a second count. A and C each build a fourth list, and both inherit a problem B
avoids: the stations' live counts live on Quickfill.

## Is this the best we can do?

The case against B.

1. **The first press is one page away.** The app opens on the Dashboard. The Roller is on
   Quickfill. The Start press on the round card makes it one tap, but the Needs you card's nine
   lines stand above it, and an assistant can read the card and never press Start. A puts the
   press on the landing page.
2. **One order is really two rules.** Inside Today's lines the order is worst first. Across the
   stations it is due first, then list order. Messages at station two sits above People Hours
   whatever the figures. A red line never outranks a station, and a station of 268 prospects
   never outranks a line of 2. The Roller is a walk, not a ranking.
3. **It folds the Texts station the owner shaped on 2026-10-24** (#157). The fold keeps the
   ledger and the history, but the station's own card and question go. Keeping both means a
   text counted twice in the round, or the Customers line's `textsElsewhere` rule on the station,
   which breaks the figure rule.
4. **Looked is not answered.** A station marks Looked once a day and the people keep waiting.
   By afternoon the badge says 5 and the station says fresh. That is the round's rule for every
   station, and Messages is the one station whose rows are people.
5. **The owner's morning gains a Start press he does not use.** His card is unchanged. A would
   give him one rail too.
6. **The estimator keeps three doors.** The card, the badge and the My Bids dock. B changes
   nothing for them, which is also nothing gained.

What would beat it: A with live counts, once the stations' counts come from one read the
Dashboard and Quickfill both call instead of 28 hooks. That is the real one rail. B is the step
that costs three small PRs now and leaves that door open.

## Decisions

1. **Which option**, or none.
2. **B, the Texts station**: fold it into the Messages station (drawn), or keep it beside with
   each text counted once.
3. **B, where Messages sits**: second, after Today's lines (drawn), or after the office stations.
4. **B, the Start press**: on the Dashboard's round card for the office only (drawn), or for the
   owner too.
5. **All, the Customers line**: stays on the Dashboard's card (drawn), or goes once Messages is a
   station.

## Where it plugs in

- **The counts**: `src/components/MessagesBadge.tsx` and `follow_up_count()`;
  `src/lib/dashboardNeedsYou.ts` (`NEEDS_YOU_RANK`, `rankNeedsYouItems`, `buildNeedsYouItems`);
  `src/hooks/useNeedsYouInputs.ts`; `src/lib/needsYouSources.ts` (`QUICKFILL_CARRIED_BY_STATION`,
  `QUICKFILL_HELD_BACK`, `QUICKFILL_CUSTOMER_TEXTS_HOST`); `src/lib/needsYouDoors.ts`;
  `src/lib/needsYouActor.ts`; `src/lib/followUp/customerCounts.ts`.
- **The round**: `src/lib/quickfill/round.ts`, `views.ts`, `sections.ts`, `nextLine.ts`,
  `markOutcome.ts`, `roundClose.ts`, `textsLedger.ts` and `textsLedgerIo.ts`;
  `src/components/quickfill/QuickfillRoundScreen.tsx`, `QuickfillRollerStrip.tsx`,
  `QuickfillRoundList.tsx`, `QuickfillNeedsYouSection.tsx`, `QuickfillTextsSection.tsx`.
- **The Dashboard**: `src/components/dashboard/DashboardPinnedQuickRow.tsx`,
  `DashboardNeedsYouCard.tsx`, `DashboardOfficeRoundCard.tsx`, `DashboardTeamsInboxCard.tsx`;
  `src/lib/dashboard/phoneFolds.ts`, `phoneOffice.ts`.
- **The header**: `src/components/Layout.tsx` (`renderNavLinks`), `src/lib/gc/access.ts`.
- **Docs and words**: `docs/QUICKFILL_ARCHITECTURE.md`, `docs/MESSAGES_ARCHITECTURE.md`,
  `docs/DASHBOARD_SECTIONS_ARCHITECTURE.md` → Needs You card, the Glossary's *Needs You card*
  and *Quickfill* entries, the guides `needs-you-card.md` and the Quickfill guides; a release
  note and a fragment per PR.

## How to verify

B, on a local preview as the dev, then as the sample assistant. The Roller opens on Today's
lines and its Next line is the first of the viewer's own lines. Next lands on Messages, whose
count equals the header's pill and the page's own count of everyone waiting. Each lane's press
opens `/messages` on that lane. The Texts ledger is the station's first fold and marks with it;
the Mark history window for Messages shows the old Texts marks. On Quickfill the Customers line
and Today's sends are gone from Today's lines and present on the Dashboard's card. On the
Dashboard before any mark today, the round card reads **Start ›** with Today's lines' Next line,
and the press lands on the Roller's first card. On the phone preset the round list shows Messages
second. A tech's and an estimator's Dashboard and header are unchanged.

## Where it stands

| What | Version | PR | State |
|---|---|---|---|
| The inventory and the three mock-ups | — | | proposed 2026-10-26 |
| PR 1 · the Messages station | | | not started |
| PR 2 · the lines move, the Texts fold | | | not started |
| PR 3 · the Start press on the Dashboard | | | not started |
