---
name: "Messages, worked like a desk — the loop switched fully on, Answer all one person at a time with a Mine lens, and a last-7-days strip whose every number is a door"
number: 140
group: ready
status: BUILDING — the owner's go 2026-10-21 on the recommended defaults (three revised after the code read, see § The seven decisions); BUILD_PLAN.md beside this file is the hand-off; PR 1 (#5957, the Office hours card) and PR 7 (the log_call migration and the Call kind) are filed with auto-merge armed; PRs 2–6 wait on the #139 stack's base (BUILD_PLAN § 0.2); § Where it stands is the record
summary: >
  With #139's six additions Messages is a complete record and a complete inbox, and the next
  gain is not another lane. Three levers: close the loop (an Office hours card, and a card on
  Messages for the owner that says which of the eight switches are still off, each a door: the
  team inbox read, reply push, the phone seats, the estimate and bill reminders as Offers);
  make the page a desk the office works one person at a time (Answer all over Needs a reply
  with the step's quick replies, a Show lens of Mine · Everyone, a Nudge that fills the step's
  words, a Call kind in the reply box that logs a call with the day they gave through a log_call
  RPC, Book a visit and Start an estimate on a lead's thread); and a last-7-days strip at the
  top (answered within an hour, longest wait now, texts not delivered, estimates sent → opened
  → accepted), every number opening its rows.
next: another session builds the train in BUILD_PLAN.md order (PR 1 the Office hours card first; PRs 1, 7 and 8 cut from main, the page PRs from the #139 stack's top until it lands — BUILD_PLAN § 0.2); drop a session card; keep § Where it stands true after each PR; the live test (BUILD_PLAN § 3, the ZZ customer is our own inbox and the owner's cell) once all nine are on main.
size: XL as a train of nine (S M M M L L M+migration M S); the switches themselves are the owner's presses, not code
blocker: none — a session to build it. PR 7 carries the train's one migration (log_call).
ver: proposed after v2.5681 · 5683 · 5686 · 5699 (punch list #139; its PRs 9–16 are still in the queue)
opinion: build — the record is done and the office still reads it top to bottom; a desk, a lens and a strip turn six true sections into one next press and one honest number, and the switch card turns three silent gaps into three presses the owner can see.
mockup: to-dos/messages-desk/mockup.html
---

# Messages, worked like a desk (#140)

## The ask, in the owner's words

Stephen, 2026-10-21, after the #139 train filed its sixth addition:

> Now that we've added these features, can you take a new holistic look at messages and let me
> know how we can achieve its highest and best use?

and, to the three levers that answered it:

> I think all of your suggestions are fantastic and realistic. Help me come up with an improved
> mock-up of what it could be

## Where Messages stands

`/messages` at the top of the #139 stack is six sections, each true: the kind pills and a search
over every line; **New**, **Needs you**, **Needs a reply**, **We owe them** (Follow up's queues
with Who has it, Sort all, No reply needed, Remind me Monday); **Waiting on them** (our line the
newest, two days or more); **Went out** (seven days of texts and emails with Quo's delivery mark
and an estimate email's opened · accepted); **Everyone we have talked with**. The thread is one
place per person: every channel, the estimate's moments as the app's own lines, files, papers,
the jobs rail, the reply box with quick replies, `/`, bills and estimates by line, Tie to, After
this sends. Around it: the job window's Note · Text · Email and the Pipeline bubble, Job Mode's
Message the customer for techs, the Dashboard's Customers line, the reply push, the assign rule,
Quo texts with STOP/HELP, the bids@ reader, the customer page, the morning run and Today's sends.

What it is not yet:

1. **A closed loop.** On 2026-10-14 every switch was off; Send texts is on now. `gmail-sync`
   reads the team box only once `messages_boxes_v1.team.address` holds an address (your open
   call: team@ or office@), so a customer who *replies by email* to an estimate or a bill answers
   into someone's own Gmail, and Needs a reply never hears it. Reply push is off, the Quo seats
   are empty (Call back in Quo stays grey), every per-step reminder is off, and Office hours is
   an `app_settings` value a dev sets by hand (`messages_office_hours_v1`, no card). Nothing on
   Messages says any of this.
2. **A page with a next press.** The Sort desk (`sortDesk.ts`) walks New one person at a time.
   Needs a reply has no desk: read, scroll, pick, open, answer, close, scroll. Who has it is on
   every row, but there is no lens for what *I* hold.
3. **A result.** The page shows activity and no outcome: how fast we answer, how long the
   longest wait is, how many texts fail, how many estimates we send are opened and then go quiet.
4. **Small holes in the thread.** The reply box writes a text, an email or a note; a call made
   from a cell leaves no line (the Follow up sheet logs calls for trades, the thread does not). A
   lead's thread has no Book a visit or Start an estimate. Two front doors (`/messages` and GC
   projects → Messages) open the same thread. The thread guide still ends "Calls and texts join
   it in a later update."

## The three lenses

- **The office's seat.** Taunya, Evan and Rosa on phones. Open Messages, press **Answer all**,
  six people answered in five minutes with the step's quick reply as the first draft. **Mine**
  shows what I hold and nothing else. A call I just made is logged where I am, with the day they
  gave, and that day holds the row until it comes.
- **The job behind the ask.** Nothing a customer says goes unanswered, by any channel. Every send
  lands (the delivery mark) and gets an answer or a nudge (Waiting on them, one press). A
  homeowner who texts books a visit or gets an estimate before they call the next plumber.
- **The whole office.** The owner sees which switches are still off and presses them from one
  card. The owner gets a read on whether communication works, with each number opening the rows
  that make it. One Messages, one front door, guides that match.

## The pieces

### Lever 1 · switched on

1. **Office hours card** (Settings → Phone and texts): days, open, close; the after-hours first
   text's words live on What customers see. Reads and writes `messages_office_hours_v1`, the key
   `hasRule.ts` already reads.
2. **Finish switching Messages on** — a card for the owner and devs, folded to a line at the top
   of Messages ("3 of 8 on ›"). Eight rows, each a status chip and a door to its setting: Send
   texts, Read bids@, Who gets a new message, the team inbox, Reply push, Company phone seats,
   the reminders the app offers (estimate and bill, as Offers), Office hours. **Later** folds it
   for a week; it is gone when all eight are on. The switches themselves are the owner's presses.

### Lever 2 · a desk

3. **Show: Mine · Everyone** — a two-value lens beside the kind pills, narrowing every lane (and
   the desk) to what I hold. Remembered per browser; starts on Everyone. (The mock-up drew a
   third value, Nobody's; the code read showed New already is the nobody's list — a person
   nobody holds whose newest line is theirs lands in New under "Who has it?" and leaves Needs a
   reply. Two values is the honest cut.)
4. **Nudge fills the words** — Waiting on them's Nudge fills the reply box with the step's
   reminder line (the estimate follow-up, the quote ask) and opens the send window: one read, one
   press, like **Text Greg** on Nudges from the flow. A text that did not deliver offers **Call
   them** and **Send it as an email** instead.
5. **Answer all** — the Sort desk's shell over Needs a reply, longest wait first: the person,
   their last words, job and step, the step's quick replies, the box, Tie to, After this sends;
   **Send text…** / **Send email…**, **No reply needed**, **Skip for now**, **☎ Call**. A send or
   a No reply needed moves on; someone who writes back meanwhile drops off. The end says what
   went and offers the quiet ones as a second pass. Under Mine it walks only what you hold.
6. **Log a call** — a fourth kind in the reply box: what they said, the day they gave, whose move
   it leaves. Lands as our line (`Called Tom. They said: …`, `channel 'call'`, `direction 'out'`,
   written by a new `log_call` RPC — a signed-in client cannot insert a call row, so this is the
   train's one migration); the existing trigger clears Needs a reply and the thread's chip flips
   to their move; the day they gave is a written promise on that line, which Waiting on them
   honors (holding the row until the day) and the thread's chip reads as *Their move · until …*
   (the first caller of `loadCourtFacts`, which exists and is unused today).
7. **A lead's doors** — **Book a visit** (Add Job with the lead's name, number and words filled)
   and **Start an estimate** (a customer made from the lead, the thread re-pointed to them, a
   new estimate opened on them) above the words of a lead's thread and on their Needs a reply
   row. Either takes them off Leads. Both need a small door that does not exist yet (Add Job's
   `openNewJob` takes no customer prefill; a new estimate takes no customer) — part of the PR.
   "Add to Prospects" is a pure kernel with no caller today and stays unbuilt; the mock-up's
   "Who is this? · kept as a lead" chip is not an app phrase (the thread's sub-line reads
   **Lead:** *name*).

### Lever 3 · a result

8. **The last 7 days** — a strip under the pills, four tiles, each a door: *Answered within an
   hour* (count, share, last week's share) → Needs a reply; *Longest wait right now* (who, who
   has it) → the thread; *Texts not delivered* → Went out's red rows; *Estimates* (sent → opened
   → accepted, how many opened and quiet) → Waiting on them. A tile with nothing behind it reads
   *none*. The strip reads what the lanes already read: the queue's wait times, Went out's
   delivery marks, the estimate event lines (`estimate:<id>:opened|accepted`).

### Housekeeping

9. **One front door and the guides** — GC projects → Messages becomes a link to `/messages`
   with Trade partners picked; the thread guide's stale closing section goes; the Messages guide
   gains Show, Answer all, Log a call, the strip and the switch card.

## Where it plugs in

- `src/pages/Messages.tsx` — the lens, the strip, the switch line, Answer all's door.
- `src/components/followUp/FollowUpPanel.tsx`, `src/lib/followUp/queue.ts`,
  `followUpRows.ts`, `assignSeats.ts` — narrow by who has it (the lens), Answer all's order.
- `src/lib/followUp/sortDesk.ts` + its screen — the desk shell Answer all reuses.
- `src/components/gc/messages/ThreadWindow.tsx`, `reply/`, `src/lib/messages/compose.ts`
  (`kind: 'text' | 'email' | 'note'` gains `'call'`), `promises.ts` / `owed.ts` (the day
  heard), `appLines.ts` (the call line's words).
- `src/lib/messages/waitingOnThem.ts` (+ `Io`), `wentOut.ts` (+ `Io`), `thread.ts`
  (`deliveryMark`), `src/lib/followUp/courtFacts.ts` — the strip's four numbers from reads that
  exist; the estimate funnel from the event lines `_shared/estimateEventLine.ts` writes.
- `src/lib/messages/hasRule.ts` (`messages_office_hours_v1`),
  `src/components/settings/PhoneAndTextsSettingsSection.tsx` — the hours card; the switch
  card reads the keys in `docs/MESSAGES_ARCHITECTURE.md` § the switches
  (`messages_texts_on_v1`, `gmail_sync_on_v1`, `messages_boxes_v1.team.address`,
  `messages_reply_push_on_v1`, `messages_quo_seats_v1`, `messages_assign_rule_v1`,
  `messages_nudge_app_sends_v1`, `messages_office_hours_v1`).
- The lead's doors: the sort card's lead path (`newLane.ts`), Add Job's open-with-fields door,
  the estimate's new-customer path (`contact_for_customer` keeps the thread).
- New: `messages_office_hours_v1` gets a card, no new table; the call line is a `messages` row
  (`channel: 'call'`, `direction: 'team'`, `who_text` the caller) with its day on the promise the
  flows already keep. No migration expected; if the call's day needs a column, one additive
  migration with the usual three `apply_*` calls.

## The plan

**The detailed plan is [`BUILD_PLAN.md`](./BUILD_PLAN.md)** beside this file: how to pick it up
(§0, including which base each PR cuts from while the #139 stack is in the queue, and the
"is this the best we can do?" questions every PR answers), the code as it is (§1, read on
2026-10-21), each PR's goal, files, kernel, words, tests, docs, check and verify (§2), the live
test with the ZZ customer being our own inbox and the owner's cell (§3), and what is not carried
(§4).

| PR | What | Size | Base |
|---|---|---|---|
| 1 | Office hours card | S | main |
| 2 | Finish switching Messages on (the card and its line) | M | the page base |
| 3 | Show: Mine · Everyone | M | the page base |
| 4 | Nudge fills the step's words; Call them / Send it as an email on a failed text | M | the page base |
| 5 | The last 7 days strip | L | the page base |
| 6 | Answer all | L | the page base, after PR 3 |
| 7 | Log a call (`log_call` RPC + migration) | M | main |
| 8 | A lead's doors | M | main |
| 9 | One front door; the guides | S | after 1–8 |

Each PR: `npm run claim`, a release note and a `docs/recent-features/` fragment, the guide
*answer everyone waiting on us from one page* amended, `PROJECT_DOCUMENTATION.md` /
`GLOSSARY.md` for the new words (Show, Answer all, the strip, Call), `ACCESS_CONTROL.md` for the
owner-only card, `docs/migrations/` for PR 7.

## The seven decisions

**Taken 2026-10-21: the owner's go on the recommended defaults** ("I think we should build all
of it, asking ourselves is this the best we can do along the way"). Three were revised by the
code read the same day (BUILD_PLAN § 0.3); build the revised form.

1. **Where the strip sits** — **the top of Messages**, four tiles over the last 7 days, each a
   door. (Not: a Dashboard card only.)
2. **Show's default** — **Everyone**, Mine one press away and remembered per browser.
   **Revised: two values, Mine · Everyone** — "Nobody's" is New by construction.
3. **Answer all's reach** — **Needs a reply first**, the quiet ones offered as a second pass at
   the end. (Not: one desk over both lanes.)
4. **What a logged call does** — **clears Needs a reply; the day they gave holds Waiting on
   them until that day**. **Revised: it is our `call` line written by a `log_call` RPC, with
   the day as a written promise on it** — a team note cannot do this (the chip would still say
   Our move and Waiting on them would never see it). The train's one migration.
5. **A lead's doors** — **both**: Book a visit and Start an estimate. **Revised in scope:** each
   needs a small door built (Add Job's customer prefill; a customer on a new estimate); Add to
   Prospects stays unbuilt.
6. **The switch card's home** — **on Messages for the owner and devs**, folded to a line, Later
   holds it a week, gone when all eight are on. (Not: a Settings card only.)
7. **What Nudge does** — **fills the step's words and opens the send window**. (Not: Today's
   sends.) The residential estimate follow-up and bill steps get real reminder words in the same
   PR; today the fallback reads "checking in on approved".

## How to verify

Per PR: BUILD_PLAN § 2 (each PR's *Tests* and *Verify*). The whole, once the train is on main:
BUILD_PLAN § 3 — Route B (a human presses every Send), with **the ZZ customer being us**: its
email is the team inbox's own address, its phone is the owner's own cell. So the estimate email
and text go out to us, the email reply from that inbox lands in the thread through the team
inbox read (the proof of lever 1), the text reply from that phone lands through the Quo webhook
with the ✓ delivered mark above it, and Answer all, Log a call, Nudge, Show and the strip are
walked on real rows. Delete the ZZ rows after (and check the owner's cell joins no other
contact).

## Where it stands

| PR | What | Version | PR | State |
|---|---|---|---|---|
| — | Proposal + mock-up + BUILD_PLAN | — | #5955 | merged 2026-10-21 |
| 1 | Office hours card | v2.5709 | #5957 | armed 2026-10-21 |
| 2 | Finish switching Messages on | v2.5712 | #5960 | filed 2026-10-21; armed once the #139 stack lands |
| 3 | Show: Mine · Everyone | v2.5713 | #5961 | filed 2026-10-21; armed once the PR below merges |
| 4 | Nudge fills the step's words | v2.5714 | #5962 5:claude/messages-desk-5-week-strip:claude/messages-desk-4-nudge-fills:v2.5715:#5963 6:claude/messages-desk-6-answer-all:claude/messages-desk-5-week-strip:v2.5716:#5964 | filed 2026-10-21; armed once the PR below merges |
| 5 | The last 7 days strip | | | not started |
| 6 | Answer all | | | not started |
| 7 | Log a call (+ migration `20261021010000_log_call`, `supabase db push` after merge; the Waiting on them hold moves to PR 4, since `waitingOnThem.ts` is the #139 stack's) | v2.5710 | #5958 | armed 2026-10-21 |
| 8 | A lead's doors | | | not started |
| 9 | One front door; the guides | | | not started |
| — | Live test (BUILD_PLAN § 3) | | | after 1–9 |

Keep this table true after each PR (version, PR number, armed / merged / live). The session that
proposed it (2026-10-21) built nothing; the owner chose another session to build the train.
