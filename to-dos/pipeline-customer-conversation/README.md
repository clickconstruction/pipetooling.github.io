---
name: "The customer's conversation on the Pipeline row and in its Job activity"
number: 125
group: gated
status: DRAFTED 2026-10-19 — a review of the Pipeline's Job activity found the customer's conversation split across three places; three options for the row's box, the Customer filter, Reply and Tie in place, and the six phone-app doors drawn at desktop and phone width beside this file for the owner's pick; nothing built
summary: >
  The customer's side of a Pipeline job reads in three places and none holds it all. The row's
  activity box shows the team's notes, reports and bill sends but no call, text or email. The
  expanded Job activity shows the calls, texts and emails, but its Customer pill counts only those,
  so a bill sent and a contract signed sit under Billing. The speech bubble's sheet shows the last
  three lines and no notes. Job activity cannot answer a line it shows, nor tie a line that is not
  tied yet. And six doors still hand a send to someone's own phone or mail app, so nothing is
  recorded and the answer goes to that person's phone. Texting through Quo has been live since
  2026-10-16, so every send can go from the company number now.
next: The owner picks the box's option (a, b or c) and answers the Customer filter's question; PR 1 is the board-wide read.
size: S (the read) + S (the box) + XS (the filter) + S (Reply and Tie) + 3 × S (the doors)
blocker: The owner's pick.
opinion: build (a), Customer as everything to or from them, Reply and Tie in place, and the doors through the company number; the box is where the office reads what happened last, and v2.5633 already put the bill's send there
mockup: to-dos/pipeline-customer-conversation/mockup.html
---

# The customer's conversation on the Pipeline row and in its Job activity (#125)

## What the review found (2026-10-19)

The customer's side of a job reads in three places, and none of them holds it all.

| Where | What it shows | What it leaves out | Where it comes from |
|---|---|---|---|
| **The row's activity box** (1100 px and wider) | The team's notes and reports, numbered oldest first; since v2.5633 a bill sent, unnumbered (*Sent*) | Every call, text and email | `JobsStagesActivityBox.tsx` over `buildJobActivityBoxFeed` in `src/lib/jobs/jobActivityBoxFeed.ts`: `entryFromItem` keeps notes, reports and `SENT_EVENT_TYPES` and drops the rest |
| **Job activity, expanded** (See all, the row panel, full screen) | Notes, reports, events and, since Messages cut 10, the job's calls, texts and emails in orange, with a **Customer** pill | Nothing, but the Customer pill counts only the Messages lines | `JobActivityView.tsx`; `buildJobActivityLines` and `jobActivityLineMatches` in `src/lib/jobs/jobActivityLine.ts`; `useJobMessages` → `loadJobMessages` in `src/lib/messages/messagesIo.ts` |
| **The speech bubble's sheet** | The thread's last three lines and *Waiting on us*; the dot on the bubble while someone waits (v2.5632) | The team's notes, the bill and contract sends | `lastLinesOnJob` in `src/lib/messages/customerDoor.ts`; the dot is `boardDotsByJob` over `loadBoardDotRows` in `src/lib/messages/boardDotsIo.ts` |

The phone card has no box. Its foot carries one teaser line, the newest note or report
(`cardActivityTeaser` in `JobsStagesCardList.tsx`), read from the same board-wide stats as the
box's teaser (`jobs_ledger_thread_note_stats` in `useJobThreadNotes.ts`). It leaves out the same
lines.

Two more gaps sit inside Job activity:

- **It cannot answer.** The composer writes team notes only (`JobActivityView.tsx`, the *Add a
  note to …* pill over `submitNoteWithBody`). Seeing Dana's text there and answering it means
  closing the activity and opening the bubble, or leaving for Messages.
