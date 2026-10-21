---
name: "Tell the customer: the press always answers — a send that fails says so in the sheet, a sent estimate offers its link again, and what went out shows where the office looks"
number: 139
group: close
status: BUILT 2026-10-20 (renumbered from #133 in the numbering race), the owner's go on the recommended defaults the same day as the proposal — PR 1 v2.5681 (the sheet answers, PR 5916), PR 2 v2.5683 (What went on the estimate, PR 5921), PR 3 v2.5686 (Went out today on Messages, PR 5923), stacked; send-estimate-to-customer redeployed; the live walk (2026-10-20 night, Route B) found the receipt never showed, the page's refresh unmounting the sheet — PR 4 v2.5695 keeps the sheet mounted; left: the re-walk after it lands
summary: >
  When the Tell the customer sheet's send fails, today the sheet stays open unchanged — the only
  word is a toast that is gone in seconds, and on a live estimate the email can go, the badge flip
  to Sent, and the sheet still hear "failed", so the text never follows and a retry answers "Only
  draft estimates can be sent". This makes every press answer inside the sheet: a problem band
  with the reason and the next move, a Send the link again door when the estimate already went,
  honest words while it sends and when the email did not go, a What went card on the sent
  estimate, and a Went out today lane on Messages so a send the office pressed is visible after
  the receipt closes.
next: the live walk on a test customer (send, press the stale sheet again for the resend, pull the network for the timeout band, then /messages shows the sends); the step chip on Went out today waits until the send path stamps step_key.
size: L as a train of three (sheet + edge code M, estimate card M, Messages lane M)
blocker: the owner's go; decision 1 (resend from the sheet) shapes PR 1.
ver: proposed after v2.5593–v2.5597 (punch list #115)
opinion: build — the sheet made every send a person's press; a press the app answers with silence costs the trust the sheet was built to earn, and the office compensates by double-sending to real customers.
mockup: to-dos/press-always-answers/mockup.html
---

# The press always answers (#139)

## The ask, in the office's words

Taunya, 2026-10-20, sending a live estimate through the new sheet:

> I all ready hit send and nothing changed, the screen did not go away.

> on that last modal I sent but don't see any estimates or messages

Two reports, one hole: she pressed the green button, the app did something (or refused to), and
no surface she looked at afterwards — the sheet itself, the estimate, the Messages page — would
say what.

## What happened, in the code

The sheet (v2.5594, `TellCustomerSheet.tsx`) sends an estimate in two legs: the page's email send
(`sendEstimateEmail` in `Estimates.tsx`, the `send-estimate-to-customer` call) first, then the
text with the link the email answered. The email leg's contract is *null after a failure it
already said* — said as a toast. In `go()`:

```ts
const r = await estimate.sendEmail()
if (!r) return            // the sheet stays, unchanged, forever
```

Six legs land on that `return` or near it, and every one looks like "nothing happened":

1. **The refresh fails after the send succeeds.** `sendEstimateEmail` ends with `await load()`
   inside its own try. `load()` sets the row early (the badge flips to **Sent**) and keeps
   reading; one failed read later and the catch answers "Send failed" → `null` — the email went,
   the status shows Sent behind the sheet, the text never goes, the sheet stays on the tell view.
   This is the exact screen in Taunya's screenshot.
2. **A retry on a sent estimate.** The edge function's first-send branch refuses a non-draft with
   400 *"Only draft estimates can be sent"* — words no office person can act on, in a toast,
   while the sheet sits unchanged. (The resend path exists — `mode: 'resend'`, v2.2856 — but the
   sheet never offers it.)
3. **The fetch fails or hangs.** No timeout on the call; while `busy` the sheet's X is refused
   silently (`onRequestClose={() => !busy && onClose()}`), so a hung send is a modal that cannot
   be closed and says nothing.
4. **Not signed in / session expired** → toast, `null`, silent stay.
5. **The edge answers a real refusal** (no email on record, invalid email) → same.
6. **The email did not go but the link came back** (`emailed: false`, Resend down): the receipt
   ignores `r.emailed` and says *Emailed to …* anyway — the one leg that answers, answers wrong.

And after any of it: the receipt is the only proof a send ever shows, and it closes. The
estimate's **Customer activity** is link views and acceptances — what *they* did, not what *we*
sent. `/messages` is three queues (New, Needs a reply, We owe them), all driven by inbound; a
text the office just pressed appears in none of them, and with every queue empty there is no row
to open and no search. Taunya looked exactly where anyone would and found exactly nothing.

## Three lenses

- **Taunya's seat.** She pressed the one green button the sheet offers. A press must answer where
  she is looking — in the sheet, in words that name her next move — not in a toast that died
  while she read the estimate behind it. And when the app refuses, "Only draft estimates can be
  sent" is the database talking; "This estimate already went to Dana on Oct 20" is a person.
- **The job behind the ask.** The estimate has to reach the customer. What she actually needs is:
  did it reach Dana, by which doors, when — and if not, one safe way to send it again that will
  not double-text a real customer. Today the safe way exists (Resend link) on a different part of
  the page, disconnected from the sheet that refused her.
- **The whole office.** #115's principle is *nothing goes without a person pressing it, or seeing
  it the moment after*. This is the principle's second half, unbuilt: pressing is visible, but
  **having pressed** is not. An office that cannot see what went out re-sends (customers get the
  estimate twice) or stops trusting the sheet (and asks for the automation back). Every future
  send surface — Today's sends, the board's moves — earns from one visible "went out" lane.

## The proposal — three pieces

### 1. The sheet answers every press (PR 1)

- `sendEstimateEmail` stops answering bare `null`: it returns
  `{ ok: true, acceptUrl, emailed } | { ok: false, why, code }`, and when called from the sheet
  it stops toasting — the sheet owns the words. The refresh (`load()`) moves out of the send's
  try: a failed refresh is never read as a failed send.
- On `ok: false` the sheet shows a **problem band** (role=alert, stays until acted on): the
  reason in plain words and the move. The primary becomes **Try again**; Skip stays; the X works.
- The edge's non-draft refusal gains `code: 'already_sent'` (its resend-window refusals carry
  codes already). The sheet reads it: *"This estimate already went to Dana."* — and the primary
  flips to **Send the link again**: the page's own resend (`mode: 'resend'`, fresh link, the old
  link dies — a What happens row says so), then the text with the fresh link. One sheet, both
  moments, no second control to find.
