---
name: "Tell the customer: every text or email to a customer is pressed by a person, seen before it goes, and followed by a receipt that suggests the call"
number: 115
group: gated
status: designed 2026-10-16 (a first pass and a second pass, below); waiting on Grace's look at the mock-up before PR 2
summary: >
  When an assistant schedules a job's first visit or sends an estimate, a Tell the customer sheet
  opens with the step's line filled for that customer, the channels that apply ticked, the words
  editable by the office, and a Send or a Skip. Nothing goes to a customer on its own: the
  reminders the morning run and the board's moves would send become offers the assistant presses
  from Today's sends on the Dashboard, unless the owner turns a step to "the app sends". After any
  text or email goes from a page other than Messages, a receipt shows what went and suggests the
  call, with the step's script, a one-tap dial, and Add to my calls, a call task in Follow up that
  Quo's webhook closes when the call lands in the thread. The estimate's reminders become a
  cadence: a text on day one, a call on day three, a text on day seven.
next: Grace's look at the mock-up; then PR 2 (the sheet on the schedule's first block and the estimate's send, the receipt).
size: L as a train (the sheet, the receipt, Today's sends, the call task, the three-way switch and the scripts in Flows, the Rescheduled line); each PR S or M
blocker: Grace's look; the A2P campaign's approval for transactional texts is to be confirmed before any automatic send
opinion: build the sheet and the receipt first; they carry the principle. Today's sends and the call task next; the cadence and the scripts are Flows editor work the office can shape as it goes.
mockup: to-dos/tell-the-customer/mockup.html
---

# Tell the customer

## The ask

Grace, 2026-10-16, after the tech's bio shipped (#114):

> I would start to incorporate this calling and texting feature into the app where when an
> assistant schedules a job or sends out an estimate they have the option to send an automated
> message to the customer and potentially follow up with a call.

And, on the pressure test:

> We want to give our users as much autonomy as possible, where no message or email should go
> out without them knowing. Which makes me think perhaps, in any case a message or email does want
> to go out, a final modal should appear suggesting the assistant call them to let them know the
> email or text went out, when not on the Messages page.

## What is already there

- **The residential customer flow**, eleven steps per job (Booked, On the way, Arrived, What we
  found, Estimate sent, Approved, Working, Done, Billed, Paid, then the review ask), each with a
  reminder: after how many days, by text, call or email, and whether the app may send it
  (`src/lib/flows/seed.ts`; Settings → Flows; `docs/MESSAGES_ARCHITECTURE.md` → *Flows, steps and
  the morning run*).
- **Stage sends** (`src/lib/flows/stageSends.ts`): dispatch's first block on a job can text the
  Booked line; the board's moves to Working, Ready to Bill, Billed and Paid can text theirs; once a
  day at most; each off until the owner turns it on. **The morning run** (`messages-nudge-dispatch`)
  sends the steps' reminders the owner switched on, never doubled, with holds.
- **The switch state on prod** (2026-10-16): Send texts on; Reply push off; the per-step app-sends
  list empty. No automated customer text has gone yet.
- **The estimate** goes by email with the customer's page link (`send-estimate-to-customer`) and
  stamps the Estimate sent step; the Approved step carries a one-day text reminder the app may send.
- **Calls**: the flow's reminder kinds include *call*; inbound calls, voicemails and missed calls
  land in the thread through Quo's webhook; the Lien desk's *owner is calling* sheet (#47) is the
  precedent for a script the assistant reads. **Quo's API sends texts and reads calls; it places
  none**, so a call is always a person's.
- **Consent and the words**: STOP and the opt-out line are handled; the office owns every customer
  line in English and Spanish; a customer-facing text registers in `customerSurfaceRegistry.ts` and
  the journey; `{first}`, `{me}`, `{day}`, `{window}`, `{link}` and `{amount}` are blanks the
  office's lines already fill.

## The decision

**Nothing reaches a customer without a person pressing it, or seeing it the moment after.** Two
kinds of moment carry it.

**The press.** When the assistant does the thing that calls for a message, a **Tell the customer**
sheet opens before anything goes: on **Add job to schedule** for a job's first visit, and on the
estimate's send. The sheet shows the step's line filled for this customer (the day and the window
from the block; the estimate's link), the channels that apply with a tick each (a booking: the text;
an estimate: the email and the text), the words in a box the office may edit (the reply box's
grammar: the office writes free text, a tech never does), *What happens* rows, and two presses:
**Skip** and a primary that says exactly what it will do (*Send text to Dana*, *Send both to Dana*).
A changed first visit, its day or its window, opens the same sheet on the **Rescheduled** line.
Later visits are the assistant's own press from the thread.

**The app's own sends become offers.** The owner's per-step switch, *The app sends this reminder*,
becomes three-way: **off · the app offers · the app sends**, and *offers* is the default the first
time a step is turned on. An offered reminder is prepared by the morning run and the board's move
with its words, and waits in **Today's sends** on the Dashboard's Customers line, where the
assistant presses each (or **Send all that are ready**), and a held one says why (no number on file,
STOP, the customer answered since). *Sends* keeps today's behaviour for a step the owner trusts,
and still writes the receipt.

**The receipt.** After any text or email to a customer goes from a page other than Messages, a
small window: *Sent to Dana* with the words as they went and the channel and time; then *Call Dana
to walk her through it?* with the step's **call script** filled for her, and three presses: **Call
Dana** (one tap on a phone; on a desktop the number, dialed in Quo), **Add to my calls** (a call
task), and **Done**. The call lands in Dana's thread when it ends, through the webhook, and closes
the task. On the Messages page the same offer is one quiet line under the sent bubble, never a
window. A receipt never stacks: one per press; the morning run's sends never open one and are
listed on the Dashboard instead. The office turns the suggestion off per step in Flows (**Suggest a
call after this goes**); it is on everywhere to start.

**The call task** lives in Follow up → *We owe them*: *Call Dana about the estimate · day 3*, with
the script, **Call**, **I called**, and **Tomorrow**. Quo's webhook marks it done when a call to that
number lands in the thread the same day. The Dashboard's Customers line counts it with the rest.

**The estimate's cadence**, in the Flows editor on the Approved step: day 1 a text (the app
offers), day 3 a call task with the script, day 7 a text; then the row rests in *They owe us* with
no more reminders. The days are the office's to change.

**The scripts.** A step gains a call script, two to four sentences the office writes in the Flows
editor in English and Spanish, with the same blanks as the lines; a default is seeded for the
booking, the estimate and the Approved cadence.

**The page link** rides in the estimate's text and its reminders, never in the booking text.

## The five calls, settled

1. **Preview on the press, offers for the app's own sends, a receipt either way.** The principle
   wants a person in every send; the preview is where the assistant sees the words first, the
   receipt is where they learn what the app did.
2. **The estimate cadence**: day 1 text, day 3 call, day 7 text, then rest.
3. **Call scripts**, office-written per step, seeded.
4. **The page link** in the estimate's texts, not the booking's.
5. **Booked** on the first visit of a job, **Rescheduled** when it moves; later visits by hand.

## Alternatives weighed

- **A. The app sends on its own with no receipt** (today's stage sends and morning run, once
  switched on). Rejected by the principle: the assistant would learn of a text from the customer.
- **B. A receipt only, no preview.** Rejected: when the assistant caused the message, they should
  see the words first, not after; the receipt alone fits only the app's own sends.
- **C. A call placed by the app after every send.** Not possible: Quo's API places no calls; and
  an automated call to a customer is a different consent regime. A call is a person's, with a
  script and a task.
- **D. The preview on the press, offers for the app's sends, the receipt with the call, the call
  task Quo closes.** Picked.
- **E. A separate Calls page.** Rejected: Follow up's *We owe them* lane already holds what we owe
  people, and the Dashboard's Customers line already counts it.
- **F. The receipt on the Messages page too.** Rejected: the thread shows the send; a window there
  would be in the way. One quiet line under the bubble.

## Is this the best we can do? The second pass

The first pass took the ask as written: a modal after every send suggesting a call to say it went.
Read back against the assistant at a desk with six jobs to schedule, the customer who gets a call
about a text, and the morning run that sends with nobody on a page, these changed:

1. **A modal after every send became a receipt that never stacks.** One per press; the morning
   run's sends are listed on the Dashboard instead of popping windows nobody is there to see.
2. **"Call to say it went" became "call to walk them through it."** The script says why we call,
   and the office can turn the suggestion off for a step where a call would be odd.
3. **The app's own sends became offers by default.** The three-way switch keeps the app's memory
   and loses the surprise; *sends* stays for the owner who wants it on a step.
4. **The call became a task Quo closes.** The webhook already logs every call; a call task marks
   itself done when a call to that number lands the same day, so nobody records the call twice.
5. **The preview became editable for the office.** The office writes free text in the reply box
   today; the step's line is the starting words, not a cage. Techs keep the no-free-text rule.
6. **Both channels became one press.** The estimate's email and its text go together, each
   ticked, and the receipt names both.
7. **A changed first visit became a Rescheduled line** instead of silence.

## Where it plugs in

- `src/lib/flows/stageSends.ts`, `nudgeDispatch.ts`, `appSends.ts` — the three-way switch
  (`messages_nudge_app_sends_v1` holds `'offer' | 'send'` per step instead of a boolean, read
  fail-soft as today's `true` = *sends*), the offers table (`nudge_offers`: step, contact, the words
  as composed, why held, pressed_by/at), the morning run writing offers instead of sending for an
  *offers* step.
- `src/components/dashboard/` — **Today's sends** on the Customers line (`customerCounts.ts`), the
  list with Send each and *Send all that are ready* (do what is ready).
- A new `src/components/customers/TellCustomerSheet.tsx` over `lib/tellCustomer/` (pure: the
  channels that apply, the words from the step line and the fills, the acts rows, the primary's
  words) and `tellCustomerIo.ts` (the send through `quo-send` and `send-estimate-to-customer`; the
  receipt's row).
- `src/components/schedule/` — the Dispatch hub's **Add job to schedule** and the block editor call
  the sheet after the first block saves, and after a first block's day or window changes.
- The estimate's send (`send-estimate-to-customer`'s caller) — the sheet with both channels.
- A new `SentReceiptWindow.tsx` over `lib/tellCustomer/receipt.ts` (the words, the channel, the
  script filled, the dial link `tel:`, the task write); the Messages reply box's inline line.
- `src/lib/followUp/` — the call task (`call_tasks` or a row kind in the queue), *We owe them*
  lane; `quo-webhook` closes it on `call.completed` to that number the same day.
- Settings → Flows (`FlowStepsTable.tsx`, `editor.ts`) — the three-way switch, **Suggest a call
  after this goes**, the call script in both languages, the Approved cadence's rows.
- `customerSurfaceRegistry.ts`, the journey, `EMAIL_CATALOG` — the booking text, the Rescheduled
  text and the estimate text registered.
- Guides: *schedule a job and tell the customer*, *send an estimate and follow it up*, *work
  Today's sends*, *call a customer from a task*; the Flows guide's new rows.

## The PR train

1. **This to-do** (the plan and the mock-up), then Grace's look.
2. **The sheet and the receipt on the schedule**: Tell the customer on the first block (the Booked
   line, editable, Send or Skip), the receipt with the call and the dial, the Rescheduled line;
   the registry; the guide.
3. **The sheet on the estimate**: both channels in one press; the receipt names both.
4. **Offers**: the three-way switch, the offers table, the morning run and the board writing offers,
   Today's sends on the Dashboard.
5. **The call task and the scripts**: the task in *We owe them*, Quo closing it, the scripts in the
   Flows editor, the Approved cadence seeded.
6. **The types** after each push.

## How to verify

Live, as an assistant, on a test customer whose number is the owner's own:

1. Schedule a test job's first visit. The sheet shows the Booked line with the day and the window;
   change a word; **Send text to Dana**. The owner's phone gets the text; the receipt shows it with
   *Call Dana to walk her through it?*; **Call Dana** dials; the call lands in the thread; **Add to
   my calls** puts a task in *We owe them*.
2. Move the visit a day: the sheet opens on the Rescheduled line. Schedule a second visit: no sheet.
3. Send the estimate: both channels ticked; **Send both**; the email and the text arrive; the receipt
   names both and the script walks through the estimate.
4. In Flows, set the Approved step to *the app offers*; the next morning run lists the day-one text
   on Today's sends; press it; the receipt does not open (it is on the Dashboard); the thread shows
   the line.
5. On day three the call task appears; **Call**; the call lands in the thread and the task closes.
6. Negative: a customer with no number holds in Today's sends with the reason; a STOP holds too.
