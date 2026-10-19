---
name: "Stage texts from the Pipeline: the stage's line ready, and the morning's reminders"
number: 124
group: gated
status: DRAFTED 2026-10-18 — the ask, the validity read, three mock-ups and the plan beside this file for the owner's read; the first draft (two more doors) drawn and set aside; nothing built
summary: >
  Tanya wants to send a customer the right message from the Pipeline in one press, the bill's
  reminder first: "Hi, this is Tanya. Here is a copy of your last invoice. Let us know if you need
  any help getting it paid." The doors exist since v2.5626 (the row's speech bubble opens the
  customer's sheet, Text opens the box) and the words exist as the team's quick replies by step,
  so what is missing is small: a {bill} blank that fills with the bill's own pay link, the stage's
  lines first in the box, the job window's bubble opening the same sheet, and the Paid step's
  reminder set to Offers so Today's sends prepares the same text every morning for the bills past
  their pay-by day. Two more doors (an icon in the job window's row, a press in the activity's
  + Add strip) were drawn first and set aside: the gap is the words and the link, not the door.
next: The owner reads the mock-up, picks the cuts and gives the Paid step its words; PR 1 is the {bill} blank.
size: S (the blank) + S (the stage's lines first) + XS (the window's bubble) + a setting (Paid to Offers)
blocker: The owner's pick, and his words for the Paid step's line.
opinion: build all three cuts and turn Paid to Offers; the morning does the hunting and the sheet keeps the deliberate press one press away
mockup: to-dos/pipeline-stage-texts/mockup.html
---

# Stage texts from the Pipeline (#124)

## The ask, in the owner's words

> I want to make it super easy for Tanya to be able to send certain kinds of messages to customers
> from jobs pipeline. For example, a comment message in build awaiting payment is hi this is Tanya.
> Here is a copy of your last invoice. Let us know if you need any help getting it paid. I think
> that should be available in these two areas [the job window's icon row; the row's activity box
> with + Add]. Would you want to help me think through the validity of this and help me make a
> mock-up and a plan? After you've made that mock up and plan, ask yourself is that the best we can
> do? And present it to me.

## What exists today

