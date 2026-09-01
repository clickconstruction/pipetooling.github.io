---
title: chase late payments with call mode
category: Office
roles: dev, master_technician, assistant, controller
keywords: payment follow-up, chase, call mode, promised date, can't reach, broken promise, dispute, collections, late, ask when they'll pay
---
Every open bill that's past its expected payment date owes us a phone call — and the Pipeline now keeps that queue for you. The **📞 Ask N customers when they'll pay** card in Today's Money Opportunities counts who owes a call and the dollars riding on the answers; {{button:outline-blue|Start call mode →}} works the list one customer at a time.

## The loop

1. A bill goes **past its expected date** (the same clock as the row chips) with no promise → the customer joins the queue.
2. You call and **record what happened** — every outcome is one tap, and it logs who called, when, and what the customer said.
3. A **promise** turns the chips green everywhere. If it passes **7 days unpaid**, the customer comes back as a {{chip:yellow|broken promise}}.
4. **Can't reach** snoozes them — back tomorrow, in 3 days, or in 7 (your pick).
5. A **paid bill falls out on its own.** There's nothing to clean up.

Any touch also keeps the customer quiet for 3 days, so yesterday's voicemail doesn't re-nag today.

## Working a call

Customers queue **biggest late dollars first**. Each card shows the phone number, their usual pay speed, and every late bill with its evidence — billed date, how it went out, partial payments, days late — so "which invoice?" never puts anyone on hold. Bills are **checkboxes**: when the GC says "898 and 663 are on Friday's run," uncheck the others, tap the date, and keep working the same call.

- **They gave a date** — three ways, matching how the answer actually comes: **📅 A date** ("checks cut the 28th"), **In N days** ("give us two weeks" — chips for 7/14/21/30), or **N days after billing** ("we pay net 45" — chips for net 15/30/45/60). In net-terms mode each bill lands on **its own date**, computed from its bill date — green landing chips appear on the bill lines as you choose, so you see exactly what you're promising before you commit. The button echoes the outcome: {{button:blue|Mark 3 promises · Sep 7 – Sep 23}}. Promises show as {{chip:green|✓ Promised Aug 29}} on the board.
- **Never got it? Resend** — Stripe-emailed bills resend right from the bill line, and the resend is logged. The resend chip carries a purple **stripe** tag: Stripe sends the email, not ClickTooling.
- **Dispute — flag for review** — pulls the bill out of the ask queue (calling again won't fix a dispute) and parks it in the rail's Disputes group until someone resolves it or sends it to Collections.
- **Can't reach / Left a message** — logged, snoozed, and back automatically.

Type what they said in the note box first — it saves with whichever button you tap.

:::example One call, three answers
Knight has six late bills. Dana says four are on Friday's run, one was never received, and one is retainage. Tap {{button:outline|Fri Aug 22}} for the four checked, hit Resend on the missing one, and note "retainage — holds till closeout" on the last. One call, everything recorded.
:::

## The wrap-up

Finishing the queue shows the session's receipts — dollars that now have promised dates, resends, snoozes, and disputes flagged — so "did anyone chase this?" always has an answer. When a customer racks up **2 broken promises**, the flow suggests Collections.