- **Busy honesty**: ~20 s AbortController timeout → a band: *"Still sending — it may have gone.
  Open Dana's thread before pressing again."* with Close alive. Before the timeout, pressing X
  answers *"Still sending…"* instead of doing nothing.
- **Receipt honesty**: `emailed: false` → the receipt's email line says the email did not go
  (the link was made and copied) instead of claiming it was emailed.
- The booking moment's identical bare legs (a failed `io.send` already toasts, but the sheet
  stays with no band) take the same band words — same kernel, one PR (decision 4).

### 2. What went, on the estimate (PR 2)

A sent estimate shows a **What went** card above Customer activity: *Emailed to
dana@… · Mon Oct 20, 1:31 PM* (from `sent_at` + the stored email), *Texted the link to
(830) 555-0121 · 1:31 PM* with **Open the thread**, or *No text went — they have no mobile
number on file*. The sheet's receipt facts, kept where the estimate lives. Resend link moves
into (or beside) this card so "send it again" lives where "what went" is read.

### 3. Went out today, on Messages (PR 3)

`/messages` gains a fourth section under We owe them, office only: **Went out today (N)** — the
texts a person pressed today (the sheet, the reply box, Today's sends) and the morning run's
sends, newest first: the person, the first line of the words, the time, the step chip; a row
opens the thread. Empty state: *Nothing has gone out today.* Reads from `messages` (outbound,
today, this office) — no new table; estimate emails fold in later if wanted (decision 2).

## The second pass: is this the best we can do?

- First draft had the problem band generic ("The send failed — try again"). That repeats the
  toast's sin with better persistence. The band must carry **the reason and the move**, per code,
  or it teaches nothing — so the contract change (piece 1's first bullet) is load-bearing, not
  cosmetic.
- Considered auto-closing the sheet on failure and toasting longer. No: the sheet holds her
  typed words; closing throws them away and a longer toast still vanishes. The band keeps the
  words and the context.
- Considered a `sent_log` table for piece 3. Not needed: outbound texts are already rows in
  `messages`; the lane is a read. The one gap is estimate *emails* (they live on the estimate row
  and in `email_send_log`), which is why decision 2 offers texts-first.
- Considered retry-with-idempotency on timeout instead of "check the thread first". The edge
  send is not idempotent (a retry can double-email); honest words now, idempotency key later if
  timeouts prove common.

## Not taken

- **Auto-retrying failed sends in the background** — against #115's principle; a person presses.
- **A global "sent" badge/notification center** — one lane on Messages where she already looked
  beats a new surface.
- **Blocking the sheet from opening on a sent estimate** — the sheet opening is right; it is the
  refusal that must speak and offer the resend.

## Decisions for the owner

1. **Resend from inside the sheet?** Recommended: **yes** — on `already_sent` the primary
   becomes Send the link again (old link dies, said in What happens). The lighter cut: the band
   names the estimate page's existing Resend link instead (less code, second control to find).
2. **Went out today scope.** Recommended: **texts only, today only** for the first cut; estimate
   emails and a 7-day lookback are follow-ons if the office asks.
3. **Busy timeout.** Recommended: **20 s**, then the "may have gone — check the thread" band
   with Close alive. Alternative: no timeout, but X always alive with a "still sending" warning.
4. **Booking moment in PR 1?** Recommended: **yes** — the same band on the booking's failed
   text; same kernel words, small addition, one behavior everywhere.

## Where it plugs in

- `src/components/customers/TellCustomerSheet.tsx` — the band, the resend primary, busy/timeout,
  receipt honesty; words in `src/lib/tellCustomer/tellCustomer.ts` (`TELL_WORDS`), tested plain.
- `src/pages/Estimates.tsx` — `sendEstimateEmail`'s widened answer, `load()` out of the send's
  try, the What went card (near Customer activity, ~line 200), Resend link's new home.
- `supabase/functions/send-estimate-to-customer/index.ts` — `code: 'already_sent'` on the
  non-draft refusal (deploy after merge; `check:edge-drift` names it).
- `src/pages/Messages.tsx` + `src/components/followUp/` — the Went out today section; the read in
  `src/lib/followUp/` or a small `lib/messages/wentOut.ts` kernel with its own tests.
- Help guides touched: *send an estimate and turn it into a job* (the band and Send the link
  again), *work Today's sends* (the lane shows the morning's sends).

## Where it stands — as built, 2026-10-20

The owner said *Build it* on the recommended defaults the day the proposal went up, so all four
decisions landed as recommended: the resend lives in the sheet (the primary flips on
`already_sent`), Went out today is texts only and today only, the timeout is 20 s with Close
alive, and the booking moment's failed text takes the same band in PR 1. Built as the three-PR
train — v2.5681 (#5916), v2.5683 (#5921), v2.5686 (#5923), stacked on the proposal's #5913 —
and `send-estimate-to-customer` redeployed with the `already_sent` / `not_draft` codes. One cut
from the mock-up: no step chip on Went out today's rows, since the send path stamps no
`step_key` on the message; the chip waits until it does. Left: the owner's live walk on a test
customer.

## The walk, 2026-10-20 night — what it found

Route B (the owner presses the send in the app's browser pane, the agent reads around it) on a test
customer with the owner's own email and no phone. The sheet opened right, the email went, and PR 2's
What went card drew correctly on the sent estimate. But the sheet **stayed on the Tell view after the
send, with no band and no receipt** — Taunya's exact screen. A read-only observer timestamping the
sheet's title showed why: the sheet unmounted and remounted twice during the send (the pre-send
save's reload, then the post-send refresh), because `load()` flips `loading` and the detail render
returns a bare *Loading…* tree while it is true. The receipt was set on a dead instance; a fresh
sheet drew the Tell view. The receipt had never shown for anyone since v2.5594, and the train's PR 1
could not see it: the sheet's smoke fakes the send and never touches the page. **PR 4 v2.5695**
gives `load()` a refresh mode that keeps the page up, uses it on the send path, and renders the
sheet above the loading early-return, keyed, so no refresh can unmount it.

## How to verify

- Unit: the kernel's answers per code (`already_sent`, refusal, timeout) and the plain-words
  test over the new `TELL_WORDS`; the receipt with `emailed: false`.
- Render smokes: the sheet with a failing `io`/`sendEmail` shows the band and keeps the words;
  the resend primary on `already_sent`; Messages with one outbound row shows the lane.
- Live, on the owner's own number: send a draft estimate (receipt), press the stale sheet again
  (band + Send the link again, one new email, one text, old link dead), pull the network mid-send
  (timeout band, Close works), then `/messages` shows both sends under Went out today.
