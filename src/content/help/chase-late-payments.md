---
title: chase late payments with call mode
category: Office
roles: dev, master_technician, assistant, controller
keywords: payment follow-up, chase, call mode, promised date, can't reach, broken promise, dispute, collections, late, ask when they'll pay
---
Every open bill past its expected payment date owes us a phone call. The Pipeline keeps that queue for you.

The **📞 Ask N customers when they'll pay** card sits in Today's Money Opportunities. It counts who owes a call and the dollars riding on the answers. {{button:outline-blue|Start call mode →}} works the list one customer at a time. A bill sits under whoever it went to. A builder gets one call about all their bills, on their own number. That holds even when each job names a different homeowner.

## Where the chase lives

The card sits in **Today's Money Opportunities** on **Jobs → Pipeline**. The same cards repeat inside Quickfill's **Jobs Cleanup** station, so the daily pass finds it too. Two neighbours are easy to confuse with it:

- **"Who owes us?"** is the Dashboard's **Accounts Receivable** card. Tap it for the customer-grouped drill-down. It shows one row per customer with their open bills. It shows how long they have kept you waiting against their own pay speed. Same bills, same totals as this queue. Call mode is the *doing*, the drill is the *reading*.
- **Accounts Receivable** the page is the **bank-deposit matching desk**. Its address is `/accounts-receivable`. {{button:blue|Match deposits}} on the Needs you card opens it. It applies money that already landed to the bills it pays. Nobody gets called from there. The Needs you item opens it right where you are, on the Dashboard or on Quickfill. The card recounts when you close it.

The rest of the receivables ritual is spread over three stations, each with its own guide. **Billed Awaiting Payment** on Quickfill is the daily look at every open bill. Deposit matching is described above. **GC Review** is for certifying and sending the weekly GC statements.

## The loop

1. A bill goes **past its expected date** with no promise. That is the same clock as the row chips. The customer joins the queue.
2. Call and **record what happened**. Every outcome is one tap. It logs who called, when, and what the customer said.
3. A **promise** turns the chips green everywhere. If it passes **7 days unpaid**, the customer comes back as a {{chip:yellow|broken promise}}.
4. **Can't reach** snoozes them. They come back tomorrow, in 3 days, or in 7. Your pick.
5. A **paid bill falls out on its own.** There's nothing to clean up.

Any touch also keeps the customer quiet for 3 days. So yesterday's voicemail doesn't re-nag today.

## Working a call

Customers queue **biggest late dollars first**. Each card shows the phone number, formatted, tap to dial. When a bill actually went out by email, the card shows an ✉ email link. It shows their usual pay speed. It shows every late bill with its evidence: billed date, how it went out, partial payments, days late. So "which invoice?" never puts anyone on hold. Bills are **checkboxes**. When the GC says "898 and 663 are on Friday's run," uncheck the others. Tap the date and keep working the same call.

- **They gave a date**: three ways, matching how the answer actually comes. **📅 A date** is for "checks cut the 28th". **In N days** is for "give us two weeks", with chips for 7, 14, 21 and 30. **N days after billing** is for "we pay net 45", with chips for net 15, 30, 45 and 60. In net-terms mode each bill lands on **its own date**, computed from its bill date. Green landing chips appear on the bill lines as you choose. So you see exactly what you're promising before you commit. The button echoes the outcome: {{button:blue|Mark 3 promises · Sep 7 – Sep 23}}. Promises show as {{chip:green|✓ Promised Aug 29}} on the board.
- **Never got it? Resend**: Stripe-emailed bills resend right from the bill line. The resend is logged. The resend chip carries a purple **stripe** tag. It is a Stripe bill, so the customer pays on Stripe's page. The email itself comes from Click Plumbing and Electrical. It carries the invoice PDF and the QR code of their statement.
- *Dispute — flag for review* pulls the bill out of the ask queue. Calling again won't fix a dispute. It parks the bill in the rail's Disputes group until someone resolves it or sends it to Collections.
- **Can't reach / Left a message**: logged, snoozed, and back automatically.

Type what they said in the note box first. It saves with whichever button you tap. The small **who said it** box beside it is optional. "Dana, their AP" rides the promise into the customer's record as *by Dana by phone*. That is the same way *They said…* on the Billed row records it. See *know whether a customer keeps their word*. Leave it blank and the promise still records as a call.

:::example One call, three answers
Knight has six late bills. Dana says four are on Friday's run, one was never received, and one is retainage. Tap {{button:outline|Fri Aug 22}} for the four checked, hit Resend on the missing one, and note "retainage — holds till closeout" on the last. One call, everything recorded.
:::

## The wrap-up

Finishing the queue shows the session's receipts: dollars that now have promised dates, resends, snoozes, and disputes flagged. So "did anyone chase this?" always has an answer. When a customer racks up **2 broken promises**, the flow suggests Collections. It puts {{button:outline|Move … to Collections…}} right in the banner. That is the same typed confirm the board's Collections button opens. So you never leave call mode to escalate.
