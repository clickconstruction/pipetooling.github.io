---
title: text a customer their bill
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: bill, text, pay link, stripe, sms, company number, first text, opt out, preview, tell the customer, texted, payment links, bills tab
where: /jobs
order: 67
---
A bill goes to the customer's email. You can text them the pay link too, from the company number. A text is read in minutes.

## Open the text

1. Open the job from [Jobs](/jobs) and go to its **Bills** tab.
2. On a Stripe bill that has gone out, find **Payment links**.
3. Press {{button:outline|Text}}.

The **Tell the customer** sheet opens on the bill. The same sheet opens when you press **View** on a bill and then **Text** there.

## Read the text before it goes

The box holds the app's own Billed line, filled for this bill. It reads like this.

:::example The Billed line, filled

Hi Dana, this is Rosa with Click Plumbing. Your bill for the water heater is ready, $1,850.00. Text me here with any question. Pay it here: https://my.clickplumbing.com/pay/k7x2m9pq4n

:::

Change any word. The link is the bill's own pay page on a Click Plumbing address. It keeps working after Stripe's link changes.

Beside **Text** the sheet names the number the text goes to. Then it says **from the company number** with that number. A customer with two numbers has a **To** chip. [Pick the number a text goes to](/help/pick-the-number-a-text-goes-to) shows how to switch it.

Press **Preview** to see the text as it lands on their phone. The link in the preview is the real one.

## The first text to a number

The first text we send a number has to say who is writing. The sheet knows when this is the case. It shows the chip {{chip:yellow|First text to this number}} over the box.

The app adds the carriers' opt-out line under the words. Preview shows it in its own grey bubble, tagged *added by the app*. [Know what a text from the company number says](/help/know-what-a-text-from-the-company-number-says) explains the line.

Trim the opening and the sheet holds the send. It says *This is Dana's first text from us, so it has to say who is writing.* Press **Put the opening back** to restore the line's first sentence. Or write your own opening with your name or Click Plumbing in it.

A later text is never held. Only the first one has to introduce you.

## Send it

1. Read the words.
2. Press {{button:blue|Send text to Dana}}.
3. The receipt shows what went and offers the call.

The customer's reply lands in their thread on this job. Whoever is on Messages answers it.

## When the text cannot go

- A customer with no mobile number reads the reason in the sheet. Add a number on the customer.
- A customer who sent STOP cannot be texted. Call instead.
- Texts wait until **Send texts** is on in Settings. [Turn on texts from the company number](/help/turn-on-texts-from-the-company-number) shows how.

## More on the sheet

The sheet is the same one that opens when you schedule a visit. [Schedule a job and tell the customer](/help/schedule-a-job-and-tell-the-customer) shows the receipt and the call. [Text a customer from the job](/help/text-a-customer-from-the-job) shows the job window's own text box.