- **It cannot tie.** A line from the customer that is tied to no job yet shows with *not tied yet*
  (`notTiedYet`, drawn by `JobActivityFeed.tsx`), and the only press that ties it is in the
  thread (`ThreadWindow.tsx`'s tie sheet → `tieMessage` → `tie_message`).

And six doors hand the send to the person's own phone or mail app. Nothing lands in the
customer's thread or in Job activity, and the customer's answer goes to that person's phone or
inbox instead of the company number or the office's box (§ 4).

## What exists to build on

- **The board's reads.** Each load of the board reads the box's teaser once per slice of jobs
  (`jobs_ledger_thread_note_stats(p_job_ids)`), and the dot once for the whole board
  (`loadBoardDotRows`: the customers waiting or snoozed and their lines in). The box's fuller load
  (`loadActivityForJob`, on the first pointer over the box) is the thread's own read of notes,
  reports and events, and it never reads Messages.
- **Job activity's rule for which lines are the job's** (`jobActivityMessagesFromRows`,
  `jobTakesUntiedLines`): every line tied to the job, and while the job is unpaid the lines tied
  to no job of the customers on it (`contact_jobs`) since the job began.
- **The sheet's rule for which lines are the conversation** (`lastLinesOnJob`): calls, texts,
  emails and portal lines; notes, events and team lines stay out.
- **The box's unnumbered line** (v2.5633): a bill sent takes no number, so *check note 3* never
  moves. A small tag in the number's place holds it.
- **The customer's box** (`JobCustomerBox` over `ReplyBox`): a text or an email tied to the job,
  the stage's quick replies first (v2.5629), `{bill}` filled with the pay page (v2.5628), the
  send window's confirm, and every hold (no mobile, STOP, texts off, paused, a prospect not asked).
- **The sends.** `quo-send` texts from the box's number, which is the company number until a box
  has its own, and writes the line tied to the job. `messages-email` emails under our letterhead,
  with its Reply-To the office's box (R6), writes the line and files the sent copy.

## 1 · The row's box: three options

All three read once per board load and never once per row. The box's own pointer load stays
as it is. Messages has no realtime, so a line that lands while the board is open shows on the
board's next load, or after a send from the sheet, as the dot does today.

### (a) Their lines in the box

The newest three calls, texts and emails between us and the job's customer join the box at their
times, unnumbered like v2.5633's *Sent*. A small orange tag holds the number's place and says the
channel: *Text*, *Email*, *Call*, *Missed*, *Voicemail*. A line from them carries the orange bar
and their name; a line from us carries the sender's name, or *the app* for one it sent itself.
Notes keep their numbers. Three is the sheet's number, so the box and the sheet show the same
lines; older ones are See all's.

- **Phone:** the card's teaser is the newest of the note, the report and the line. When the
  customer's line is newest it reads in orange: *Dana · text · 2h — Can you do Thursday?*
- **The read:** a new read-only function, `pipeline_customer_lines(p_job_ids uuid[], p_per_job
  int)`, called in the same slices and at the same moment as the stats. It returns the newest
  `p_per_job` lines per job (`row_number() over (partition by the job order by at desc)`) under
  Job activity's rule and the sheet's, so the box, the sheet and Job activity agree. It is
  `SECURITY INVOKER`, so the rows' policies decide who reads what, as in Job activity.
- **Cost:** one migration (a function, no table, so no fences; `SET lock_timeout` as always), one
  more round trip per slice beside the stats', at most three rows per job. A SQL bed proves the
  function and `loadJobMessages` pick the same lines from one fixture.
  Without a migration it can be the `boardDotsIo` shape: slices of jobs, `messages` newest first
  under the 1,000-row cap, then `contact_jobs` and the untied lines. That is three reads per slice
  and up to a thousand rows to keep three per job: workable, but wasteful.
- **On screen:** the box keeps its 96 px. On a day of texting, the four lines in view are the
  conversation and the team's notes scroll up. The cap of three keeps a chatty thread from
  burying them.

### (b) One newest-line strip under the box

The box stays the team's trail. One line under it, in the customer's orange, carries the newest
call, text or email either way: *Dana · text · 2h — Can you do Thursday?*, with the dot's
*Nobody has answered.* when it waits on us. A press on it opens the bubble's sheet. No line when
the job has none.

- **Phone:** a second line at the card's foot, under the team's teaser.
- **The read:** the same function with `p_per_job = 1`: one row per job. The same migration.
- **On screen:** each row with a line grows by about 18 px, or the line shares the See all · + Add
  strip and squeezes See all. The conversation is still in two places on the row: the team's in
  the box, the customer's under it.

### (c) The box stays the team's; the bubble carries the customer

The box is unchanged. The dot stays (v2.5632), and the row's customer line gains the dot's words
under the name while someone waits: *Dana · text · 9:05 AM · Can you do Thursday?* Nothing shows
when nobody waits.

- **Phone:** the same line under the card's customer name.
- **The read:** none new. The dot's read already holds the waiting line (`BoardDotHover`: who,
  channel, when, line); the words are the hover drawn on the row. No rows more, no migration.
- **What it leaves:** a job whose last line was ours (Tanya answered, a reminder went) shows
  nothing of the customer on the row. The conversation stays split, which is what the review
  found.

### The three side by side

