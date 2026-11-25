---
name: "Bill Customer says what the customer will get: who, by which channel, the real email and text in place, and a press that names its act"
number: 343
group: close
status: the owner said build it all, 2026-11-13; all three built: the words v2.7157, the faces v2.7158, one press v2.7163; walked live 2026-11-24 on a ZZ Test job with one real press in Stripe test mode, and the card's own steps hold; the walk found three faults beside them, and all three are built and merged: the face's Service address line v2.8548, the Test words v2.8545, and the due day v2.8551, with its function deployed 2026-11-25; left: the live read of each fix and the email to two people · four calls answered 2026-11-25 (UTC) in the managing session: the Test words stay as built, a second fix is to be briefed for an evening bill that Stripe's own page prints as due tomorrow, `gc-card-bill` is fixed now and not later, and more test-mode bills may be made on the ZZ Test job, on a yes asked again at the time · `gc-card-bill`'s due day is built in v2.8579 and owes one deploy on its own yes · the evening reading is briefed and read: Stripe's documentation names no zone for its page, so it waits on the owner's look at the account's time zone in Stripe
summary: >
  The owner asked whether it is clear, when the assistant sends a bill, what the customer is
  receiving. It is not. On the default tab the press reads Create Stripe invoice. It makes the
  bill and moves the job to Billed Awaiting Payment, and it sends nothing. The box above it is
  headed What the customer will see, and it shows the bill's facts, not the email or the text that
  lands. Send to shows one address and no name or phone. Bills sent listed 24 open bills with no
  send on record that day. The card adds a caption per channel, a Send to line with the name and
  the phone, the real email and text drawn in place, a When you press box, and a press named for
  its act.
next: read each of the three fixes live, the due day first, since Stripe has not yet been seen to take a due day from this function. Then walk the email to two people on a ZZ Test customer with two contacts. Then deploy `gc-card-bill` on its own yes (v2.8579). Then the owner's look at the account's time zone in Stripe, which says whether the evening reading is a setting of Stripe's or a choice of words. Then delete this card. See Left to do
size: M as a train of three (XS · S · M), all built; the walk's three faults (S · XS · XS), all built; `gc-card-bill`'s due day (S), built in v2.8579; left: the walks (XS), `gc-card-bill`'s deploy, and the evening reading (a look in Stripe, then XS of words or nothing)
blocker: none in the code; the due day's live read is one test-mode press on a ZZ Test job, and the Test words are answered: they stay as built; `gc-card-bill`'s fix is an edge function, so it owes a deploy on its own yes; the evening reading waits on a look only the owner can make, since it is behind Stripe's sign-in
opinion: build — the three faults are built and the Test words stay as built on the answer of 2026-11-25; `gc-card-bill`'s due day is built too; what is left is its deploy, the owner's look in Stripe for the evening reading, and the walks
---

# Bill Customer says what the customer will get (#343)

## The ask

The owner, 2026-11-13:

> When assistant Taunya sends out a bill, is it super clear on that screen what the customer is
> receiving? Please take a look at the screen and let me know if you think we should improve that
> screen, and show me a screenshot.

## The answer

No. The window is exact about the bill and vague about the send. Three things cause it.

1. **The main press does not send, and does not say so.** The window opens on the Stripe bill
   tab. Its press reads **Create Stripe invoice**. That makes the bill, marks it billed and moves
   the job to Billed Awaiting Payment. The customer gets nothing. The send is on the next screen:
   **Send Email invoice**, then **Yes, send it**, or **Text Dana the bill…**. The next screen does
   say *The Stripe bill is made. Nothing has gone to the customer yet.* That is after the press.
2. **What the customer will see is the bill, not the message.** The box under that heading lists
   the amount, the due day, To, From, the number, the memo and the lines. It is right, and its
   lines open to edit. It is not the email with the Pay now button, and it is not the text. The
   office never sees either before it goes. The Physical invoice tab does better: it has
   **Preview** and **Preview email**, which open the exact PDF and the exact email.
3. **Send to is an address.** It reads `dana@example.com (primary)`. No name. No phone, though a
   text is the first thing the next screen offers. The helper under it names a press, *Send Email
   invoice*, that is not on this screen.

One number from the live app on the day of the look: **Bills sent** listed *24 bills are billed
with no send on record*, and 59 more paid with none. Some of those went out another way, handed
over on site or sent from outside the app, and Bills sent has *Say how it went…* for them. The
count still fits a window where making a bill and sending it are two screens, and the first press
looks like the last.

