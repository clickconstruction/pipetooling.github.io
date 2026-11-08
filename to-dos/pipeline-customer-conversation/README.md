---
name: "The customer's conversation on the Pipeline row and in its Job activity"
number: 125
group: ready
status: PRs 1 to 4 BUILT 2026-11-08 and walked; PR 5 (the contract doors, v2.6700, #7326) BUILT 2026-11-08 on the owner's calls 4 and 5 of that day — the text doors open the customer's box filled and never send in the press, the typed number not on the contact is added by one chip; PR 6 (the bill share's doors, v2.6710) BUILT 2026-11-08 on PR 5's pattern — Text opens the box with the pay link, Email sends the draft from the office; PR 7 (the job window's email chip and Job Mode's email, v2.6717) BUILT 2026-11-08 — the chip opens the customer's sheet on Email, Job Mode's address is words with a copy press and Message the customer under it; the train is built and waits on the owner's look; the older record: BUILT 2026-11-08 on the owner's picks of that night — option (a), Customer as everything to or from them, Reply and Tie in place — as four stacked PRs, PR 1 v2.6683 (#7294, the read and its migration `20261108030000_pipeline_customer_lines.sql`, pushed right after its merge), PR 2 v2.6689 (#7297, the box and the phone card), PR 3 v2.6690 (#7298, the Customer filter and the box on one set), PR 4 v2.6691 (#7299, Reply and Tie in place); walked read-only 2026-11-08 on the deployed board: the read, the box's lines and the Customer pill hold, the phone card drew no teaser at phone width (the phone rows of #30 had replaced the card it was drawn on; fixed as v2.6692, the customer's line alone), and the bar, *Nobody has answered.*, Reply and Tie wait on an inbound text from the test phone
summary: >
  The customer's side of a Pipeline job reads in three places and none holds it all. The row's
  activity box shows the team's notes, reports and bill sends but no call, text or email. The
  expanded Job activity shows the calls, texts and emails, but its Customer pill counts only those,
  so a bill sent and a contract signed sit under Billing. The speech bubble's sheet shows the last
  three lines and no notes. Job activity cannot answer a line it shows, nor tie a line that is not
  tied yet. And six doors still hand a send to someone's own phone or mail app, so nothing is
  recorded and the answer goes to that person's phone. Texting through Quo has been live since
  2026-10-16, so every send can go from the company number now.
next: The owner's look. The owner texts the company number from the test phone on the ZZ Test customer's thread and looks: the row's box draws the bar and *Nobody has answered.* on her line, Reply on it in Job activity opens the box under *Replying to …*, and a line of hers on no job shows Tie to this job (How to verify, PRs 2 and 4). A look at the phone row's new third line (v2.6692) on that text, and whether the notes should join it there. Then the three doors on a ZZ Test customer (How to verify, PRs 5 to 7).
size: S (the read) + S (the box) + XS (the filter) + S (Reply and Tie) + 3 × S (the doors)
blocker: The owner's look, and the text from the test phone that unlocks PRs 2 and 4's draws.
ver: v2.6683 · 6689 · 6690 · 6691 · 6700 · 6710 · 6717
opinion: build (a), Customer as everything to or from them, Reply and Tie in place, and the doors through the company number; the box is where the office reads what happened last, and v2.5633 already put the bill's send there
mockup: to-dos/pipeline-customer-conversation/mockup.html
---

# The customer's conversation on the Pipeline row and in its Job activity (#125)

## Where it stands

Built 2026-11-08 overnight on the owner's picks of that night, four stacked PRs in the card's order: **PR 1** v2.6683 (#7294) the read, `pipeline_customer_lines(p_job_ids, p_per_job)` in `20261108030000_pipeline_customer_lines.sql` (SECURITY INVOKER, the messages policy decides who reads), called in the thread stats' slices by `useBoardCustomerLines`, carried on the row context as `customerLinesByJobId`, with a SQL bed sharing the kernel test's fixture; the migration is pushed right after the merge, since the client calls it on every load (`check:calls-ahead` holds the deploy). **PR 2** v2.6689 (#7297) the box and the card, option (a) as drawn: unnumbered `line` entries under the orange channel tag, the bar and *Nobody has answered.* on her unanswered newest line, a press opening the sheet, the phone teaser the newest of note, report and line. **PR 3** v2.6690 (#7298) `CUSTOMER_EVENT_TYPES` in `jobActivityEvent.ts`, read by the Customer filter (a lens: the events stay under Billing, counted in their own pass) and by the box in place of `SENT_EVENT_TYPES`, the contract's and release's lines and the promise unnumbered under *Sent*, *Opened*, *Signed*, *Said*; the payment left out as recommended. **PR 4** v2.6691 Reply and Tie in place, the office only: Reply on her lines opens `JobCustomerBox` in the composer's place (an email by email, the rest by text; the box has no subject field yet, so *Re:* waits on one), Tie to this job with Undo on the toast, Another job… through `JobPickerWindow`.

**Walked 2026-11-08**, read-only on the deployed board as the owner in his Chrome, the client at v2.6691, on the two ZZ Test jobs that hold customer lines:

- **PR 1.** One `pipeline_customer_lines` call beside the one `jobs_ledger_thread_note_stats` call on the board's load, read in the network log. Holds.
- **PR 2, the box.** On the ZZ Test bio walk job the box shows the two texts the app sent (the tech's On my way and his bio) under the orange *Text* tag, unnumbered, in time order among the notes, the sender named *from the company number*. On the ZZ TEST Riders Walk job notes 7 and 8 keep their numbers and the tagged email the office tied from its own mail sits after them unnumbered. No line drew the bar or *Nobody has answered.*: every line on a ZZ Test job today is ours or from a contact that is not a customer, and no ZZ Test customer is in Waiting. Those two draws need a text in from the test phone — the owner's.
- **PR 2, the phone card.** At 375 wide the board draws no teaser on any card, notes or not. The cause is in the code, not the data: the phone board (`isMobile` under 641 px with Mobile cards on, the default under 560) renders `StagesPhoneRow` — two lines and one chip, punch list #30 — and `cardActivityTeaser` sits only on the fuller card `JobsStagesCardList` draws when `phoneRows` is unset, so it shows on Mobile cards above 640 px and never on a phone. Fixed the same day as **v2.6692**: the phone row gains a third line for the customer's newest line alone (`phoneRowCustomerTeaser`, the kernel's pick when it is a line; `StagesPhoneRow`'s `teaser`; `phoneRowTeaser` in the card list), a press on it opening the customer's window, while a note or a report that is newer leaves the row at #30's two lines. Whether the notes should come back on the phone row is still the owner's call.
- **PR 3.** The Customer pill on the ZZ Test bio walk job counts its two texts; on a real billed job it counts the bill sent (*Invoice sent to customer*) while Billing keeps it too, the lens as built. A contract's or release's line was not on a handy job and was not seen. The tagged email from a non-customer contact is not counted as Customer, as `messageTone` says.
- **PR 4.** Reply draws only on a line from the customer, and no ZZ Test job has one, so Reply, the box under *Replying to …*, Tie to this job and Undo were not seen. The owner's, with the text above.

Left after the walk: the owner's text from the test phone and the look it unlocks (PRs 2 and 4 above, and v2.6692's phone line), the call on notes on the phone row, and the doors (§ 4, PRs 5 to 7), which waited on the owner's calls 4 and 5.

**The owner's calls 4 and 5, 2026-11-08 (daytime):** a text door from the row opens the customer's box filled, with its confirm, and never sends in the press; a tech may text the customer from Job Mode but not email; when the contract's typed number is not on the customer's contact, the send adds it to the contact, asked with one chip on the send (one chip, one tap, the number joins the contact's channels as a text channel).

**PR 5 built 2026-11-08** (v2.6700, #7326, `docs/recent-features/v2.6700.md`): the kernel `src/lib/jobs/contractTextDoor.ts`, the IO `addContactPhone` in `messagesIo.ts`, the door `src/components/jobs/ContractTextDoor.tsx` (the customer's box on Text, the words and the link filled through `JobCustomerBox`'s `startWords`, a head with Copy link and ✕, the chip row when the typed number is not on the contact), wired into `JobContractModal`'s Text the link and Send the link (email + `quo-send` in one press when the number is on file, else the door with the chip; a phone alone opens the door) and `JobContractSignedRail`'s Text link. Its session stopped there on 2026-11-08 so another machine could take PRs 6 and 7 (§ Hand-over for PRs 6 and 7).

**PR 6 built 2026-11-08** (v2.6710, `docs/recent-features/v2.6710.md`): the kernel `src/lib/jobs/billShareDoors.ts` (the doors offered only with the job and its customer, the email's address found on the contact, the words), `StripeInvoiceSharePanel` with `jobId`, `customerId`, `jobStatus` and `onSent` from its three callers (the Bills tab, View bill, the panel after Bill Customer makes a Stripe bill): **Text** opens `ContractTextDoor` reused as it is, in a dialog over the row since the Bills tab's cluster sits inside the bill's grid row, with `buildStripeInvoiceSmsText`'s words and the pay link filled; **Email** keeps the draft window and its new **Send the email** sends the draft's subject and words through `messages-email` to the customer's email on their contact, signed as the reply box signs, the sent copy filed; *Open in email app* and the `mailto:` are gone, Copy stays. Guide *bill a customer and get paid*, the glossary's Job window entry.

**PR 7 built 2026-11-08** (v2.6717, `docs/recent-features/v2.6717.md`): the Job window's ✉️ chip (`DetailJobModalCustomerPanel`) opens the customer's sheet on Email through `onOpenCustomerDoor('email')` and `JobCustomerSheet`'s `initialKind`, with a copy press beside the address (the clipboard, a window to copy from when the app cannot reach it); with no door the chip copies; the ☎ chip still dials. Job Mode's address (`JobModeDetailsSection`) is words with a copy press, never a `mailto:`, and **Message the customer** under it asks the card's own door to open (`onMessageCustomer` → `MessageCustomerDoor`'s `openRev`): one sheet, one read, a text from the company number; the next job's card, with no door, shows the address alone. Guides *message a customer from job mode* (The customer's email) and *text a customer from the job* (Find the box); the glossary's Job window and Job Mode entries.

**Walked 2026-11-08** on the dev server (PR 6 and PR 7's code, the browser pane signed in as the dev) on the ZZ TEST email save walk job (JP1072, customer ZZ TEST Owner On Notice, the test number on the contact and no email on it, a paid Stripe test-mode bill), read-only except the one text the card's How to verify asks for:

- **PR 6, Text.** View bill → the Text icon on Payment Links opened the dialog *Text the pay link* over the bill: the orange box with *Your invoice for ZZ TEST email save walk ($1.00): ‹the Stripe pay link›* in it, *209 characters · 2 texts*, *Tie to: ZZ TEST email save walk*, Copy link and ✕ in the head. Send text… opened the send window naming *ZZ TEST Owner On Notice <6179396295>* from the company number. Send as text: the toast *Text sent from the company number.*, the door closed, View bill read its Stripe details again, and the line is in `messages` (text, out, the opt-out line appended) and reads on the Job tab's *Where it stands* as *The last word was Robert · from the company number, a text today*. Holds.
- **PR 6, Email.** The Email icon opened the draft window with *Send the email* in Copy's old place and no *Open in email app*. Send the email, on a contact with no email channel, toasted the refusal *ZZ's contact has no email yet, so the office cannot email the bill. Add one on the Job tab.* and kept the draft open; nothing was sent. The send itself was not seen on a ZZ customer with an email on the contact; the smoke pins it.
- **PR 7, the Job window's chip.** On the Job tab the ✉️ chip (*Customer email — email them from the office*) opened the customer's sheet on **Email**: the head *ZZ TEST Owner On Notice*, *#1072 · ZZ TEST email save walk · ‹the job's address›*, the text just sent as the last line, the Email pill lit, the quick replies, the box pre-typed *ZZ,* with the sender's from line, *Tie to: 1072 · ZZ TEST email save walk*, Attach and Send email…. Not sent. The ⧉ press beside the address could not reach the pane's clipboard and drew the copy window, *Copy the email address … Select the address below and copy it*, with the address and *I copied it*: the fallback, as built.
- **PR 7, Job Mode.** With Job Mode on, the dev's card read *No schedule for today* with no clocked-in job, so the details section and its Message the customer press were not seen live; a walk needs a clock-in on a ZZ job, which is a write, so it is the owner's. The two smokes in `JobModeDetailsSection.messageDoor.render.test.tsx` pin the address as words, the copy press, the press and the absence of a `mailto:`.

Left: the owner's look at the four doors of PRs 6 and 7 on a ZZ Test customer whose contact has an email, and Job Mode's line while clocked in; the ZZ test text can stay (a ZZ row), or go with the ZZ rows when they are cleared.

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
  with its Reply-To the office's box (R6), writes the line and files the sent copy. Neither send,
  nor the Tell the customer sheet's (v2.5681) nor the estimate email's (v2.6658), stamps the line's
  `step_key`; the step chip drawn on Went out's rows in punch list #139's mock-up waits until the
  send path does (carried here from #139 at its close, 2026-11-07).

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
| Bill share · **Open in email app** | `StripeInvoiceSharePanel.tsx` ~110 (`openMailtoWithDraft`, from `EmailBillDraftModal`) | `mailto:` with the draft's subject and body | `messages-email` with the draft's subject and body, tied to the job, its Reply-To the office's box; the sent copy filed |
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

## Hand-over for PRs 6 and 7

Everything a fresh session needs to build the last two door PRs without re-reading the train. Read `CLAUDE.md`, `docs/recent-features/v2.6700.md` (PR 5, the pattern) and the files named here; the owner's calls are made (4 and 5 above), so nothing waits on a question.

**The pattern PR 5 set (reuse it, do not redesign):**

- A **text door** never sends in the press. It opens the customer's box on Text (`JobCustomerBox` with `kind="text"` and `startWords`) tied to the job, under a head that names the act with **Copy link** and ✕; the box's send window is the confirm and its holds say why (Send texts off, STOP, a prospect not asked). `src/components/jobs/ContractTextDoor.tsx` is the whole door for the contract; PR 6's bill text can reuse it as is (its `title`, `words`, `typedPhone`, `onCopyLink`) or lift the panel into a shared `CustomerTextDoor` if a second caller makes that cleaner — a rename, not a redesign.
- An **email door** for the office goes through `messages-email` (`supabaseReplyIo().sendEmail`, or the box on Email: `JobCustomerBox kind="email"`); the box has no subject field (`ReplyBox` composes the subject), so a draft's subject rides as the first line or the box's own subject rule holds — say which in the fragment.
- **The typed number not on the contact**: `textDoorNumber` / `addContactPhone` and the chip words in `contractTextDoor.ts`. PR 6 has no typed number (the bill share reads the job's customer), so the chip row does not arise there; PR 7 neither.
- **Tests**: a kernel test for any new words; a render smoke per touched component patterned on `ContractTextDoor.render.test.tsx` (the start words go in by an effect, so wait for the textbox's value before pressing Send) and `JobContractModal.textDoor.render.test.tsx` (mock `../../lib/messages/messagesIo` for `loadCustomerContact`, `../../lib/messages/replyIo` for `supabaseReplyIo`, `../gc/messages/reply/useTextsOn` to `true`, and give `useAuth`'s mock a `useOptionalAuth` too, since `ReplyBox` reads it).
- **Each PR**: `npm run claim`, one `src/content/releaseNotes/v2.NNNN.ts` + `docs/recent-features/v2.NNNN.md`, the guide change in plain words (`src/lib/plainWords.ts`; `{{chip:yellow|…}}` is the nearest chip variant to the orange one), `npm run typecheck && npm run lint && npm test`, `gh pr create`, `gh pr merge --auto`, Auto-fix pressed by a person; cut from fresh `main` once PR 5 (v2.6700) has merged, or stack on `claude/125-doors-ebfd0b` and re-target with a merge of `origin/main` when it folds.

**PR 6, the bill share** (S) — `src/components/jobs/StripeInvoiceSharePanel.tsx`, drawn by `JobFormInvoiceList`, `HostedStripeBillPanel` and `SendRecordInvoiceModal`, each handing it `customerEmail`, `customerName`, `jobName`, `hcpNumber` and `invoiceId`; none hands the job's id or `customer_id` yet, so the panel gains `jobId` and `customerId` props (every caller has `job.id` / `editing.id` and `customer_id` at hand) and draws the two new doors only when both are given.

- **Open in email app** (`openMailtoWithDraft`, ~line 106, the button `EmailBillDraftModal` draws under `showOpenInEmailApp` / `onOpenMailto`): becomes **Send from the office** — `messages-email` through `supabaseReplyIo().sendEmail({ contactId, channelId: the customer's email channel, jobKey: jobBoxJobKey(jobId), draft: { subject, body, signature } })` with the draft's subject and body (`buildStripeInvoiceEmailSubject`, `buildStripeInvoiceEmailBody` in `src/lib/stripeInvoiceShareCopy.ts`), the contact from `loadCustomerContact(customerId)`, its Reply-To the office's box, the sent copy filed by the function. Confirm: the draft window already shows the words, so its button is the confirm (`confirmLabel`-style verb, *Send the email*); a refusal reads through `formatErrorMessage`. The `mailto:` press goes; **Copy** stays. A customer with no email channel keeps *Add a customer email on the job…*.
- **Text draft → Copy** (`SmsBillDraftModal`, `openSmsBillDraft`, `buildStripeInvoiceSmsText`): the press opens the customer's box on Text (`ContractTextDoor` or its lift) with the bill's words filled, `{bill}` already a link in `buildStripeInvoiceSmsText`'s output (v2.5628's `{bill}` fill is the box's own when the words carry the blank; here the words carry the URL, so pass them whole). **Copy** stays beside it as the fallback. The door needs a place to draw: under the share row, as the contract's draws under the rail.
- **After a send**: the panel has no reread of its own; the callers' lists re-read on `onSent` where they have one (`HostedStripeBillPanel` reads invoices again; `JobFormInvoiceList` has `threadNotes.reload` in its parent) — give the panel an optional `onSent` and call it.
- **Guide**: no guide names *Open in email app* today (grepped 2026-11-08), so the new words go where the share row is taught — *bill a customer and get paid* or *turn a bill into a stripe bill*; grep `Payment Links` and `Copy link` under `src/content/help/` for the paragraph.
- **Smokes**: `StripeInvoiceSharePanel` has no render test yet (checked 2026-11-08); write `StripeInvoiceSharePanel.render.test.tsx` with: the email press calls `sendEmail` with the draft's subject and body and no `mailto:`; the text press opens the door with the bill words; no `jobId` → the old Copy-only row.

**PR 7, the job window and Job Mode** (S):

- **The job window's email chip** — `src/components/jobs/DetailJobModal.tsx` ~line 374 (`openMailto`, drawn ~line 485 as the ✉️ chip in `DetailJobModalCustomerPanel`): the chip opens the customer's sheet on Email — `setCustomerDoorOpen(true)` plus a new `customerDoorKind` state handed to `JobCustomerSheet`'s `initialKind` (~line 2313; the sheet already takes `initialKind: 'text' | 'email'`, v2.5647). A small copy press beside the address (the clipboard, `promptDialog` fallback as `copyLink` in `JobContractSignedRail.tsx` does, `confirmLabel: 'I copied it'`). The ☎ `tel:` chip stays (§ 4's last paragraph). The panel's props already carry `customerId`; `onOpenCustomerDoor` is the door — widen it to `(kind?: 'text' | 'email') => void`.
- **Job Mode's email** — `src/components/jobMode/JobModeDetailsSection.tsx` ~line 250 (`openInExternalBrowser` on `mailto:` + the address): the owner's call — a tech texts, never emails, from Job Mode. The address becomes plain text with a copy press (`navigator.clipboard`, toast; `promptDialog` fallback), and a **Message the customer** press under it opens the card's own sheet: `DashboardJobModeCard.tsx` ~line 1266 already draws `MessageCustomerDoor` (the door to `MessageCustomerSheet`, `quo-send`'s `job_mode` path, a text from the company number, offered through `jobModeMessagesOffered`); the details section either gets an `onMessageCustomer` prop the card wires to that door's open, or draws its own `MessageCustomerDoor` with the card's `userId`, `me`, `jobName`, `jobAddress` (the door reads the customer itself). Prefer the prop: one sheet, one read. The phone `tel:` line stays.
- **Guides**: *message a customer from job mode* (the email line's new words), *text a customer from the job* § Find the box or a new short section *From the customer's email address* for the job window's chip.
- **Smokes**: `DetailJobModalCustomerPanel.render.test.tsx` (exists) gains the chip opening the sheet on Email and the copy press; `JobModeDetailsSection.updatesRev.render.test.tsx` is the pattern for a details-section smoke — add one asserting no `mailto:` and the Message the customer press.

**Then the card retires** once the owner's look is done: the three door PRs' versions in `ver`, `group: done`, and the walk's findings under Where it stands. The phone teaser (v2.6692, another session's PR) is its own line there.

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
   tech email the customer from Job Mode at all, or only text? — *Answered 2026-11-08: the box, with
   its confirm, never a send in the press; a tech texts from Job Mode and does not email.*
5. **The contract's typed number:** when it is not on the customer's contact, add it on send, or
   offer only the numbers on file, as drawn? — *Answered 2026-11-08: add it, asked with one chip on
   the send; one tap and the number joins the contact's channels as a text channel (v2.6700).*
