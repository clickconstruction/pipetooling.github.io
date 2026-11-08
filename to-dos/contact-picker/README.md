---
name: "The To chip: pick the number, the address and the person a send goes to, and remember the pick"
number: 118
group: waiting
status: BUILDING 2026-11-08 on the owner's word, which stood in for Grace's look (built as drawn) — PR 1 v2.6699 (the usual number `contact_channels.usual_at`, the rule, the To chip on the send window, Who is this? asks; migration `20261108170919_contact_channel_usual.sql`, pushed right after the merge, then `messages-nudge-dispatch` redeployed); PRs 2 to 4 not built
summary: >
  Every send today picks the number and the address by a rule and offers no choice: the first number
  that can still take a text, the first address, the customer's own contact rather than a person at
  the customer. A To chip on the send window, the Tell the customer sheet and the tech's On my way
  shows where the text goes and, when a customer has more than one number or address, opens a short
  menu to switch, with "Make this their usual" so the pick is remembered. The same chip offers the
  job's people when a job has more than one, the starred one first. One recipient rule in one kernel
  feeds the thread, the sheets, the morning run, the call task's dial and the tech's text, so a pick
  made anywhere holds everywhere.
next: Another session builds PR 2 from the hand-over section (the chip on the Tell the customer sheet and On my way, the tech's gate) once PR 1 is merged and pushed; the owner walks PR 1 on a ZZ Test customer with two numbers (How to verify, steps 1 to 3 and 5). Then PR 3 (Who on this job) and PR 4 (the address side).
size: M as a train of four (the usual channel and the chip, the sheets and the tech, who on this job, the address side); each PR S or M; left: PRs 2 to 4 (S · M · S)
blocker: none for PR 2; PR 3 and PR 4 wait on the owner's look at PR 1 and PR 2 live
opinion: build the usual channel and the chip first; it closes the gap where a customer texted from a second phone and the rule keeps answering the first. Who on this job second. The address side last, since the estimate already has an override box.
ver: v2.6699
mockup: to-dos/contact-picker/mockup.html
---

# The To chip

## The ask

Grace, 2026-10-17: *do we make it easy for a user to choose who to contact when on a job, or when a
customer has multiple emails or phone numbers?* The honest answer was no. Every surface picks by
rule and offers no switch, and nothing remembers a pick.

## What is already there

- **The recipient rule** (`src/lib/messages/compose.ts` → `replyRecipient`): the first number that can
  still take a text, else the first number on file; the first address. The send window reads it
  (`SendWindow.tsx`), so a text goes to the oldest number that has not sent STOP.
- **The Tell the customer sheet** (`TellCustomerSheet.tsx`): the first number on the customer's own
  contact (`contact.numbers[0]`). It shows the number it goes to, with no switch.
- **The morning run and Today's sends** (`nudgeRunInputs.ts` → `textNumberOf`): the number the
  thread last carried a line on, else the first added, skipping a STOP. A held row says only *no
  number*.
- **The tech's On my way**: `quo-send`'s tech path takes the customer's number from their record, a
  single field (`customers` phone).
- **The call task's Call** and the moved visit's text: the first number without a STOP.
- **The estimate's email**: the customer's CRM address, with a typed override (`sendEmailOverride`
  on `Estimates.tsx`). The one real choice in the set.
- **People, not just numbers**: a customer can have several contact persons
  (`customer_contact_persons`), each a Messages contact with its own thread. The booking and estimate
  sheets always text the customer's own contact (`contactForCustomer`), never a person at the
  customer. The job's speech bubble opens that same thread. A job keeps its people in `contact_jobs`
  with `is_default`, the starred one. The GC side has Who to call on the board (`GcPeoplePill`); the
  residential side has nothing like it.
- **How numbers multiply**: most residential customers have one phone and one address. A second
  number appears when the customer texts from another phone and the office answers *Who is this?*,
  which adds a channel to the contact. From then on the rule quietly keeps the older number, which
  may be the landline.
- **The customer's say** (#115 PR 6): `contacts.prefers` holds text, email or either. That is the
  kind of channel. The chip picks within a kind.

## The decision

One rule, one default, remembered. Three parts:

1. **The usual channel.** `contact_channels.usual_at timestamptz`: the number or the address the
   office picked for them, one per kind per contact (a partial unique index). The recipient rule
   becomes: the usual, else the one the thread last carried a line on, else the first that can still
   take a text, else the first. One kernel change in `replyRecipient`, and `textNumberOf` reads the
   same order, so the thread, the sheets, the morning run, the call task's dial and the tech's text
   all agree.
2. **The To chip.** On the send window, the Tell the customer sheet and the tech's On my way: *To
   (830) 555-0121 ▾*. With one number of the kind, the chip is a label and nothing changes. With
   more, it opens a short menu: each number with when it last carried a line, a STOP marked, the
   usual starred. Picking one sends there this once; **Make this their usual** stars it for every
   send after. The office presses the menu; the tech sees the same chip and may switch, since this
   is a number, not words (the owner's rule from #112 is about words).
3. **Who on this job.** When a job has more than one person (the customer's own contact and a person
   at the customer, or two persons), the sheets and the job's speech bubble offer them, the starred
   one first (`contact_jobs.is_default`). The pick is per send; **Make this the job's usual** stars
   them. A person with no number of the kind is listed grey with why.

What stays as it is: the rule's fallbacks, so a customer with one number never sees a menu; the
customer's say (text or email) above the chip, which still decides the kind; the estimate's override
box, which becomes the *another address* row of the chip's menu rather than a bare field.

## The five calls, settled

The owner, 2026-11-08: build it as drawn; his call stood in for Grace's look. PR 1 (v2.6699) built calls 1, 2's
office half and 4 as written below, with two readings of its own: the usual's "partial unique index" is an ordinary
index, since *Who is this?* folds a named number into the record's own contact by moving channel rows and a unique
index would refuse the fold when both sides carry a usual (the function keeps one per kind; the readers take the newest
when two meet); and the morning run reads the usual (call 3's first half) while *a held row names the number it would
go to* waits on PR 2. Call 2's tech half and call 5 are PR 2's.

1. **Where the usual lives.** On the channel row (`contact_channels.usual_at`), not on the contact:
   a contact may have a usual number and a usual address at once, and the row already carries
   `opted_out_at`, so a STOP on the usual drops it from the rule without a second table.
2. **Who may set it.** The office team, through a definer gated by `follow_up_press`; the tech too,
   from the On my way sheet, through the same function (the gate widens to the tech's own
   destinations' customers). A gray line in the thread each time: *Rosa made (830) 555-0121 Dana's
   usual number.*
3. **The morning run.** Reads the usual first. A held row on Today's sends names the number it would
   go to, so a wrong usual is seen before a press.
4. **Who is this?** When the office names a new number, the answer sheet asks *Make this their usual?*
   with the old number beside it, since that is the moment the office knows which phone the customer
   is actually holding.
5. **The tech's chip.** Shown, switchable, remembered as the usual only when the tech ticks *Make this
   their usual*; a plain switch is this once. The office sees the gray line either way.

## Hand-over: PR 2, ready to build

The owner stopped the first session on 2026-11-08 after PR 1 so another machine can pick PR 2 up.
Everything it needs is on `main` once PR 1 (v2.6699) merges and its migration is pushed.

1. **The pieces PR 1 left.** `contact_channels.usual_at` and `contact_channel_make_usual(p_channel)`
   (gated by `follow_up_press`, the office team); `numberOrder` / `replyRecipient(contact, { lines,
   numberChannelId })` in `src/lib/messages/compose.ts`; `numberChoices`, `chipHasMenu`, `usualToSet`
   in `src/lib/messages/toChip.ts`; the component `ToChip.tsx` in
   `src/components/gc/messages/reply/` (props `choices · pickedId · onPick · tick · onTick`);
   `ReplyIo.makeUsual`. Reuse all of it; write no second chip.
2. **The Tell the customer sheet** (`src/components/customers/TellCustomerSheet.tsx`, both moments:
   the booking's first visit and the estimate's text): the sheet reads `contact.numbers[0]` today.
   Read the customer's contact channels with `usual_at` (`tellCustomerIo.ts` line ~146 already
   selects `contact_channels`; add `usual_at`), build `numberChoices` from them and the thread's
   lines, draw `ToChip` beside *Text to*, and pass the picked `channelId` into the send
   (`tellCustomerIo` → `quo-send` takes `channelId` already). The tick calls `makeUsualChannel`
   (`replyIo.ts`) before the send, as `SendWindow` does. Keep #115's say note beside the chip.
3. **The tech's On my way** (`OnMyWaySheet.tsx`, `src/lib/jobModeOnMyWayIo.ts`,
   `supabase/functions/quo-send`'s tech path, `_shared/quoTechSend.ts`): the tech path takes an
   optional `channelId` instead of the record's phone; the sheet draws the chip (*Dana · (830)
   555-0190 ▾*), a plain switch is this once, the tick makes it the usual (the card's call 5). The
   gate widens: a second migration adds `contact_channel_make_usual`'s tech door, e.g. a check that
   `messages_tech_can_read()` finds the contact on the tech's jobs this week or last (the R5 door,
   `20261013190000_messages_tech_door.sql`) when `gc_office_team()` is false. `npm run claim --
   --migration`, `SET lock_timeout`, a `docs/migrations/` page; **the coordinating session pushes**.
4. **The moved visit's offer and the call task's dial** read the usual: `textNumberOf` already
   does for the morning run; find the two other pickers (`grep -rn "opted_out_at" src/lib/calls
   src/lib/tellCustomer src/lib/schedule`) and route them through `numberOrder`.
5. **Today's sends names the number a held row would go to** (the card's call 3, second half):
   `offerHeld` words in `src/lib/flows/nudgeDispatch.ts` gain the number.
6. **Words:** one release note + fragment per PR, the guide *pick the number a text goes to* gains
   a section for the sheet and the tech, *text a customer from the job* a sentence, `GLOSSARY.md`'s
   Messages entry a clause, `ACCESS_CONTROL.md`'s Messages cut 1 paragraph the tech door,
   `EDGE_FUNCTIONS.md` → quo-send a `v2.NNNN` block (**redeploy `quo-send` after the merge**), this
   card's front matter. Verify on a ZZ Test customer with two numbers (How to verify, steps 2 and 3).

## Alternatives weighed

- **A per-send picker with no memory.** Rejected: the second phone keeps winning the next time by
  the old rule, and the office presses the menu on every text.
- **A contact-level `usual_number_id`.** Rejected for the channel row: a STOP on the usual would leave
  a dangling pointer, and the address needs the same word.
- **Always ask when there are two.** Rejected: an interruption on every send for a customer whose
  second number is a dead landline. The chip is a label until pressed.
- **Fold the persons into one thread.** Rejected: a person at the customer has their own thread and
  their own say; Who on this job picks a thread, it does not merge them.

## Is this the best we can do? The second pass

Three things the first draft missed:

- **The last line's number is a signal, not a default.** A customer who texts from a second phone
  once should not move the usual. The rule keeps *the one the thread last carried a line on* as the
  second choice, below the usual, so a reply goes back to the phone they wrote from until the office
  stars one. That is the right order for a reply and the wrong one for a booking text, which is why
  the usual sits above it.
- **The chip reads the say.** When the customer asked for email and the chip would pick a number, the
  chip's label carries the note from #115 (*Dana asked to hear from us by email*) so the two facts
  sit together.
- **Who on this job is a pick of threads.** The chosen person's thread gets the line, their usual
  number is the chip's, and the receipt names them. Nothing is written to two threads.

## Where it plugs in

- `src/lib/messages/compose.ts` — `replyRecipient` gains the usual and an explicit pick.
- `src/lib/flows/nudgeRunInputs.ts` — `textNumberOf` reads the usual first; the edge copy follows.
- `src/components/gc/messages/reply/SendWindow.tsx`, `TellCustomerSheet.tsx`, `OnMyWaySheet.tsx` — the
  chip; `tellCustomerIo` and `jobModeOnMyWayIo` pass the chosen channel to `quo-send`.
- `supabase/functions/quo-send` — the tech path takes an optional channel id instead of the record's
  phone.
- `src/lib/contacts/` — Who is this? asks *Make this their usual?*.
- `contact_jobs.is_default` — Who on this job's star; `MessagesButton.tsx` offers the people.
- `Estimates.tsx` — the override box joins the chip's menu as *another address*.

## The PR train

1. **The usual channel, the rule and the chip on the send window** (M). Migration:
   `contact_channels.usual_at`, the partial unique index, `contact_channel_make_usual(p_channel)`
   with its gray line. `replyRecipient` and `textNumberOf` read the usual first. The chip on the send
   window with Make this their usual. Who is this? asks. Bed in `messages_spine` or `messages_follow_up`.
   Guide: *pick the number a text goes to*.
2. **The sheets and the tech** (S). The chip on the Tell the customer sheet (both moments) and on On
   my way; `quo-send`'s tech path takes the channel; the moved visit's offer and the call task's dial
   read the usual. Guides amended.
3. **Who on this job** (M). The job's people on the sheets and the speech bubble, starred first; Make
   this the job's usual; the receipt names the person. Guide: *text the right person on a job*.
4. **The address side** (S). The estimate's override box becomes the chip's *another address* row; a
   usual address; the GC statement email reads it.

## How to verify

1. A customer with one number: no menu anywhere; the chip is a label.
2. Text from a second phone, answer Who is this?, tick Make this their usual: the thread's chip, the
   sheet's chip and Today's sends all name the new number; the thread shows the gray line.
3. Switch once on the sheet without ticking: that text goes to the other number; the next sheet is
   back on the usual.
4. A job with the customer and a person at the customer: the sheet offers both, the starred one
   first; pick the person; their thread gets the line and the receipt names them.
5. STOP on the usual: the rule drops it; the chip shows the next and marks the stopped one.