| | (a) In the box | (b) A strip under it | (c) The bubble |
|---|---|---|---|
| Lines on the row | the newest 3, with the notes | the newest 1, under the box | the waiting one, under the name |
| Our side too | yes | yes | no |
| New read | `pipeline_customer_lines`, 3 per job | the same, 1 per job | none |
| Migration | one function | one function | none |
| Round trips per board load | +1 per slice of jobs | +1 per slice of jobs | +0 |
| Row height | unchanged | about +18 px where a line shows | about +16 px where someone waits |
| The box and the sheet agree | yes, the same three | on the newest | no |

## 2 · The Customer filter

Today `jobActivityLineMatches` gives **Customer** only a message whose tone is the customer's
(`isCustomerSide`: `customerIn`, `customerOut`). Every event the customer got, or did, sits under
**Billing** (`JOB_ACTIVITY_EVENT_RENDER` in `src/lib/jobActivityEvent.ts`):

| Event | The customer… | Bucket today |
|---|---|---|
| `invoice_sent`, `invoice_stripe_email_sent` | got the bill | Billing |
| `contract_sent`, `contract_shared` | got the contract or its link | Billing |
| `contract_viewed`, `contract_signed` | opened it, signed it | Billing |
| `lien_release_signature_requested`, `lien_release_sent` | was asked to sign a release, got one | Billing |
| `payment_promise` (*They said*) | told us when they would pay | Billing |
| `payment_added` | paid (by card on their pay page, or a check we entered) | Billing |

So *Customer · 4* on a job whose customer got a bill, signed the contract and got a release reads
as four texts and none of the rest.

**The proposal:** Customer means everything the customer got or sent: their calls, texts and
emails, and the events above except the payment. Those events stay under Billing too, so Customer
is a lens across the buckets, not a bucket of its own. One set in `jobActivityEvent.ts`,
`CUSTOMER_EVENT_TYPES`, is read by the filter and by the box's unnumbered rule (it replaces
`SENT_EVENT_TYPES`), so the box, the filter and the sheet agree on what reached the customer.
`countJobActivityLines` counts Customer in its own pass, since the other buckets stay disjoint
(it breaks at the first match today).

Left out on purpose: `invoice_created` and `invoice_billed` (ours until it is sent),
`contract_voided` and `lien_release_voided` (ours unless the void was sent), and
`lien_release_issued` and `lien_release_signed` (our side of the release).

## 3 · Reply and Tie in place

