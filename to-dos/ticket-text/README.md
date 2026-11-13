---
name: "A text when a charge lands on your card, with a place to photograph the receipt"
number: 299
group: gated
status: asked 2026-11-09 by Diane while looking at #295 · her five calls taken the same hour · the feed, the card links and two weeks of charges read in prod · drawn as seven frames · Grace said build on 2026-11-12, the five calls at the mock-up's foot taken at the card's own defaults · PR 1 (the request and the link, v2.7101) built 2026-11-12: the page at /r/<code>, the function receipt-link, Copy the receipt link on the Team queue · no text goes yet · PRs 2 and 3 not built
mockup: to-dos/ticket-text/mockup.html
summary: >
  The second door on the supply house ticket (#295). When a card charge posts to a card assigned
  to a person, the company number texts that person a link, no sign-in, where they photograph the
  receipt. The text carries its charge, so the photo lands on that charge with no guess by amount
  or day. It writes the same ticket record as the Tally press and the office reads both the same
  way. A holder with no cell on file, a card tied to no one, or a holder who replied STOP becomes
  a Needs you item for the office instead of a text.
next: PR 1's merge, its push (20261113061500) and the deploy of receipt-link; a walk on a ZZ Test person's charge with a real phone; the rule for /r/ on the short host's Worker; then PR 2, the text, behind its switch. Diane's look at the mock-up and her word on the five calls can still change PR 2.
size: M as a train of three (M · M · S), after #295's PR 3 has shipped
blocker: None for PR 1; #295's four PRs are on main and on prod (checked 2026-11-12). PR 2 texts teammates from the company number, so it merges switched off and the owner switches it on.
opinion: build, after #295's third PR — the text turns the charge's own arrival into the ask, and the office stops chasing paper by hand
---

# A text when a charge lands on your card (#299)

## The ask

Diane, 2026-11-09, in the parent session while reading #295:

> whenever a user gets a charge on a card assigned to them, what if we sent them a text with a
> place to take a photo of their recipt and upload it. Would this make sense?

Her calls, the same hour, verbatim: *I like the idea · Every charge that is not pending but lands
· no sign in link · no quiet hours · for people with no cell on file make it a Needs you item for
Office Staff · we can add the push to mercury to a punchlist card for much much later not to do
now · help me come up with a plan and mockup to build this.* The Mercury push is parked as
[#300](../mercury-receipt-push.md).

So, settled: every card charge once it posts, fuel and lunch included, on a card assigned to a
person; the link needs no sign-in; the text goes when the charge posts, at any hour; a holder
with no cell on file gets the office a Needs you item instead.

## What the feed and the cards say (read 2026-11-09 as the dev seat)

- **When a charge posts, and when the app hears.** The feed holds each charge from the swipe
  (`created_at`) and marks it posted later (`posted_at`). Punch list #72 measured the gap at a
  median of eight hours, two charges in five posting on a later company day; in a two-week sample
  read today a share post within seconds of the swipe and most of the rest overnight, between 1
  and 4 AM Central. The app hears each change at once: Mercury's webhook fires on updates as
  well as new rows and the function re-reads the charge and upserts it (`mercury-webhook`,
  `_shared/mercuryTransaction.ts`), so `posted_at` lands within a minute of Mercury writing it;
  the Banking page's Sync is a manual catch-up with no cron. So on her call, *posts, not pending*,
  the text is **usually a reminder that evening or the next morning, not a prompt at the
  counter**. The counter is #295's press. A text on the pending row would reach the counter in
  minutes but would also text every charge that fails or reverses; the plan keeps her call and
  says so in the words (*posted to your card today*).
- **Volume.** 163 posted card charges in the fourteen days to 2026-11-09, about **80 a week**,
  on about fifteen cards. Two cards used from the office are near half of them (call 5).
- **How a card maps to a person.** `mercury_debit_card_user_links`, one row a card, nineteen
  rows, fifteen people; one person holds four cards. A trigger stamps each new charge with the
  card's `auto_assign_user_id` in `mercury_transaction_attributions`, so the holder of a charge is
  its attribution, else the card's link. **Five of the nineteen links are to archived
  people** (one archived the day before), and one of those has no cell. In the two weeks, about
  a dozen charges landed on cards tied to no one. Both are the office's Needs you item, not a text.
- **Cells, and who the app can text.** `users.phone`, free text in several shapes, mirrored to
  the roster's `people.phone`; the server's `toE164` takes ten digits and refuses the rest, so a
  number that will not normalise is *no cell on file*. **Every text the app sends today goes to a
  `contact_channels` phone on a `contacts` row** (a customer, a prospect, a trade, a sub), never
  to `users.phone`: `quo-send`, the nudges, Job Mode's text to the customer. Teammates are reached
  by web push and email. The STOP words, the opt-out line, the two boxes and the Messages thread
  all hang off the contact's channel. So the text door's one structural step is to give a card
  holder a contact of their own, a `contacts` row tied to their `users` row with a phone channel
  from `users.phone`, and text that; then STOP, the first-text line and the thread apply unchanged.
- **Paper today.** `raw.attachments` is non-empty on two charges in ninety days, put on in
  Mercury's own app; every charge reads `compliantWithReceiptPolicy: false`.

## The design

**One record, two doors.** A photo taken through the link is a `counter_tickets` row (#295) with
its pages, `source = link`, already matched to its charge (`match_kind = link`, since the link
carried the charge: no minute, no total, no question), the job as the page's chips set it or
null. The office's Team queue, the ticket window and the Tickets list (#295 PR 3) draw it as any
ticket, with a chip that says which door it came by. A counter ticket on a supply house account
makes no card charge and never texts.

**The request.** A row a charge in `receipt_requests`: the charge, the holder, the cell texted,
the code's hash, when it was texted, reminded, opened and answered, the ticket it became, when the
link closes, and the reason when no text could go (`no_cell`, `no_person`, `archived`,
`opted_out`). One row a charge, so a charge is asked once whatever the sync does.

**The sweep.** The webhook's upsert already runs two best-effort steps after a charge lands (the
label suggestion, the returned-check notice); the request is a third, and a cron every fifteen
minutes sweeps what the webhook missed: every posted, unfailed card charge with no request row
and no live ticket on it gets one. With a cell: the text goes; without: the
row carries its reason and the office's Needs you item reads it. Two charges that post inside
one hour on one card share one text, and the link opens on both (call 3). The next evening at
six, a charge still without a receipt gets one reminder (call 2). After that it is the office's.

**The text.** From the company number, through `sendText` as #291's bill text goes, to the
holder's own contact (above), purpose `nudge`, so it lands on Messages as an outbound text and a
reply lands on the thread. A teammate's first
text from the company number names the company and carries the carriers' opt-out line once; a
later text is the one line. *Hi Jordan, this is Click Plumbing. $228.58 at Ridgeway Supply posted
to your card today. Snap the receipt here: my.clickplumbing.com/r/7KQ4M2.* No quiet hours, her
call; a STOP is honoured by the carrier and by us, and the next charge on that card is the
office's item.

**The link.** `/r/<code>` on the short host, a ten-character code from the estimate link's
alphabet with only its SHA-256 kept (`share_estimate_link`, #290's rule), served by a public
route and a function with no JWT as `/b/:code` and `box-read` are. It answers one
charge: merchant, amount, day, whose card (last four), the job when Tally knows it; the camera
press; a photo or PDF already on the phone; the day's jobs as skippable chips (call 4); after the
upload the thumbnail, Retake, + Add a page. It opens for fourteen days, shows the ticket when the
charge got one from Tally in the meantime, and after that reads *This link has closed* with the
door to Tally. Twenty wrong codes in an hour hold the phone off for the hour. It can read nothing
else: not the job's folder, not another charge, not the person.

**The upload on a weak signal.** The page shrinks the shot as the app does (`shrink.ts`, the large
size) and holds it with Retry until it sends (`OfflineRetryPanel`'s own pattern). No sign-in means
no outbox: leaving the page before it sends loses the shot, and the page says so. The page posts the shrunk
bytes as base64 to the function, as the sub portal posts a signature (`submit-sub-portal`); the
function writes them to the `counter-tickets` bucket under the holder's id as the service role,
with the ticket and page rows; the photo sweep files them under Team only › Tickets as any ticket.

**The office.** The charge's line in the Team queue reads *TEXTED 6:14 PM · no receipt yet*, then
*RECEIPT · FROM THE TEXT* with the ticket's job first; *+ Ticket* on the line stays for paper
handed in. Needs you items (frame T7): no cell on file, a card tied to no one, a holder who
replied STOP, and a charge texted twice with no receipt. Each names its press: Add the cell, Tie
the card, + Ticket, Text again, Got it.

**A push too?** The app pushes to every device of a person already (`push_subscriptions`,
`_shared/webPushSend.ts`, the Messages notices), so a push beside the text is one call. Offered
only as an addition (call 4 of the foot), never instead of the text she chose.

## The mock-up

[`mockup.html`](./mockup.html), seven frames, every name and number made up.

- **T1** the text as Jordan sees it, first text and later; two charges in one hour; the reminder;
  a STOP.
- **T2** the link's page on a first visit, with and without the job Tally knows.
- **T3 · T4 · T5** after the upload; the charge that already has its ticket; expired.
- **T6** the charge's line in the Team queue in its four states.
- **T7** the office's Needs you items.

## The cases

| The case | What happens | Where |
|---|---|---|
| A charge on a card tied to no one | No text; the office's item *Tie the card* | T6, T7 |
| A charge on an archived person's card | No text (five such links exist today); the office's item names the person and *Tie the card* | T7 |
| The holder has no cell, or a cell that will not normalise | No text; the office's item *Add the cell* | T7 |
| The holder replied STOP | No text; the office's item says so; START puts them back | T1, T7 |
| The charge already has a ticket from the Tally press | No text, no request row | rule |
| The ticket arrives after the text went | The link shows the ticket and offers + Add a page | T4 |
| A refund, money back | No text: nothing to photograph | rule |
| A charge that posts then reverses | Its request closes; the link reads *closed*; no reminder | rule |
| Two charges in one hour at one or two merchants | One text, the link opens on both, each gets its own photo | T1 (call 3) |
| Two charges in one minute at one merchant | The same, and the page names each by amount | T1 |
| A tip-adjusted amount that differs from the pending one | The text goes on the posted amount, which is what the receipt shows | rule |
| A failed charge | Never texts: the sweep reads posted, unfailed rows | rule |
| No receipt after the text | One reminder the next evening (call 2), then the office's item | T1, T7 |
| The link is forwarded or guessed | It shows one charge's facts and takes a photo, nothing else; twenty wrong codes an hour hold the phone off | T5 |
| The page is opened after fourteen days | *This link has closed* and the door to Tally | T5 |
| A weak signal on the page | The shot waits on the page with Retry; leaving loses it, and the page says so | T2's note |
| A PDF the store sent | The small link under the camera takes it | T2 |
| A long receipt | + Add a page after the upload | T3 |
| The holder picks a job on the page | The ticket carries it; the office's sort offers it first | T3 |
| The office sorted the charge before the photo came | The page asks no job; the photo goes on the charge | T2 |
| The holder is office staff | Texted as anyone (call 5) | rule |
| The holder has the app installed | A text all the same; a push is an addition (call 4) | rule |
| Cost | About 80 texts a week at today's volume, plus reminders. No doc holds Quo's price a segment; `sendText` answers the segment count, so the first week's bill says it exactly | rule |

## Where it plugs in

- **Exists**: `counter_tickets` + `counter_ticket_pages` and the bucket (#295 PR 1); the photo
  sweep's ninth source; `ticketStateWords` and the office's Tickets list (#295 PR 3);
  `mercury-webhook`'s after-upsert steps; `sendText` with its switch, the first-text line and
  STOP (`_shared/quoLines.ts`, `gcKernels/lib/messages/textOut.ts`, `quo/send.ts`); the short
  host, `share_estimate_link`'s code and `estimate_link_miss`'s guard; `submit-sub-portal`'s
  base64 upload shape; `shrink.ts`; `OfflineRetryPanel`; the Needs you deck's kinds (`fillIn.ts`,
  the move-request kind as the table-driven precedent); `mercury_debit_card_user_links` and
  `mercury_transaction_attributions`; `users.phone` and `toE164`; `webPushSend.ts`.
- **New**: `receipt_requests` (one row a charge, the four fences, a migration); `source = link`
  and `match_kind = link` on `counter_tickets`; a teammate's own `contacts` row with a phone
  channel (a `user_id` on `contacts`, or a kind, the migration's one design call); the sweep
  `receipt-request` from the webhook and a cron; the function `receipt-link` (`verify_jwt =
  false`: GET the charge's facts by code, POST a page as base64); the public route `/r/:code` and
  its page; the Needs you kinds; the Team line's chips; a guide, *answer the text about a charge
  on your card*; the words in `src/lib/tickets/receiptText.ts`.

## The plan

1. **PR 1, the request and the link** (M): the table, the code and its hash, the function
   `receipt-link` and the public page in its five states (T2 to T5), the ticket written with
   `source = link` and `match_kind = link`, the fences and a bed. No text goes yet; the office can
   hand a link out by hand from the charge's line (*Copy the receipt link*), which proves the page
   on real charges before any text.
2. **PR 2, the text** (M): a card holder's own contact and phone channel, the sweep from the
   webhook and the cron, the words, the first-text rule and STOP as they stand, the
   one-text-an-hour fold, the reminder, the request's reasons; the Team line's chips; the four
   Needs you items. Switched on by one `app_settings` key, off at merge, on by the owner's press.
3. **PR 3, the rest** (S): the guide, the charge row in Banking and Job Summary's costs, the
   push beside the text if she wants it.

## Where it stands (2026-11-12)

PR 1 is built as `docs/recent-features/v2.7101.md` says. Two things differ from the design above, each for a reason the fragment gives: a link is its own row (`receipt_links`, one row a code) instead of a hash on the request, and the link rides the app's own address until the short host's Worker forwards `/r/`. The page says whose card by first name, since the app keeps no last four. Built at the card's defaults: call 2 (the day's jobs, skippable). Waiting for PR 2: calls 1, 3 and 5. Not built: call 4, the push.

## How to verify

PR 1 on a ZZ Test person's charge: copy the link from the line, open it signed out, upload, read
the ticket on the charge in the Team queue and the file under Team only › Tickets. PR 2 with the
switch on for one card (the dev's): one charge, one text, one reminder, one STOP, each read on
Messages and on the Needs you list.
