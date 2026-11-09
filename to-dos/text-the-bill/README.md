---
name: "Text the bill: after a bill goes, the office texts the pay link from the company number, sees the text first, a first text says who is writing, and Send later shows and changes the time"
number: 291
group: close
status: BUILT, LIVE and WALKED 2026-11-09 — PRs v2.6771 (#7418), v2.6772 (#7435), v2.6773 (#7442), v2.6774 (#7445) merged; migration 20261109090000 pushed; messages-nudge-dispatch deployed; the cron reads */15 and its 9:00 and 9:15 ticks ran as designed; types #7449 merged; the session's walk on a ZZ Test customer passed every step, with two small fixes in #7458; left: the owner's own look and two one-word calls
summary: >
  A Stripe bill goes to the customer's email. The owner wants the office to be able to text the
  pay link too, from the company number, and to see the text as the customer will before it goes.
  When it is the customer's first text from us, the words must say who is writing, this is Rosa
  with Click Plumbing, and the app's opt-out line rides under it. Send in the morning becomes Send
  later, which names the exact time the text goes and lets the office change it.
next: the owner's own look (everything on the card is walked); two one-word calls — widen the first-text hold from the bill to every moment or not, and whether the Done line says *by text and email*; #290's switch to the my.clickplumbing.com host once its Worker line is live (the walk's first text carried clicktooling.com/pay/<id> from Bill Customer and my.clickplumbing.com/pay/<code> from the Bills tab)
size: M as a train of four (S · S · XS · S), all shipped; left: the owner's walk
blocker: none
opinion: build in the card's order; the sheet already exists and the bill line is one more moment on it, so PR 1 is mostly words and one hold
mockup: to-dos/text-the-bill/main.html
---

# Text the bill (#291)

## The ask

The owner, 2026-11-09, in his words:

> after a bill is sent, it is clear a user can elect to send the bill via SMS from our phone
> number. They will need to be able to preview in a modal what that looks like before it is
> sent and if it's the first message to the user, it's really important that we say hi this is
> user from ClickPlumbing

And on Send in the morning:

> when it comes to send in the morning I would like for the user to be able to know exactly when
> that is and to potentially change the time

He approved the six-board mock-up the same day. The boards are beside this file: `main.html` (the
strip after the bill goes), `sheet.html` (the sheet on a bill), `hold.html` (the first-text hold),
`picker.html` (the Send later picker), `first-text.html` and `later-text.html` (what the customer
sees, first text and later text). The words on them are the words to build.

## The design

**One sheet, one set of words.** The Tell the customer sheet (#115) already has a `billed` moment
with a line that says the bill went to their email and carries no link. The line becomes the bill
text, with the pay link last:

> Hi {first}, this is {me} with Click Plumbing. Your bill for {job} is ready, {amount}. Text me
> here with any question. Pay it here: {bill}

Spanish: *Hola {first}, soy {me} de Click Plumbing. Su factura por {job} está lista, {amount}.
Escríbame aquí con cualquier pregunta. Páguela aquí: {bill}*. `{amount}` fills from the bill;
`{bill}` is the bill's own pay page on a Click Plumbing address, which keeps working after
Stripe's link changes (#290 makes it short). The Done line's *Your bill follows by email* stays as
it is; whether it should say *by text and email* once bills go by text is the owner's one-word
call, noted on `later-text.html`.

**Where the sheet opens on a bill.** The share row under a sent Stripe bill (Text · Copy link ·
Email · Pay code) opens the sheet on Text with the bill's facts, in place of the bare box with
*Your invoice for … : https://invoice.stripe.com/…*. After Send Email invoice, the green strip
asks *Text {first} the pay link too? A text is read in minutes. Email waits for the evening.*
with **Text {first} the bill…** and **Not now**; the same strip follows Bill Customer making a
Stripe bill and Make Stripe bill converting one. A customer who asked for email only reads
*{first} asked for email only* in place of the question. A customer with no mobile number reads
the sheet's own hold.

**The sheet shows the number it goes from** beside the To chip: *from the company number
(512) 555-0100*, as the two boxes in Settings name it.

**A first text says who is writing.** The box already knows whether a text is the customer's
first from us (the opt-out bubble's rule, *required on a first text*). On a first text the sheet
draws the chip **FIRST TEXT TO THIS NUMBER** with *Her first text from us names you and Click
Plumbing. The app adds the carriers' opt-out line under it. Preview shows both.* Preview draws the
opt-out bubble under the words, tagged *added by the app · required on a first text*. When the
office trims the opening so the words name neither the sender's first name nor Click Plumbing,
Send is held with *This is Dana's first text from us, so it has to say who is writing. Put **this
is Rosa with Click Plumbing** back, or press **Put the opening back**.* and a press that restores
the line's opening. A later text is never held.

**Preview on a bill draws the real link**, not the sample: the bill's link exists before the send.

**After the text goes** the share row reads *Texted 3:32 PM* beside *Emailed 3:30 PM*, read from
the job's thread: an outbound text tied to the job whose body carries the bill's pay link.

**Send later.** The sheet's second press reads *Send later · Tomorrow 9:00 AM* and opens the
picker: chips **Now** / **Tomorrow 9:00 AM** / **Today 6:00 PM**, a Day and a Time field (08:00
to 21:00 in 15-minute steps), the sentence *Goes Tuesday, Nov 10 at 9:00 AM Central, in about 17
hours.*, *Texts go between 8 AM and 9 PM only, so the time field stops there.*, and the press
**Send Tuesday 9:00 AM**. Until it goes, the text waits on the Dashboard under Today's sends with
the time on its row (*Goes Tue 9:00 AM*), where the office changes it or takes it back.
`nudge_offers` gains `send_at timestamptz` beside `send_on`; the run fires every 15 minutes,
prepares the app's offers once a morning as today, and sends an office row whose `send_at` is
due, never before 8 AM or after 9 PM Central.

## Where it plugs in

What exists:

- The sheet `src/components/customers/TellCustomerSheet.tsx` over `src/lib/tellCustomer/tellCustomer.ts`
  (`TellMoment` has `billed`; `DEFAULT_LINES.billed`; `tellFills` fills `{bill}` from
  `loadNewestBillLink`, `src/lib/billing/billLinkIo.ts`; `TELL_WORDS.morningLine`); its Preview
  `TellCustomerPreview.tsx` over `src/lib/tellCustomer/preview.ts`; the reads and the send
  `tellCustomerIo.ts` (`loadContact` already reads the thread's texts by number).
- The first-text rule: `optoutReason` in `src/lib/messages/textOut.ts`, `optoutBubble` in
  `src/lib/messages/compose.ts`, `lastOurTextAt` in `replyBox.ts`; the send window draws the
  bubble (`SendWindow.tsx`). The sending number: `replyCompany` over `loadBoxSettings`
  (`replyIo.ts`, `boxes.ts`).
- The share row `src/components/jobs/StripeInvoiceSharePanel.tsx`, whose Text opens
  `ContractTextDoor` with `buildStripeInvoiceSmsText` (`src/lib/stripeInvoiceShareCopy.ts`);
  `src/lib/jobs/billShareDoors.ts` (`billEmailSentWords`, the green strip's words). Drawn by
  `JobFormInvoiceList.tsx`, `HostedStripeBillPanel.tsx` and `SendRecordInvoiceModal.tsx`; the
  bill is made in `BilledPaymentConfirmationModal.tsx`, `ConvertBillToStripeModal.tsx`,
  `SendRecordInvoiceModal.tsx`; the email draft is `EmailBillDraftModal.tsx`.
- #290 (`to-dos/short-bill-link.md`, PRs #7414 and #7415): the short
  `my.clickplumbing.com/pay/<ten letters>` link through `billTextLink`. This card does not touch
  `loadNewestBillLink` or those PRs' files beyond the share row's Text press; the text takes
  whatever `{bill}` and `billTextLink` return and swaps to the short link by itself.
- Settings → Flows: `moveSampleWords` and the Asks switch in `src/lib/flows/appSends.ts`.
- Today's sends: `src/lib/offers/offers.ts` (`morningSendOn`, `todaysSendsLine`, the row shape),
  `offersIo.ts`, the window `components/dashboard/TodaysSendsWindow.tsx`; the table `nudge_offers`
  (`20261016040000_nudge_offers.sql`: `send_on date`, `prepared_by 'office'`); the run
  `supabase/functions/messages-nudge-dispatch` over
  `_shared/gcKernels/lib/flows/nudgeDispatch.ts` (generated from `src/lib/flows/nudgeDispatch.ts`),
  its clock `src/lib/flows/nudgeRunLog.ts` (`RUN_HOUR`, `runHourNow`), scheduled by
  `20261014190000_messages_nudge_cron.sql` at `0 14,15 * * *` UTC.
- The estimate's Texted precedent: `src/lib/estimates/acceptLinkTie.ts` and `whatWentIo.ts`.
- Guides: `text-a-customer-from-the-job.md`, `schedule-a-job-and-tell-the-customer.md`,
  `turn-a-bill-into-a-stripe-bill.md`, `know-what-a-text-from-the-company-number-says.md`.
- Cards #115 (`to-dos/tell-the-customer/`), #123 (`to-dos/pipeline-text-customer/`) and #125
  (`to-dos/pipeline-customer-conversation/`) are the sheet's, the Pipeline's and the share row's
  history.

What is new: a `firstTextIntro` kernel and the hold in `src/lib/tellCustomer/`; bill facts on the
sheet; the strip's question and the Texted read; a `sendLater.ts` kernel; `nudge_offers.send_at`
and the 15-minute cron; the run's due-row send with the 8 AM to 9 PM fence.

## The plan

1. **PR 1 (S): the bill line, the sheet on a bill, the first-text hold, the preview.**
   `DEFAULT_LINES.billed` and its Spanish twin; `TellBillFacts` (the bill's id, amount label and
   pay link) on the sheet and in `tellFills`; the share row's Text opens the sheet on `billed`
   with the bill's facts (`buildStripeInvoiceSmsText` stays for the copy-only row, its words the
   new line's shape without the intro); *from the company number …* beside the To chip;
   `firstTextIntro` (unit-tested) over the thread tail the box reads; the chip, the Preview's
   opt-out bubble, the hold and **Put the opening back**; Preview draws the real pay link on a
   bill; guide section; release note, fragment, smokes for the sheet on a bill and the hold.
2. **PR 2 (S): the offer after the bill goes, and the Texted mark.** The green strip's question
   and presses after Send Email invoice, Bill Customer's Stripe bill and Make Stripe bill; *asked
   for email only*; *Texted {time}* beside *Emailed {time}* from the job's thread. No migration.
3. **PR 3 (XS): Settings → Flows.** The Billed step's sample words and default read the new line,
   so a Billed step set to Asks offers the same text from the Pipeline move. The Done line stays.
4. **PR 4 (S): Send later with the time shown and changeable.** Migration `nudge_offers.send_at`
   and the cron every 15 minutes; the run keeps its 9 AM preparation (guarded by the last-run
   mark) and sends due office rows inside 8 AM to 9 PM Central, holding one outside to the next
   8 AM with a held reason; `sendLater.ts` (the default, the fence, the words, the relative
   time); the picker; Today's sends shows and changes the time; `todaysSendsLine` counts *go
   later*; `TELL_WORDS.morningLine` and `morningWhere` become the new words; the guide's Send in
   the morning becomes Send later. Push the migration and deploy `messages-nudge-dispatch` after
   the merge.

Each PR: claim its version, `npm test` on the files it touches, `check:edge-bundles` when the
function changes, lint, the narrow typecheck, `gh pr merge N --auto`; the next PR stacks on main.

## How to verify

On the dev server or the deployed app as the dev login, on a **ZZ Test** customer with the
owner's test number as its mobile and a made-up email:

1. Make a Stripe bill on a ZZ Test job (Bill Customer → Stripe). The green strip asks *Text … the
   pay link too?*. Press **Text … the bill…**: the sheet opens on the bill with the new line
   filled, the amount and the link, *from the company number* beside To.
2. First text: the customer's thread has no text from us yet. The chip **FIRST TEXT TO THIS
   NUMBER** shows. Preview shows the bubble and the opt-out line under it with its tag. Delete
   *this is Rosa with Click Plumbing* from the box: Send goes dead with the hold's words; **Put the
   opening back** restores the line and Send comes back.
3. Send. The receipt shows the text; the share row reads *Texted {time}*. A second open of the
   sheet draws no chip and holds nothing even with the opening trimmed.
4. Send later: press *Send later · …*, pick **Today 6:00 PM**, check the sentence and the press's
   words, press. Today's sends shows *Goes … 6:00 PM*; change the time there; take it back.
5. Delete the ZZ Test rows when done (the bill voided in Stripe test mode, the texts stay as sent
   copies and are named in the report).

The text to the owner's test number is the live walk; a text to any other number is never sent
from a ZZ Test row.

## Where it stands

**Built and live 2026-11-09**, four PRs, each merged alone on main, in the card's order:

- **PR 1 v2.6771 (#7418)**: the Billed line with `{amount}` and `{bill}`, the sheet on a bill from the share row, *from the company number …*, the first-text chip, the preview's opt-out bubble and real link, the hold with **Put the opening back**. Rebased on main after #290's PR 1 (#7414) landed under it, and merged with main again after #290's PR 2 (#7415): the sheet's link is `billTextLink`'s, so it carries the ten-letter code. Nothing to push or deploy.
- **PR 2 v2.6772 (#7435)**: the green strip's question and presses after the Email door, Send Email invoice, Bill Customer's Stripe bill and Make Stripe bill; *asked for email only*; *Emailed · Texted* beside the links. No migration.
- **PR 3 v2.6773 (#7442)**: the Flows Billed step's sample fills the bill line.
- **PR 4 v2.6774 (#7445)**: Send later with the picker, `nudge_offers.send_at`, `nudge_offer_retime`, the run every fifteen minutes with the 8 AM to 9 PM window. The migration was renumbered from 20261109050000 to **20261109090000** before the PR opened, since main's newest stamp had passed it.

**Deployed and pushed 2026-11-09, after #7445 merged**, in this order: `supabase functions deploy messages-nudge-dispatch` (the deployed copy matched main before PR 4, so nothing on prod was ahead), then `bash scripts/db-push.sh` — *Applying migration 20261109090000_nudge_send_at.sql... Finished supabase db push.* — then `check:migration-drift` read 1201 local, 1201 remote, fully applied. Prod reads back `cron.job` `messages-nudge-dispatch` at `*/15 * * * *`, active; `nudge_offer_make` with its ninth argument `p_send_at timestamptz`; `nudge_offer_retime(p_offer, p_send_at)`; the function boots (`check_edge_boot`). The types regen is #7449.

**Decisions made while building, for the owner's look:**

- The first-text **hold is the bill's alone**. The chip and the preview's bubble show on every moment, but Send is held only on the `billed` moment, so the office's own Booked line keeps its say on a first text. Widening the hold to every moment is a one-line change (`TellCustomerSheet.tsx`, `introHold`) and the owner's call.
- The **Done line** still says *Your bill follows by email*. *By text and email* is the owner's one-word call (`later-text.html`).
- A text handed to a time outside 8 AM to 9 PM Central (an older client, a clock change) is **moved to the next 8 AM** with *Texts go between 8 AM and 9 PM. It goes at 8 AM.* on its row, never sent at night.

**Walked 2026-11-09, 8:40 to 9:20 AM Central**, on the dev server against prod (the same code as main, signed in as the dev), on a fresh residential customer *ZZ Test Text the bill 2026-11-09* with the test number as its mobile and the dev's own email, and its job JP1116 with one $25 line, billed through **Bill Customer → Stripe bill** in Stripe's test mode:

1. **The strip after Bill Customer** drew under the new bill: *The Stripe bill is made. Nothing has gone to the customer yet. Text ZZ the pay link too? A text is read in minutes. Email waits for the evening.* with **Text ZZ the bill…** and **Not now**.
2. **The sheet on the bill**: *Tell ZZ*, *1116 · ZZ Test Text the bill water heater*, Text to the test number, *from the company number (512) 994-2774 · ZZ reads English*, the chip **First text to this number** with its hint, the line *Hi ZZ, this is Robert with Click Plumbing. Your bill for ZZ Test Text the bill water heater is ready, $25.00. Text me here with any question. Pay it here: …/pay/<id>*, the two hints under it, the act row *Texts ZZ the bill with its pay link from the company number.*
3. **Preview**: the phone with *ZZ's first text from us* and *A number they have not seen before…*, the caption with the from number, the words with the real link, the grey bubble *Click Plumbing and Electrical. Reply STOP to opt out.* tagged *added by the app · required on a first text*, and *The link is the bill's own pay page. It opens the bill with its Pay button.*
4. **The hold**: with the opening trimmed, the box's red edge, *This is ZZ's first text from us, so it has to say who is writing. Put 'this is Robert with Click Plumbing' back, or press Put the opening back.*, Send dead, *A later text is not held.* **Put the opening back** restored the first sentence and Send came back.
5. **The send**: the receipt *Sent to ZZ*, *Text · from the company number · 8:45 AM · in ZZ's thread*; the thread row carries the opt-out line (`optout_line` first). The Bills tab and View bill read **Texted 8:45 AM**.
6. **Send Email invoice** (test mode, the email to the dev): the strip drew with the email's own success line and the question; the row read **Emailed 8:51 AM · Texted 8:45 AM**. **Text ZZ the bill…** from that strip opened the sheet as a later text (no chip), the send went with no opt-out line, the strip went away and the row re-read **Texted 8:52 AM**.
7. **Send later**: the press read *Send later · Today 9:00 AM* (8:48 AM); the picker *When it goes* with Now / Tomorrow 9:00 AM / Today 6:00 PM, Day 11/09/2026, Time 09:00, *Goes Monday, Nov 9 at 9:00 AM Central, in about 12 minutes.*, the fence and the where lines, the press *Send today 9:00 AM*; the receipt *Ready to go later* with *Goes Monday, Nov 9 at 9:00 AM Central from the company number.*; the row in `nudge_offers` with `send_at` 15:00Z and `send_on` today.
8. **Today's sends**: the Dashboard's line *2 texts ready to send, 1 goes later*; the row *Goes Today 9:00 AM* with **Change the time**; Day and Time fields; 09:15 → *It goes Today 9:15 AM.*, the row *Goes Today 9:15 AM*, `send_at` 15:15Z.
9. **The run**: the 9:00 AM tick ran the morning once (summary at 15:00:05Z, one text prepared, two kept back); the 9:15 tick sent the timed text — the offer stamped `sent_at` 15:15:01Z, the text at 15:15:02 as *The app · from the company number*, the thread's line *The app sent the text the office prepared for this time.*, the function's log *tick: 1 office text went at their time, 0 did not, 0 moved to 8 AM.* The row then read **Emailed 8:51 AM · Texted 9:15 AM**.

**Found and fixed the same day (#7458)**: under Bill Customer's just-made bill the strip stayed up after the first text went (the same strip under View bill cleared as built), so the bill panel now drops its own offer when any send goes through the row; and the hold's red edge mixed `borderColor` with the box's `border` shorthand, a React warning on every keystroke.

**Seen, not changed**: the receipt's Billed call script still says the bill *went out by email today*; the first text from Bill Customer carried `clicktooling.com/pay/<id>` while the Bills tab's carried `my.clickplumbing.com/pay/<ten letters>` (#290's host switch and its pay-code mint per host).

**Cleanup**: the Stripe test invoice voided, the job deleted (Settings → Data & recovery → Recently deleted holds it), the customer deleted. Left, since the app's own writes cannot remove them: the messaging contact (now kind *unknown*, still named ZZ Test Text the bill 2026-11-09) with its channel, its three outbound texts and the event line, the sent `nudge_offers` row and its `nudge_sent` row. Three texts reached the test number.