- **Reply.** On a line from the customer in Job activity (tone `customerIn`, the office only,
  `canOpenMessages`), a **Reply** press sits at the line's right on desktop and in the
  opened line on a phone. It opens `JobCustomerBox` in the composer's place, tied to this job,
  with a head: *Replying to Dana's text · 9:05 AM* and ✕ back to the note pill. An email is
  answered by Email with *Re:* and its subject; a text, a call, a missed call or a voicemail by
  Text. The stage's quick replies come first, as in the sheet. A send reads the feed again
  (`onSent` → `useJobMessages`'s `rev`), and the new line lands at the bottom in orange.
- **Tie to this job.** On a *not tied yet* line, one press: `tieMessage(messageId,
  jobBoxJobKey(jobId))`. `tie_message` also puts the job on the person's rail. The line loses
  *not tied yet* and a toast offers **Undo** (`tieMessage(id, null)`). **Another job…** opens
  `JobPickerWindow`, as the thread does. The office only.
- **The note pill stays a note.** Post writes a team note the customer never sees, and its words
  stay *Add a note to …*. Reply is on the customer's line, so the two presses never mix.

## 4 · The phone-app doors

| Door | Where | Today | Through the company |
|---|---|---|---|
| Contract window · **Text link** | `JobContractModal.tsx` ~565 (`textLink`) | `sms:` on the person's phone: *Here is your service agreement for … review and sign here: ‹link›* | The customer's box on Text, filled with the same words and the link; Send text… |
| Contract window · **Send link**, with *text too* or no email | `JobContractModal.tsx` ~872 (`openSms` in `sendLink`) | After `send-contract` emails the link, or in its place, `sms:` | `quo-send` in the same press, so one press sends both; the window's sentence already names the number |
| Signed rail · **Text link** | `JobContractSignedRail.tsx` ~143 (`textLink`) | `sms:`: *Here is your signed agreement for …: ‹link›* | The customer's box on Text, filled |
| Bill share · **Open in mail app** | `StripeInvoiceSharePanel.tsx` ~110 (`openMailtoWithDraft`, from `EmailBillDraftModal`) | `mailto:` with the draft's subject and body | `messages-email` with the draft's subject and body, tied to the job, its Reply-To the office's box; the sent copy filed |
| Bill share · **Text draft → Copy** (beside it) | `SmsBillDraftModal`, from the same panel | Copies the words to paste into the phone's texts | The customer's box on Text with the bill's line and `{bill}` filled (v2.5628) |
| Job window · the customer's **email chip** | `DetailJobModal.tsx` ~337 (`openMailto`) | `mailto:` with the address alone | The bubble's sheet, opened on Email; a small copy press beside the address |
| Job Mode · the customer's **email** | `JobModeDetailsSection.tsx` ~232 | `mailto:` on the tech's phone | `messages-email` is the office's only. The address becomes text to copy, and the press opens Job Mode's **Message the customer** (`quo-send`'s `job_mode` path, a text from the company number) |

Every door that opens the box keeps the box's confirm and its holds. When the company number
cannot text (texts off, the carriers' approval pending, the balance paused, STOP), the press says
why in the box's words and offers **Copy link**. It never falls back to the phone's own app.

The contract window's number is typed in the window (`recipientPhone`), and `quo-send` texts only
a number on the customer's contact (`contact_channels`). When the typed number is not one of
them, the box says so and offers the numbers on file. Nothing in the app adds a number to a
contact from a send today, so adding the typed one is the owner's call (question 5).

`tel:` doors (the job window's ☎, Job Mode's phone line) dial from the person's own phone too. A
call made in Quo's own app is logged by the webhook; the rest are not. They are not drawn here.

## The recommendation

1. **(a), their lines in the box.** The office reads the box to see what happened last on a job.
   The owner's own call in v2.5633 put the bill's send there, and the customer's text belongs
   beside it. Three lines matches the sheet, the cap keeps notes in view, and the read is one
   function in the board's slices.
2. **Customer means everything to or from them**, Billing keeping its events too.
3. **Reply and Tie in place**, the office only.
4. **The doors through the company**: the text doors open the box filled, the contract's
   Send link sends both in its one press, the email doors go through `messages-email`, and Job
   Mode's email becomes Message the customer.

## The plan

1. **PR 1, the read** (S): migration `pipeline_customer_lines` (+ `docs/migrations/…`), a SQL bed
   proving it and `loadJobMessages` pick the same lines, the call beside the stats in
   `useJobThreadNotes.ts`'s slices, `customerLinesByJobId` on the row context. Nothing drawn yet.
2. **PR 2, the box and the card** (S): `buildJobActivityBoxFeed` takes the lines as unnumbered
   entries (a `line` kind), `JobsStagesActivityBox` draws the orange tag, `cardActivityTeaser` and
   the box's teaser take the newest of the three kinds; render smokes on both. Guide:
   *open a job's activity full screen* § How the feed reads, and *text a customer from the job*.
3. **PR 3, the Customer filter** (XS): `CUSTOMER_EVENT_TYPES`, `jobActivityLineMatches` and
   `countJobActivityLines`; the box's unnumbered rule reads the same set. Kernel tests.
4. **PR 4, Reply and Tie in place** (S): the Reply press and the box in the composer's place, the
   Tie press with Undo; smokes. Guide: *open a job's activity full screen* gains *Answer from the
   activity*.
5. **PR 5, the contract doors** (S): `JobContractModal`'s two and `JobContractSignedRail`'s.
   Guides: *get a job contract signed*, *send one contract to one person*.
6. **PR 6, the bill share** (S): `StripeInvoiceSharePanel`'s mail and text drafts.
7. **PR 7, the job window and Job Mode** (S): `DetailJobModal`'s chip, `JobModeDetailsSection`'s
   email. Guide: *message a customer from job mode*.

PRs 3, 4 and 5 to 7 do not wait on the box's pick; they can go first.

## How to verify

- PR 1: the SQL bed in CI (beds do not run on this Mac), then the board's network tab: one
  `pipeline_customer_lines` call per slice beside each `jobs_ledger_thread_note_stats` call.
- PR 2: a test job with a test customer. Text it from the bubble's sheet, reload the board, and
  the box shows the orange *Text* line unnumbered while the notes keep their numbers.
- PRs 5 to 7: each door sends to the test customer's number or address. The line shows in their
  thread and in the job's activity under Customer, and the test phone's answer comes back into
  the thread.

## The owner's calls

1. **The box:** (a), (b) or (c)? With (a), is three the right count?
2. **Customer:** everything the customer got or sent? Should those events stay under Billing too,
   or move? Does their payment count?
3. **Reply:** on their lines only, or on ours too (a follow-up to our own text)?
4. **The doors:** should a text door open the box, with its confirm, or send in the press? Should a
   tech email the customer from Job Mode at all, or only text?
5. **The contract's typed number:** when it is not on the customer's contact, add it on send, or
   offer only the numbers on file, as drawn?
