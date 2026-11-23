---
name: "Messages: a day was heard, say what it is"
number: 421
group: ready
status: building 2026-11-23 on the owner's word, straight to the choice · PR 1 #9510 armed · PR 2 #9514 the migration open, unarmed · PR 3 #9526 the choice open, unarmed · PR 4 #9533 the write-throughs open, unarmed · PR 5 #9536 the mark's job open, unarmed
summary: >
  When a person names a day in a text or a voicemail, Messages was planned to lift the day out,
  ask the office what it is a promise of, and write it where that kind of date lives. The table, the
  function, the words and the write-throughs were built in October. Three pieces were never drawn: a
  voicemail's Keep the day, the row that offers a heard day, and the choice under the line. Card
  #129 built the one kind the office uses, a customer's promise to pay, by another road. This card
  keeps the rest so it is not lost, with what exists, what is missing and what it would take.
next: Push #9514's migration, then its types PR and the dev seat's deploy; arm #9526, #9533 and #9536; walk it on a ZZ Test thread as the card's verify recipe says.
size: M as a train of five (S · XS · M · M · XS)
blocker: The push of #9514. PRs 3 to 5 wait on it.
opinion: build — the owner's call of 2026-11-23
---

# Messages: a day was heard, say what it is (#421)

## Left to do

The owner's calls of 2026-11-23: **build it**, and **straight to the choice** (one press under the line, no offered row). A
customer's payment opens #129's sheet. The screens he approved are the *after* of the ledger's `heard` section.

1. **PR 1, v2.8382**: the words of the choice (`messages/heardChoice.ts`) and the move line's words; the Follow up guide
   no longer describes the unseen button. PR #9510, armed.
2. **PR 2, v2.8383**: the migration (`20261123185942_heard_day_write.sql`): `write_down_heard` writes a line's day and
   kind in one press or just talk, and `message_promises.job_id` with `write_down_payment`'s `p_job_id` gives a payment
   mark its job. PR #9514, unarmed: the parent pushes it, then a types PR and the dev seat's deploy.
