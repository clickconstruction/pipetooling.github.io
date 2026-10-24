---
name: "Quickfill Texts: the station reads Messages instead of asking for a note"
number: 157
group: close
status: BUILT — the owner picked A on 2026-10-24 ("I like your suggestions, build it all"); PR 1 the station v2.5816 (#6101, merged 2026-10-24), PR 2 the Customers line v2.5823 (#6105); left: the owner's look at the station live, then delete this folder
summary: >
  Quickfill's Texts station was built before Messages existed, when the company's texts lived
  in the Mac's Messages app. It asks a person to remember what they still owe on text and type
  it before the Mark will take. Today every company text goes through Quo into /messages, which
  knows which texts wait on a reply, which never reached a phone and which went out today. The
  station's history says what the box became: 128 marks since April, one most mornings, 126 of
  them the words "up to date". Three options: A, the station becomes the day's text ledger read
  from Messages' own lanes, with the Mark writing its note from the rows; B, the station keeps
  its stamp and shows the counts, each a door into Messages; C, the station retires into Needs
  you as one more line.
next: the owner's look at the station live, then delete this folder (the v2.5816 fragment links the mock-up)
size: A M · B S · C S
blocker: the owner's pick
ver: v2.5816
opinion: build A — the station finally answers its own question, the clean day is one press instead of a typed "up to date", the mark's note becomes a record of who was still waiting, and nothing is drawn that is not already a Messages row
---

# Quickfill Texts: the station reads Messages instead of asking for a note (#157)

## The ask

The owner, 2026-10-24, with a screenshot of Quickfill in Roller view on the Texts station:

> in quickfill, I do not think texts are as productive as it could be, could you help me come up
> with a better solution that is more useful?

The screenshot: the dot strip *5 of 28 · 13 left with work*, the banner *Did anything fall
through the cracks from today or yesterday?*, the status line *0 open · last look 22h ago ·
Taunya* with the history icon, the line **Open SMS** | **Still to text** *Before marking
complete, list threads or people you still owe a text (one item per line or free text)*, a large
empty box, the green **Mark Texts up to date!** and the round's **Mark inside · next →**.

## Today

Read on the page as the dev on 2026-10-24, in the Roller and in the station's history.

- The body is [`QuickfillTextsSection.tsx`](../../src/components/quickfill/QuickfillTextsSection.tsx)
  (built with the first Quickfill, before Messages): a link `sms:` that opens the Mac's own
  Messages app, a free box, and a Mark that refuses until the box holds something. The station
  is one of the three note-first stations (`QUICKFILL_NOTE_FIRST_SECTIONS` in
  [`round.ts`](../../src/lib/quickfill/round.ts)), so in the round and the Roller the foot says
  **Mark inside · next →** and only moves on.
- **The count is the typed lines.** `useReportQuickfillSectionMetric('texts', itemsNotedCount)`
  counts the non-empty lines in the box, so the status line reads *0 open* whatever is waiting,
  and every mark in the history has *Open items* **1**: the one line that says "up to date".
- **The history** (`quickfill_section_mark_events`, read from the station's history window):
  128 marks since 2026-04-15, by Taunya on all but two, one most working mornings between 8:30
  and noon. The notes: *up to date* 126 times (*utd*, *Up to date*, *all texts responded to*,
  *no open texts* in April, before the habit settled), one *added 3 to do's that need to be
  scheduled after talking to malachi* (Aug 5), one *Not Sure will have to get with Taunyna*
  (Roxi, Aug 18). The box is a formality the office pays every morning, and the one thing the
  station could keep, who was still waiting, it never has.
- **The banner** (`sectionBanners.ts`): *Did anything fall through the cracks from today or
  yesterday?* A question nothing on the screen answers.
- **The round** sees it as any station: due by its own rhythm (every day, from the marks), the
  count live while the page reports it, and *needs a note* on its row.

## What Messages already knows

Since the Messages build (`docs/MESSAGES_ARCHITECTURE.md`), every text through the company
number is a line in a person's thread, and `/messages` already draws the questions the station
asks, each with a pure kernel and a read the station could call without a new fetch shape:

| Question | Where Messages answers it | Kernel and read |
|---|---|---|
| Which texts wait on a reply? | **Needs a reply**: everyone open whose newest line in has no answer, longest waiting first, with Reply, Call back, No reply needed, Remind me Monday | `followUp/queue.ts` `needsReply` over `followUpRows.ts`, read by `followUpIo.ts` `loadQueue`; a row's channel is its landing line's (`lines.get(landOnId).channel === 'text'`) |
| Which of our texts never reached a phone? | **Went out**: each text with Quo's answer since v2.5703, ⚠ not sent or ⚠ not delivered red with ☎ Call them; the week's tile *Texts not delivered* | `messages/wentOut.ts` `wentOutDays` over `wentOutIo.ts` `loadWentOut` (7 days, 300 rows), `thread.ts` `deliveryMark`; `weekStrip.ts` `textsNotDelivered` |
| What went out today? | **Went out**, under *Today*, with who pressed it and the mark | the same read |
| Who went quiet after our text? | **Waiting on them**: our line the last word, two days or more, with Nudge and Call | `messages/waitingOnThem.ts` over `waitingOnThemIo.ts` (30 days, 1500 rows) |
| What do we owe someone? | **We owe them**: a thing with its day, and the call tasks | `queue.ts` `weOwe`, `messages/owed.ts`, `calls/callTasks.ts` |
| Which texts did the app prepare that nobody pressed? | **Today's sends**, the Needs you line and its window | `offers/offers.ts` `todaysSends` |

Two of these already sit on Quickfill, on the **Needs you** station since v2.5771
([`needsYouSources.ts`](../../src/lib/needsYouSources.ts)): the **Customers** line, *N need a
reply, N we owe, N to sort*, customers only and every channel (`followUp/customerCounts.ts`
over `customerCountsIo.ts`, which reads the whole queue), with its door `/messages?kind=customer`;
and **Today's sends** with its window. So a new Texts station must not say those twice, and the
plan below says how.

Two things Messages does not know, and no option can draw: a text sent from someone's own
phone outside Quo, and a text to a number the app never heard from. The free box is the only
home for those, which is why A and B keep one line of it.

## Options

All three are in [`mockup.html`](./mockup.html): the Roller on a desk, light, and the round on a
phone, dark, each a frame of its own. Every press in a frame only says what it would do. The
made-up day: two texts waiting on a reply, one of ours Quo could not deliver, six that went out
today, two the app prepared.

### A · The day's text ledger, read from Messages (recommended)

The body is three of Messages' lanes, narrowed to texts, in the words the office already reads
there, each a band in the lane's color:

- **Needs a reply · 2**: every text nobody has answered, from anyone, the one waiting longest
  first. A row is the name, their kind, their first words, when it came and how long it has
  waited, with **Reply** and **☎ Call**. Reply opens the thread on `/messages` with the box ready
  for a text, the same door Needs a reply's row has; Call is the one Call button
  (`CallButton`, to-do #152). The band's **Answer all ›** opens Needs a reply's desk.
- **Not delivered · 1**: every text of ours from today and yesterday that Quo marked ⚠ not sent
  or ⚠ not delivered, red, with **☎ Call them** and **Send it as an email**, the two presses
  Waiting on them gives a failed text. The banner's *today or yesterday* lives on here.
- **Went out today · 6 · 5 ✓ delivered · 1 waiting on Quo**: the receipt, every text we sent
  today with Quo's mark, folded to one line until **Show** opens it.
- One quiet line while any wait: *2 texts the app prepared wait on Today's sends · Open ›*, the
  same window Needs you opens. Not counted here; Needs you counts it.
- **Anything else?**, one optional line, for a text the app cannot see.
- **Mark Texts up to date!**, which no longer needs a note.

**The count** is the work: texts needing a reply plus texts not delivered, *3 open*. The receipt
and Today's sends are not counted, so a day with six delivered texts and nothing waiting reads
*0 open*. **The Mark** means *someone looked at every text waiting on us at this moment*; it does
not clear a row, a reply or a call on Messages does. The note the history keeps is written from
the rows: *2 need a reply · Marcus Calloway 2 h, Dana Whitfield 1 h 40 m · 1 not delivered · Tom
Reyes · 6 went out, 5 delivered, 1 waiting on Quo*, plus whatever was typed in Anything else.
The station leaves the note-first set, so the round's foot is **Looked · 3 open · next →** like
every other station, and the history's *Open items* finally counts texts. **The banner** becomes
a question the rows answer: *Is anything on texts still waiting on us?*

**On a phone** the round draws the same bands and rows, a row two lines tall with its presses
under it, the receipt folded, then Looked at the thumb. With three rows waiting the station fits
the screen. A press on Reply leaves Quickfill for the thread on Messages; the browser's back
returns to the station through its own link (`?station=texts`), as every door on Quickfill does.

**A clean day** is one green line, *Nothing on texts is waiting on us. 6 went out today, all
delivered.*, and one press. Taunya's morning goes from typing *up to date* to reading one line.

- **Reads**: `loadWentOut` as it is (today's and yesterday's rows from the seven), and the queue
  through `loadQueue`, which Needs you's Customers line already reads on the same page. PR 1
  accepts the second read, as the Dashboard already makes it on every load; folding the two into
  one page-level read is the follow-up named below.
- **Is this the best we can do?** For the station, yes: it stops asking a person to remember what
  the app keeps, and the three groups are the three ways a text falls through the cracks. The
  thing it still cannot do is reply in place, and it should not: the thread on Messages is the
  one place to write, and the row's Reply takes you there.
- **Are we being straightforward?** The rows are Messages' own, read by Messages' own kernels,
  so the station and the page can never disagree. One thing is said in two places on purpose: a
  customer's unanswered text would count on Needs you's Customers line and here, so on Quickfill
  the Customers line gives its texts to this station (decision 3). Today's sends stays on Needs
  you and is only pointed at. The size is M because the ledger is a new kernel with its tests, a
  hook, the redrawn body and the words, not because anything new is stored.

### B · A pointer: the counts, each a door into Messages

The station keeps its stamp and gives up the box. The body is four lines, each a figure, the
names behind it and a door that opens Messages on the right lane: *2 texts need a reply* →
**Needs a reply ›**, *1 text did not reach its phone* → **Went out · Texts ›**, *6 texts went out
today, 5 delivered* → **Went out ›**, *2 the app prepared wait* → **Today's sends ›**. Anything
else stays as one line. The Mark writes the same note as A from the counts.

**The count** is A's, *3 open*. **The Mark** means *someone looked at the counts*. **On a phone**
each line sends you to Messages and back; who is waiting is not on the screen until you go.
**A clean day** is four zeros and one press.

- **Reads**: the same two as A; only the drawing is less.
- **Is this the best we can do?** No. It is the honest small step: the counts are true and the
  doors are right, but the station becomes a table of contents for another page, and on a phone
  the round sends you away four times for one question. The Went out door narrowed to texts is a
  new URL parameter on Messages (`?sends=texts`), since today only the week's tile sets the
  filter.
- **Are we being straightforward?** Yes. Nothing is drawn twice. The cost is that the office
  works texts on two pages, one to see the count and one to see the name.

### C · Retire the station into Needs you

The Texts station goes: its registry line, its body, its banner and its place in the note-first
set. Needs you, which already carries **Customers** and **Today's sends**, gains one line,
**Texts**: *2 need a reply, 1 did not reach its phone*, with a door to Messages at Needs a reply,
a new source `texts` in `needsYouSources.ts` on both hosts, so the Dashboard gets it too. The
round is 27 stations.

**The count**: none of its own; the line adds to Needs you's. **The Mark** that covers texts is
Needs you's, thirty lines at once. **On a phone** it is one line in Needs you's list. **A clean
day** says nothing about texts anywhere, since a Needs you line is drawn only while it has
something.

- **Reads**: the same two, once, since Needs you already reads the queue.
- **Is this the best we can do?** It is the cheapest and the most honest about where the work
  is. But it ends the one thing the history shows the office wants: a daily stamp on texts, 128
  mornings running. Needs you's mark says nothing about texts in particular, and there is no
  *nothing waiting* line to press on a clean day.
- **Are we being straightforward?** Mostly. A customer's unanswered text would sit on the
  Customers line and the Texts line, so the Customers line would have to give up its texts on
  both hosts, which changes the Dashboard's line too. The text the app cannot see has no home.

## Decisions for the owner

1. **Which option**: A, B or C. The recommendation is A.
2. **The banner**: *Is anything on texts still waiting on us?* (drawn), or keep *Did anything fall
   through the cracks from today or yesterday?* The banner is a setting a dev can change on the
   page either way (`quickfill_section_banners`).
3. **Needs you's Customers line on Quickfill gives its texts to the Texts station** (A and B): the
   line keeps emails, calls, voicemails, the portal and what we owe, and the Texts station holds
   the texts; the Dashboard's line is unchanged. Or leave both counting the same customer, and say
   so on the line. The recommendation is to give them, so the round's *left with work* counts each
   text once.
4. **Whose texts**: every kind (customers, trade partners, subs, leads, our team), as drawn, or
   customers only like the Customers line. The recommendation is every kind; a sub's text falls
   through the same cracks.
5. **How far back Not delivered looks**: today and yesterday, as the banner says, or the week like
   Messages' tile. Needs a reply has no cutoff; a text waiting five days is still waiting.
6. **Anything else?**: keep the one optional line (drawn), or drop the box entirely and let the
   history's note be the rows alone.
7. **Today's sends on the station** (A): the quiet pointer line as drawn, or nothing, since Needs
   you carries it.

## Where it plugs in

Option A, one PR, one version, no migration, no edge function.

- **The kernel**: a new pure `src/lib/quickfill/textsLedger.ts` with its test beside it. In:
  the queue's Needs a reply rows with their landing lines (`FollowUpQueue.needsReply`,
  `FollowUpLine`), the contacts, `WentOutLine[]`, today's `ymd`, now. Out: the three groups
  (`needsReply`, `notDelivered`, `wentOutToday` with its delivered and waiting counts), the
  count, the clean-day words, and `markNote(groups, typed)`, the note the Mark writes. The rows
  reuse `wentOut.ts`'s `rowOf` words and `deliveryMark`, and Needs a reply's row the thread door
  `messagesThreadHref(contactId, landOnId)` from `messages/customerThread.ts`.
- **The read**: a hook `useQuickfillTexts` at page level in
  [`Quickfill.tsx`](../../src/pages/Quickfill.tsx), beside `useQuickfillPercentComplete`, so the
  metric reports from page level through `useReportQuickfillSectionMetric('texts', count)` as
  `percent-complete` does; it calls `loadWentOut()` and `supabaseFollowUpIo().loadQueue(today)`
  through `followUpInputFromRows` and `followUpQueue`, the way `customerCountsIo.ts` does, and
  refetches on focus and after a mark. Loaded only while the station would render
  (`sectionWouldRenderOnPage('texts')`).
- **The body**: `QuickfillTextsSection.tsx` redrawn over the kernel: the bands
  (`.stagesSectionBand` with the lane colors from `messages/jumpStrip.ts`), the rows, the fold,
  the quiet line, the one-line box, the Mark, which calls `onConfirmMark(markNote(...))`. The
  station's render smoke replaces the textarea test. Reply navigates to the thread; Call is
  `CallButton`.
- **The round**: `'texts'` leaves `QUICKFILL_NOTE_FIRST_SECTIONS` in `round.ts`, so the foot
  draws Looked and `roundLooked` marks with the live count; the Mark inside stays for the desk,
  writing the note (the round's Looked writes none, as every other station).
- **Needs you's Customers line** (decision 3): `customerMessageCounts(queue, contacts, { textsElsewhere })`
  leaves out a Needs a reply row whose landing line is a text when the flag is on;
  `useNeedsYouInputs` passes it for the `quickfill` host; `QUICKFILL_CARRIED_BY_STATION` cannot
  carry half a source, so a line in `needsYouSources.ts`'s header says where the texts went, and
  `needsYouSources.test.ts` holds it.
- **The banner**: `sectionBanners.ts` `texts`.
- **The words**: the guide `run-the-office-day-with-quickfill` (the three lines that say Texts
  keeps its mark inside), the Quickfill entry in `docs/GLOSSARY.md`, the `texts` dossier in
  `docs/QUICKFILL_ARCHITECTURE.md`, a line in `docs/MESSAGES_ARCHITECTURE.md`'s *Where it is in
  the app*; no page is added, so `docs/twins/APP_DIRECTORY.md` is unchanged. A release note and
  a fragment.
- **A follow-up, not this PR**: Quickfill then reads the queue twice on load, once for Needs
  you's Customers line and once here. One page-level read handed to both is a small refactor of
  `useCustomerMessagesCounts` to take the rows from a provider; worth doing once the station has
  earned its place.

Option B plugs in the same way with no rows: the hook reports the four counts, the body draws
the lines, and Messages gains `?sends=texts` beside `?kind=`. Option C is a delete, a new
`texts` source with its gate, hook, door and parity test, and the Customers line change on both
hosts.

## How to verify

Quickfill → Texts as the dev or an assistant, in the Roller and at the phone preset. Send a text
to the walk kit's contact from Messages and watch it appear under Went out today with its mark;
have the kit reply and watch it appear under Needs a reply with the wait; press Reply and land in
the thread with the box ready; come back and mark, then open the history and read the note.
With nothing waiting, read the one green line and mark with one press. Nothing is sent or marked
on prod from a test press.

## Where it stands

Proposed 2026-10-24 as a docs-only PR (#6095). The owner picked A the same day, with the three sibling proposals at once. PR 1, the station itself, is v2.5816 (#6101, merged 2026-10-24): the ledger kernel and its read, the body with the drawing's Answer all and Send it as an email, the page's own Mark writing the ledger's note, the banner, the guide and the docs. PR 2, v2.5823 (#6105), is the Customers line on Quickfill giving its texts to the station (decision 3): one flag through the kernel, the read and the hook, the Dashboard's line unchanged.
