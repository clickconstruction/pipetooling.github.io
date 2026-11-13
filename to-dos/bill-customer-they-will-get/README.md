---
name: "Bill Customer says what the customer will get: who, by which channel, the real email and text in place, and a press that names its act"
number: 343
group: ready
status: the owner said build it all, 2026-11-13; PR 1 (the words) built as v2.7157; left: PR 2 the email and text faces, PR 3 one press
summary: >
  The owner asked whether it is clear, when the assistant sends a bill, what the customer is
  receiving. It is not. On the default tab the press reads Create Stripe invoice. It makes the
  bill and moves the job to Billed Awaiting Payment, and it sends nothing. The box above it is
  headed What the customer will see, and it shows the bill's facts, not the email or the text that
  lands. Send to shows one address and no name or phone. Bills sent listed 24 open bills with no
  send on record that day. The card adds a caption per channel, a Send to line with the name and
  the phone, the real email and text drawn in place, a When you press box, and a press named for
  its act.
next: PR 2, the real email and text drawn in place; then PR 3, one press that makes the bill and emails it
size: M as a train of three (XS · S · M); left: PR 2 (S) and PR 3 (M)
blocker: none
opinion: build in the card's order; PR 3 is the one that stops a bill being made and never sent
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
- **PR 2 and PR 3**: not built yet.