## What leaves the window today

Read from the code on 2026-11-13. The Stripe send screen was not opened, since reaching it takes
the press that makes a bill.

| Channel | The press | What the customer gets | Copies |
|---|---|---|---|
| **Stripe bill** (the default tab) | **Create Stripe invoice** sends nothing. Then **Send Email invoice** with a *Email this invoice?* question. | Our own email through Resend, *Invoice #N from Click Plumbing and Electrical*: the amount, the due day, a **Pay now** button to `/pay/<id>` and on to Stripe's page, Stripe's PDF attached as `Invoice-N.pdf`, and the QR code of their statement when they have a portal. Stripe's own email goes only if ours cannot. | Each ticked person gets an email of their own, *Copy of invoice #N — job*, with **Pay or view the bill**. |
| **Text**, after a Stripe bill | **Text Dana the bill…**, then **Send text to Dana** | *Hi Dana, this is Rosa with Click Plumbing. Your bill for {job} is ready, {amount}. Text me here with any question. Pay it here: {link}*, from the company number. With no mobile on file the sheet says so and the press becomes Close. | None. |
| **Physical invoice** | **Send email**. It sends at once, with no second question. | One email, *Click Plumbing Invoice [#N]*, with the invoice PDF attached. No pay link. No text. | Everyone rides the same email, in the To line, and sees each address. |
| **HouseCall Pro**, behind ▾ | **Save** | Nothing. Its caption already says *ClickTooling emails nobody … the customer sees nothing from here.* | None. |
| Other doors, on the bill after it is made | Copy payment link, Draft Email, QR code, Customer pay page | The short pay link by whatever way the office passes it on. | None. |

## What she needs to know before pressing, and whether the window shows it

| | Stripe bill tab | Physical invoice tab |
|---|---|---|
| Who gets it: name, address, phone, anyone copied | **Hints.** The address and *(primary)*. The name sits lower, inside the bill box. No phone. Copies are ticks with a name and an address, which is good. | **Hints.** The same Send to line. The phone shows only inside the PDF. |
| By which channel, and what happens with nothing on file | **Hints.** The tab says *Stripe bill*, which names the tool, not what arrives. A missing email gets a banner to fix it in place. A missing mobile is not said here. | **Hints.** *Physical invoice* does not say it is an email with a PDF and no pay link. |
| What it looks like to them | **Leaves out.** The bill's facts only. No email, no text. | **Shows.** The PDF in place, Preview and Preview email. |
| The amount, the lines, the due day | **Shows.** | **Shows.** |
| How they can pay | **Leaves out.** Card or bank on Stripe's page is said nowhere before the send. | **Leaves out.** Nothing says this email has no pay link. |
| What the press will do | **Leaves out.** *Create Stripe invoice* names the tool's act and hides that nothing is sent. | **Hints.** *Send email* is true, with no count and no name. |
| What happens after: the copy, a resend, taking it back | **Leaves out.** | **Leaves out.** |

**What customers see** (Settings → What customers see, open to the assistant) already draws the
bill email as a live sample, by the same builder the real send uses, and *Bill by email* for the
PDF path. Nothing in Bill Customer links to it. It has no sample of the bill text.

## The proposal

The mock-up is `mockup.html` beside this file: the window as it is next to the proposal, at
desktop and phone width, then the Physical tab, then the one press of PR 3. Nothing in the window
moves. The new parts carry a green bar.

1. **A caption under the tabs**, one per channel, as HouseCall Pro already has. Stripe bill: *An
   email with a Pay now button. They pay by card or bank on Stripe's page.* Physical invoice: *An
   email with the invoice PDF attached. It has no pay link.*
2. **Send to names the person.** *Dana Whitfield · dana@example.com (primary)*, then *Mobile
   (512) 555-0142. A text can follow the email.* or *No mobile on file. Email only.* The helper
   says what a copy is and stops naming a press on another screen.
3. **What Dana will get, with three faces**: The bill (today's box, untouched), The email and The
   text. The email is drawn in place from this bill, with a door to the sample in What customers
   see. The text is the Billed line, with *It is your choice on the next screen.*
4. **A When you press box above the press.** What it does, what it does not, where the copy is
   kept and how to take the bill back.
5. **The press names its act.** *Make the Stripe bill*, the verb the app already uses on the
   Bills tab. On the Physical tab, *Email the invoice to Dana*, or *Email the invoice to 2* with
   copies, from `countedLabel`.

### The train, smallest first

- **PR 1 (XS), words only.** Items 1, 2, 4 and 5, and the door of item 3 as a link. One pure
  kernel, `src/lib/billing/billCustomerTheyWillGet.ts`, takes the channel, the payer's name,
  email and phone, the copies and the amount, and returns the caption, the Send to lines, the
  When you press lines and the press label. The window reads it in `sendToBlock` and beside the
  two presses. No write, no migration, no new read: the job context already carries
  `customer_phone`.
- **PR 2 (S), the faces.** The email face calls `buildStripeBillEmail`
  (`supabase/functions/_shared/stripeBillEmail.ts`, already imported by the client in
  `src/lib/customerSampleEmails.ts`) with this bill's name, amount, due day and the number the
  Stripe preview already shows, and draws it in a frame as What customers see does. The pay link
  does not exist before the bill is made, so the button is drawn dead and says so. The text face
  fills `src/lib/tellCustomer/billedLine.ts`. The heading in `StripeBillPreSubmitPreview.tsx`
  changes with it.
- **PR 3 (M), the owner's call: one press.** *Make the bill and email Dana* runs
  `submitStripeInvoice` and then the same `send-stripe-invoice` call the next screen makes, with
  *Make the bill, send later* beside it for a bill handed over in person. This is the change that
  stops a bill being made and never sent. It touches the send path, so it wants its own walk: test
  mode, the copies, the biohazard notice email, the lien waiver hand-off, and a send that fails
  after the bill is made (the bill stays, the next screen opens on it, unsent, as today).

### Left alone

- The Physical tab's **Preview** and **Preview email**. They are already exact.
- HouseCall Pro's caption.
- The Send to ticks, *Copy the other party* and *Show it on their statement*.
- The bill box itself: its lines, its edit on click and its due day.
- The next screen's words, *Nothing has gone to the customer yet*, and the *Email this invoice?*
  question.
- The tab names. *Stripe bill* and *Physical invoice* are the office's words now. The captions do
  the explaining.

## Where it plugs in

- `src/components/jobs/SendRecordInvoiceModal.tsx`: `sendToBlock`, the tab bar, the two presses
  (*Create Stripe invoice*, *Send email*), `submitStripeInvoice` for PR 3. Its map is
  `docs/SEND_RECORD_INVOICE_MODAL_ARCHITECTURE.md`. The window is the hottest billing surface, so
  check `npm run sessions` first.
- `src/components/jobs/StripeBillPreSubmitPreview.tsx`: the heading and the faces.
- `src/components/jobs/StripeInvoiceSendFromStripeButton.tsx` and `HostedStripeBillPanel.tsx`: the
  next screen, read only by PR 3.
- `src/lib/batchWords.ts` (`countedLabel`) for the counted press.
- Guides to amend with PR 1: `choose-who-gets-the-bill`, `turn-a-bill-into-a-stripe-bill`,
  `send-a-bill-to-more-than-one-person`, `text-a-customer-their-bill`.

## How to verify

Open **Bill Customer** on a ZZ test job in Ready to Bill (the Pipeline's ZZ switch, a dev seat
only, since the board hides ZZ jobs from every other role). On a phone the row opens the job
window: **Send bill…** on its bar, then **Send bill…** on the draft.

1. Each tab shows its caption. Send to shows the name, the address and the phone. On a customer
   with no mobile it reads *No mobile on file. Email only.*
2. The press reads *Make the Stripe bill*, and the box above it says nothing goes yet.
3. With one contact ticked, the Physical press reads *Email the invoice to 2*.
4. PR 2: The email face matches the sample in What customers see for the same numbers. The text
   face matches the sheet's Preview after the bill is made.
5. Press nothing that sends on a real customer. A ZZ test customer carries the dev's own address.

The 2026-11-13 look used a headless browser signed in as the dev on job 1114, *ZZ TEST dispute
walk*, at 1400 and 390 wide, with every write refused at the network. It pressed no send, and
left no row.

## Where it stands

The owner's word on the mock-up, 2026-11-13: *build it all*. That is his yes to PR 3 too.

- **PR 1, the words, v2.7157**: the caption under each tab, the name and phone in Send to, the
  *When you press* box, the presses *Make the Stripe bill* and *Email the invoice to …*, and the
  door to the sample. Built as the card says, with three choices made in the build. The first box
  line reads *The bill is made and marked billed*, since a job moves to Billed Awaiting Payment
  only when the whole job is billed. The phone line reads *Phone … A text can follow on the next
  screen* and shows only when the customer themself is billed, since a text goes to the job's
  customer and its number is read from the customer on the next screen. The counted press reads
  *Email the invoice to 2 people*.
- **PR 2, the faces, v2.7158**: *What Dana will get* with **The bill**, **The email** and **The text**. The
  email is `buildStripeBillEmail` over this bill's facts, in a frame that takes no clicks. Before
  the bill exists there is no pay page, no Stripe PDF and no read of the portal, so Pay now points
  at a sample and the note under the frame says what rides along. The text is the Billed line by
  the Tell the customer sheet's own rules: the office's line or the app's, the same fills, the
  number the sheet would pick, and the sheet's own reason when no text can go. It is read the first
  time its face is opened and writes nothing. A customer with no contact yet reads *Their number is
  read on the next screen*, since only the next screen makes the contact. The bill's box is headed
  *On the bill*.
- **PR 3, one press, v2.7163**: the Stripe tab has two presses. **Make the bill and email Dana**
  makes the bill and then makes the call **Send Email invoice** makes, once. **Make the bill, send
  later** is the old press under a truer name. The box above them says the email goes now, and
  what the quiet press is for. With a copy ticked the main press reads *Make the bill and email 2
  people*. In the dev's Stripe test mode the box says the email comes to the sender. The
  made-bill screen leads with *Bill email sent to …* and then offers the text. A send that fails
  or times out leaves the bill made, and the screen says the email did not go, with the reason
  and the press that sends it. There is no second question before the one press: the box is
  right above it, as on the Physical tab. The send itself moved to
  `src/lib/billing/sendStripeBillEmail.ts`, shared with the Send Email invoice button.

**Not done by the build**: no press that sends was made on the live app, by the look or by the
build. The one press is covered by render tests with the two edge calls answered in the test,
and by a walk of the built window on a ZZ test job up to the press. The first real press, in
Stripe test mode on a ZZ Test job, is the owner's or the office's.

## The live walk of 2026-11-24

Walked on clicktooling.com as the dev, at 730 px and 380 px, on a ZZ Test job. The toggle opened on Live, the walk pressed **Test** and confirmed it, then pressed **Make the bill and email**. The bill was made in Stripe's test mode. One email, its subject opening *[Test]*, went to the sender's own address and to nobody else. No text was sent. The test bill was voided after, so the job is on Ready to Bill again.

**Holds.** The card's own steps, but one: *Email the invoice to 2 people* was not walked, because the ZZ Test customer has one contact.

**Three faults found, all three built on 2026-11-25.** Each was read in the code first, and each held.

1. **A bill due today is made due tomorrow.** The face read *Due November 24* and the made bill read *Due November 25*.
   - The face is right. It shows the day the window holds.
   - The made bill gets no due day. `create-stripe-invoice` sends Stripe a count of days (`daysUntilDue`), and the count is never under 1. Stripe adds the count to the minute the bill is made. So a bill due today comes out due tomorrow, at any hour.
   - The fault is wider than the walk saw. The count was taken from noon UTC of the due day and rounded up, so a bill made between midnight and 6 AM Central came out a day late whatever its due day.
   - The window's first day is the browser's own date (`todayIsoDate` in `SendRecordInvoiceModal.tsx`), where the rule is the company's day (`todayYmdInAppTz`, `docs/TIME_AND_ZONES.md`).
   - **Built in PR #9766, v2.8551, merged and its function deployed 2026-11-25.** The function sends the due day itself, as one instant on that day, from the kernel `supabase/functions/_shared/stripeBillDueDate.ts`. First choice is 23:59:59 UTC of the day, when that is ten minutes ahead. Second is the last second of the day in the company's time zone, for an evening press of a bill due today. A day already over is due one day from now, as before. The window takes the company's day.
   - A refusal never stops a bill. The function had never sent Stripe a due day, and the build could not try it against Stripe. If Stripe refuses it, the bill is made on a count of days and the function logs a warning that starts `create-stripe-invoice: Stripe refused due_date`.
   - `create-stripe-invoice` was deployed on 2026-11-25 at 05:14 UTC, on the owner's word, from `main` with the merge on it. The drift check then read every function current. No migration.
2. **A test send leaves no line in Bills sent, and the box says every send is kept there.** The sentence is in `billCustomerTheyWillGet.ts` and read the same on Test and on Live.
   - `send-stripe-invoice` files no `sent_documents` copy for a test send, on purpose. It does write the send's own row, which Bills sent reads.
   - The void deletes the bill, and that row goes with it. So a test bill that is voided leaves nothing.
   - Two ways, and the pick is the owner's: the function files a test send as a test copy, which is an edge function to deploy, or the box says on Test that a test send is not kept, which is the client alone.
   - **Built in PR #9760, v2.8545, on the card's pick, the words.** On Test the box ends *Bills sent lists a test send as a test and keeps no copy.* and *Voiding the test bill takes that line off.* On Live it still ends *Every send is kept in Bills sent.* The guide `see-which-bills-went-out` says the same. **Answered 2026-11-25 (UTC) in the managing session.** Asked *Fault 2: a test send keeps no copy in Bills sent. Keep the words as built, or have the function file a test copy?*, the answer was "Keep the words as built (Recommended)", quoted from that session's record of the user's answers. The other way is closed. Nothing more is owed on fault 2.
3. **The made bill's memo opens with a *Service address* line the face does not show.** `create-stripe-invoice` puts the line before the memo. The face drew the memo alone (`StripeBillPreSubmitPreview.tsx`).
   - **Built in PR #9762, v2.8548, live since 2026-11-25.** One kernel, `supabase/functions/_shared/stripeBillMemo.ts`, writes the memo as the made bill holds it, and the face draws it: the address line, a blank line, then the office's memo. The client alone. A test holds the function's own line to the same words, so nothing is owed to a deploy.

**Presses nothing takes back,** on the list of them (#443): **Make the bill and email** (the bill can be voided, the email cannot be called back) and **Void Stripe invoice…** (the bill's line is gone for good).

**Left on prod by the walk:** one test email to the sender, and one voided test invoice in Stripe's test mode.

## Left to do

1. **Read each fix live**, on a ZZ Test job with the Stripe toggle on **Test** and read back as on. Never a real job, never Live.
   - **The face's memo (v2.8548):** open the face **The bill** and read its **Memo** row. It opens *Service address:* and the job's address. No press beyond the toggle, and no row made.
   - **The Test words (v2.8545):** read the *When you press* box on Live, then on Test. No press beyond the toggle, and no row made.
   - **The due day (v2.8551):** leave the due day on today and press **Make the bill and email**. The made-bill screen's **Customer pay page** line, the test email and the bill's Stripe page should all name today. Then void the test bill. A press after about 5:50 PM Central takes the kernel's second rule and is worth one look. It leaves one test email to the sender, one line in the email log and one voided invoice in Stripe's test mode.
   - After that first press, read the function's log for a warning that starts `create-stripe-invoice: Stripe refused due_date`. If it is there, the bill was made the old way and the fix did not take.
   - **A daytime press has a yes of 2026-11-25 (UTC), given in the managing session.** Asked *May the walker make one more test-mode Stripe bill on the ZZ TEST job in the daytime and void it, to see the fix's first rule work before 6 PM Central?*, the answer was typed, quoted from that session's record of the user's answers: "Yes, make as many as you need." That is wider than the one press asked for. It is history: each press makes a row on prod, so the yes is asked again at the time. Each press leaves what the line above lists.
   - **A second fix is to be briefed, on an answer of the same day.** The walker's note of 2026-11-25 reports one evening press, late on the company's day, of a bill due that day: the app read the day right, the function's log showed Stripe took the day sent, and Stripe's own page still printed the next day with *Due tomorrow*. That report was not checked again for this line. Asked *For a bill made late in the evening and due today, the app reads due today but Stripe's own page still reads due tomorrow. Is that worth a second fix?*, the answer was "Brief a second fix", quoted from that session's record of the user's answers. The other way was to leave it and note it here. What it frees: a brief, read in the code first, since no brief is written and no size is known. What it leaves open: the fix itself, which is `create-stripe-invoice` again and so a deploy on its own yes.
   - **The brief was written and its first step done on 2026-11-25: the read. It does not settle the zone, and nothing in the code was changed.**
     - The brief said to read first which zone Stripe's own page prints a due instant in, and to change nothing before that.
     - Stripe's documentation does not say. Its pages on the hosted invoice page, the invoice PDF, invoice emails and the invoice API name no time zone for a printed date. Read on docs.stripe.com and support.stripe.com.
     - What it does say is about other things. The account's time zone is described as a setting of the Dashboard's own times. A renewal reminder email prints in the customer's zone, then the account's, then UTC. Neither is about an invoice's due day.
     - What the walk itself shows: the instant sent was 11:59:59 PM Central on the due day. The page printed the next day. So the page did not print in Central. UTC prints the next day for that instant, and so does every zone east of Central.
     - One more thing the walk shows, as a reading and not a fact from Stripe: the page read the next day and *Due tomorrow* 26 minutes before the instant. No one zone gives both. So the date and the *Due tomorrow* line are likely worked out apart, the line against the browser's own day.
     - **So one look is left, and it is the owner's, since it is behind Stripe's sign-in:** the time zone the account is set to. Stripe's help page puts it in the Dashboard's account settings.
     - **If it reads Central:** the page does not follow the account's zone. No instant after about 6 PM Central is still on the due day in UTC, so an evening bill due today cannot read today on Stripe's page. The choice is then the owner's: leave the rule and say on the made-bill screen that Stripe's page will read tomorrow, or hold an evening bill's due day to tomorrow on every page so all three agree. The builder's pick is the words, which are the client alone.
     - **If it reads anything else:** the look alone does not settle it. Setting it to Central is the owner's own press in Stripe, and Stripe describes the setting as changing the Dashboard's own times and not the API, the exports or the payouts. One evening test bill after that says which it is. If the page then reads today, nothing in the code is owed and the fault is closed. If it still reads tomorrow, it is the choice above.
     - `stripeBillDueDate.ts` is as v2.8551 left it. A daytime bill takes its first rule, 23:59:59 UTC of the day, which is the due day in Central and in UTC alike.
2. ~~**The owner's answer on fault 2.**~~ Answered 2026-11-25: the words stay as built. It is written under fault 2 above.
3. **Walk *Email the invoice to 2 people*** on a ZZ Test customer with two contacts. It is the one step of the card the walk of 2026-11-24 could not reach.
4. **A finding beside the three, read in the code on 2026-11-25 and built in v2.8579: `gc-card-bill` sent Stripe a count of days.** It is the only other function that makes a Stripe bill. Its deploy is owed, on its own yes.
   - It does not carry fault 1 as the walk found it. Its count (`gcCardBillDue`) is whole days from the company's today, and it can be 0, so a card bill due today is not pushed to tomorrow.
   - It carries a smaller one by the same cause. Stripe adds the count to the minute of the press. Read in Central the day is right, but for a press within the hour either side of a clock change. Read in UTC, an evening press lands on the next day. A bill due today falls due the second it is made.
   - Not known from the code: whether Stripe takes a count of 0, and in which zone Stripe's own page prints the day.
   - Nothing reaches it today. The owner's switch for card bills is off, and no card bill has been made.
   - A fix is the same kernel, `stripeBillDue`, in place of the count. One function to deploy, no migration. It should land before the switch is turned on.
   - **Answered 2026-11-25 (UTC) in the managing session.** Asked *The card-bill function `gc-card-bill` carries a smaller cousin of the due-day fault and cannot be reached while its switch is off. Fix it now, or before the switch goes on?*, the answer was "Fix it now", quoted from that session's record of the user's answers. It overturns the pick of the thread that found it, which was to wait for the switch. What it frees: the build, size S by the fix brief's estimate, from the brief the last run left in its hand-over notes. What it leaves open: the function's deploy, which waits on its own yes at the time.
   - **Built in v2.8579, on that answer.** The function sends the due day itself from `stripeBillDue`, the kernel `create-stripe-invoice` uses, over one read of the clock. A bill due today is due at the end of today, not the second it is made. If Stripe refuses the due day, the card page is made on a count of days, never under 1, and the log line starts `gc-card-bill: Stripe refused due_date`.
   - The shared kernel `gcCardBill.ts` is not edited, so one function is owed a deploy and no other is put behind: `bash scripts/deploy-functions.sh gc-card-bill` from `main`.
   - The switch read off again on 2026-11-25, at 18:00 UTC, and no card bill has been made. So the fix has no live read until the switch is on. That walk is one card bill on a ZZ Test GC customer in Stripe's test mode, on its own yes.
   - The evening reading above holds for a card bill too: an evening press of a bill due today may read tomorrow on Stripe's page.
5. Then delete this card.