3. **PR 3, v2.8384**: the choice under a line (`useFollowUpThreadSlots`' `underLine` over `heardChoice.ts`): their
   kinds, *just talk*, a voicemail's *Another day*, a customer's *A payment* opening #129's sheet, and a line already
   said reading *Written down as their quote by Wed Nov 25.* Written on the line only; PR 4 adds where else it goes.
   PR #9526, unarmed until PR 2's push.
4. **PR 4, v2.8385**: the write-throughs' hands (`messages/promiseWritesIo.ts`): the read that fills `PromiseAt` (the
   line's job by name and kind, the company's open ask, the person's standing holds) and the writers through the Board's
   own verbs, the bid's contact log and `nudge_hold_until`; the toast names where it went, every skip and a refusal.
   PR #9533, unarmed until PR 2's push.
5. **PR 5, v2.8386**: a payment mark carries its job, the small extra below. The sheet's job goes with the mark, the
   job's *They promised* reads its own marks, and *Never said that* leaves another job's. The press also finds the
   line's own job from its key (`tiedJobId`), a fault found on the way: the whole key was compared with a job's id, so
   a line's own job never matched. PR #9536, unarmed until PR 2's push.

## Where this comes from

Punch list #129 closed on 2026-11-22. Its card named three things that were *still on no screen*:
the offered row, a voicemail's **Keep the day** and the chooser on `write_down`. None was on #129's
list of leftovers, so they were never its to build. The owner asked for help handling them the day
the card closed. They turned out to be one flow with a hole in the middle, so this card holds them
together.

## The flow as it was planned

Messages' cut 2 (`20261012160000_messages_follow_up.sql`, the prototype v1.178) planned this:

1. A reader finds a day in a line. A voicemail's transcript, a call's summary or a text.
2. The day is **offered**: a `message_promises` row in state `offered`, with no kind yet.
3. Follow up's row for that person carries a press, *A day was heard: Wed Oct 7 · say what it is*.
4. The press opens the thread at the line. Under the line, *Wed Oct 7 is a promise of* and a button
   for each kind, by who the person is, then *just talk*.
5. The choice writes the row as `written` with its kind (`write_down`), and the same press writes the
   day where that kind of date lives (the write-throughs).

## What exists

- **The table** `message_promises`: a heard day is `offered`, `written` as one of eight kinds, or
  `no` for just talk. A plans question is the same table's other half.
- **The function** `write_down(p_message_id, p_kind, p_writes)`: takes an offered row and writes its
  kind, or just talk with no kind. It refuses a line with no offered row. `followUpIo.ts` wraps it as
  `writeDown`, and nothing calls it.
- **The words and the kinds** (`src/lib/messages/promises.ts`): `promiseChoices` by who they are. A
  customer: a payment, their answer on our bid, a day we can be on site. A trade partner: their
  quote, a start or delivery, insurance or a W-9. An architect: their answer, the certificate.
- **The write-throughs** (`src/lib/messages/promiseWrites.ts`): where each kind also goes, in the
  exact arguments of the verb that writes it, with words for every write it skips. Pure and tested.
  Nothing reads what it needs or makes its writes.
- **The voicemail reader** (`src/lib/messages/voicemailRead.ts`): `heardDay` reads the first day said
  in a transcript and returns a chip with **Keep the day** and **Another day**, and the offered row
  Keep the day would write. v2.5406's note says the chip is there. It is a kernel only.
- **Follow up's press** (`FollowUpSections.tsx`, `rowOffers`): drawn for any offered row, and it
  opens the thread at the line.
- **The guide** *see who is waiting on us and what we owe them* tells the office about that press.

## What is missing

1. **Nothing can write an offered row.** No function inserts one, no reader runs on the server, and
   a signed-in client has no insert on the table. So step 2 never happens, and the press in step 3
   can never appear. Left so by the owner's call (straight to the choice), and the guide no longer
   describes the press since PR 1.
2. **The voicemail chip is drawn nowhere.** *Keep the day* is not needed straight to the choice, and a
   voicemail's **Another day** sits in the choice since PR 3.
3. **The choice under the line is drawn nowhere.** Built by PR 3 (v2.8384), straight to the choice.
4. **The write-throughs have no hands.** Built by PR 4 (v2.8385).

## What #129 built in its place

For a customer's promise to pay, the office has a whole road since 2026-11-22:

- **Write down their word** sits under a customer's own line (v2.5649).
- A day they said in their own text or voicemail is drawn beside it, *They said Fri Nov 27.*, and
  opens the sheet with the day filled in (v2.8255).
- A saved promise marks the line as a payment by that day (`write_down_payment`, v2.8268 and
  v2.8271), so the job's **They promised** row and the thread's *Their move · until* read it.
- **Never said that** takes the mark back off, and keeps the day while another promise of the
  customer's still names it (PR #9419).

That road skips the offered state. The day is read on the screen, and one press writes it.

## What prod says, read as the dev on 2026-11-22

- `message_promises` holds one row in all, the one #129's walk left on a test customer's line. No
  day has ever been offered, written or called just talk by the office.
- Three contacts are trade partners or architects. Every other kind the choice would offer is theirs.

So the unbuilt kinds would serve three people today. A customer's answer on our bid and a day we can
be on site are the two kinds a customer could use that have no road yet.

## The calls, each the owner's

1. **Build it, leave it for later, or drop it.** The pick here is later. If GC work brings trade
   partners and architects into Messages, the flow earns its keep then.
2. **If it is built: offer first, or straight to the choice.** Offer first is the plan: Keep the day
   saves the day, and someone says what it is from Follow up. Straight to the choice is what
   Write down their word does now: the day is read on the screen, and one press under the line says
   what it is. The second needs no offered row from a person, and keeps the offered state for a
   reader on the server.
3. **A customer's payment in the choice.** It should open the sheet #129 built, so a payment promise
   has one road and the Pipeline stays its record.
4. **The guide's sentence about the press.** Until the flow is built, the sentence describes a button
   that cannot appear. It can come out now and go back with the build.

## The plan, if it is built

A train of five, smallest first. A mock-up of PR 3 comes before any of it.

1. **The write** (S, a migration): one function that writes a line's day in one press, as
   `write_down_payment` does for a payment. Either `keep_heard_day` for an offered row, or the day
   and its kind together, by call 2. With its bed test under `supabase/tests/messages_follow_up/`.
2. **The types** (XS): the generated types and the dev seat's catalog, after the push.
3. **The choice under a line** (M): under a text or a voicemail that names a day still ahead, for
   any kind of person, *They said* and the day, then the kinds by who they are and *just talk*. A
   customer's payment opens the sheet. A voicemail's **Another day** lets the office correct the day
   read.
4. **The write-throughs' hands** (M): the read that fills `PromiseAt` and the five writers, each
   through the verb its place already has. Every skip and every refusal is said in the kernel's words.
5. **The guides** (XS): *see who is waiting on us and what we owe them* and *reply to a person from
   their thread*.

## One more thing #129 left, small

**A line's mark carries no job.** The job's **They promised** row reads the promises on the
customer's thread, so a customer with two jobs sees each job's row name the other's day. PR #9419
stopped the wrong removal. Giving the mark its job takes a column on `message_promises` and an
argument on `write_down_payment` (XS to S, with its types). It matters only when one customer has
two jobs promised at once. Built by PR 5 (v2.8386), with the column and the argument in PR 2's migration.

## How to verify, when built

On the dev server as the dev, on a ZZ Test customer's thread only, since every press writes prod.
Send a text into the thread that names a day still ahead. Read the day beside the line, press each
kind once on a fresh line, and read the place each one writes. Put every row back and name any left.

## How to retire it

Delete the card when the owner drops it, or when the train ships and its walk is done.