- **The door** (v2.5626, #123): the speech bubble beside the customer's name on every Pipeline row
  and card opens the customer's sheet over the board; **Text** opens the job window's own box
  (`JobCustomerBox` over `ReplyBox`), tied to the job, with **Quick replies** folded under a
  disclosure and **Attach**. The job window's header carries the same bubble (`DetailJobModal`),
  but there it still leaves for the Messages page.
- **The words**: a quick reply is the team's line, per step of the flow (`quick_replies.stepId`,
  `stepLine`), written and edited in the box itself; the blanks it fills are `{first}`, `{me}`,
  `{job}`, `{address}`, `{day}`, `{window}`, `{tech}`, `{amount}` and `{link}` (their page's link)
  in `quickReplies/blanks.ts`. `{me}` is whoever presses, so "this is Tanya" writes itself.
- **The bill's own link**: every Stripe-billed invoice has a pay page, `/pay/<invoice id>`
  (v2.3754, `lib/billing/payLink.ts` `payLinkUrl`): it names the bill, shows what is left and
  forwards to Stripe's payment page. Follow up's *They owe us* lane already builds it per bill
  (`followUp/theyOweUs.ts`). A bill billed outside Stripe has its sent copy in the job's files,
  which **Attach** can pick (`attachIo.ts` over `jobFilesIo.ts`).
- **The reminder the app already keeps**: the Residential customer flow's **Paid** step carries a
  reminder (`nudge: { days: 0, how: 'text', send: 'app', dayFact: 'pay_by' }`): on the bill's
  pay-by day the morning run prepares a text, Offers or Sends by the owner's switch. Its words
  today are the app's fallback, *Dana, checking in on paid. Anything you need from us?*, because
  nobody has written the step's line.
- **The move's ask** (v2.5627): moving a job to Billed can open Tell the customer with the Billed
  line, *your bill went to your email today*. That is the day of billing; Tanya's message is the
  follow-up weeks later.

## Is it valid

Yes, with three conditions.

1. **A link, not an attachment.** "A copy of your last invoice" by text is the bill's pay page
   link, which opens the bill and the Pay button; the sent copy's PDF rides only when the office
   attaches it. A new blank, `{bill}`, fills with the newest billed invoice's pay link; a bill with
   no pay page (billed outside Stripe) leaves the blank, the press holds and says so, and Attach
   is the way.
2. **The person's name fills itself.** The line is written once with `{me}`; whoever presses it
   is the one it names.
3. **The reminder is a flow step, so it never doubles.** The morning run keeps `nudge_sent` and
   `nudge_offers`: a bill reminded today is not reminded again tomorrow, and a text the office
   sent by hand counts as a reminder sent.

## The first draft, and why it is not the best we can do

The two doors the ask named: a **Text the customer** icon in the job window's row of icons, beside
*Send paid-in-full email*, and a **Text** press in the activity strip beside **+ Add**. Both open
the box. Drawn, then set aside: the row and the window already have the bubble, so a third and
fourth door buy nothing, and the activity strip is the crew's notes, where a customer text beside
+ Add invites the wrong press. What was missing after v2.5626 was never the door: it was that the
box opens empty, the right words sit under a folded *Quick replies*, and no line could carry the
bill. And the real case, every billed job past its day, should not need a press per job at all.

## The three cuts

1. **The `{bill}` blank** (S). `BlankKey` gains `bill`, *the bill's pay link*; `tellFills` and
   the box's fills take the job's newest billed invoice and fill `payLinkUrl(invoice.id)` when the
   invoice has a Stripe id (the rule `theyOweUs.ts` already applies), else leave it; the morning
   run's `nudgeLine` fills the same for a Paid reminder from the step's `jobId`. A line with
   `{bill}` left holds the press: *Fill {bill} before it sends*, as `{day}` does today.
2. **The stage's lines first** (S). The customer's sheet and the job window's box open with the
   Quick replies strip unfolded and the job's stage's lines first: Billed Awaiting Payment offers
   the **Paid** step's line (the reminder) and the **Billed** step's line; Working offers Working;
   Ready to Bill offers Done. One press on the chip fills the box; the person reads and presses
   **Send text…**; the confirm shows what the customer sees. A stage with no team line shows the
   app's own words for the step (`DEFAULT_LINES`), so the chip is never empty.
3. **The window's bubble opens the sheet** (XS). `DetailJobModal`'s bubble takes
   `onPressInstead` as the rows do, so the job window and the row behave alike; the activity strip
   stays notes.
4. **Paid to Offers** (a setting, no code once cut 1 lands). In Settings → Flows → Residential
   customer, the Paid step's line becomes the owner's words, *{first}, this is {me} with Click
   Plumbing. Here is a copy of your last bill: {bill}. Let us know if you need any help getting it
   paid.*, and its switch goes to **Offers**. Each morning Today's sends lists every bill past its
   pay-by day with the text ready; the office presses **Send** on each, or **Send all that are
   ready**. Nothing reaches a customer without a person pressing it.

## The plan

1. **PR 1, the blank** (S): `blanks.ts` `bill`, the fills in `tellCustomer.ts` and the box's path,
   `nudgeLine` for the run, the newest-bill read (`invoices` by job, billed, newest first, Stripe
   id present), tests for the fill, the hold and the run's line. Guide: *text a customer from the
   job* § the blanks; the Flows guide's blank list.
2. **PR 2, the stage's lines first** (S): the stage → steps map (`FELT_MOVES` plus Billed →
   Paid first), the strip unfolded on the sheet and the job box, the app's own words as the chip
   when no team line exists; smokes on the sheet and the box. Guide: *text a customer from the
   job* § From the Pipeline row gains the chip.
3. **PR 3, the window's bubble** (XS): `DetailJobModal` passes the door; one smoke.
4. **The setting**: the owner writes the Paid line in the box (Make this the office's line) or in
   Settings → Flows, and sets Paid to Offers. The first morning's Today's sends is the live test.

## The owner's calls

1. **The words.** The draft above keeps his sentence and adds the greeting and the link. The
   Spanish copy follows the customer's language as every line does.
2. **Offers or Sends.** Offers keeps a person on every send; Sends lets the app text at 9 AM. The
   plan says Offers.
3. **Email too?** The same line could go by email with the sent copy attached for a customer who
   asked for email. Not drawn; the box already offers Email.
4. **Which bills.** The Paid reminder fires on the pay-by day of each bill. A second reminder
   later (14 days on) is the step's `days` to set.
