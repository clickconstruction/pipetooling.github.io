---
title: turn a non-Stripe bill into a Stripe bill
category: Office
roles: dev, master_technician, assistant, controller
keywords: stripe, convert bill, pay online, hosted invoice, billed date, housecall pro, physical invoice, pay link
---
Billed something outside Stripe and now want the customer to pay by card? You convert the bill in place.

Outside Stripe means HouseCall Pro or a paper invoice. Stripe is the service that takes card payments online. The **billed date never moves**, so AR aging, Pipeline, and the customer's statement history stay exactly as they are. AR aging is how long each bill has been owed.

## Converting

1. Open the job and go to its **Bill** tab. Find the bill under **② Bills and payments**.
2. Open the bill row's **⋯** menu and press **⚡ Make Stripe bill**. The item shows on an open billed bill that isn't a Stripe bill yet. On a GC bill, the ⋯ sits at the end of the waiver row.
3. The **Make this a Stripe bill** window opens. It shows the line, the customer and a **live preview of the exact Stripe invoice**. Its **Billed date** row says the date stays as it was. Click {{button:purple|⚡ Create Stripe bill}}.

You're done. The line now has a hosted pay page and card payment. A hosted pay page is a Stripe web page where the customer pays. The customer's portal statement swaps its check-reference box for {{button:dark|PAY ONLINE}} on its own. The portal is the customer's own web page of bills and payments. **Nothing is emailed** by converting. You can send it afterward if you want, like any Stripe bill.

## What the customer gets when you send it

Press **View** on the bill's row. {{button:purple|stripe}}{{button:amber|Send Email invoice}} there sends the bill email from Click Plumbing and Electrical. The purple tag means it is a Stripe bill, so the customer pays on Stripe's page. On a Pipeline row the same button reads **stripe Resend**. The row's own **Email** is different. It opens a draft for you to send yourself.

:::example The bill email
**Invoice #1042-2610120930** for 100 Sample St — **$1,850.00**, due Oct 12, 2026
{{button:amber|Pay now}} — card or bank transfer; the invoice is attached as a PDF
**Your account, any time** — a QR code beside `my.clickplumbing.com/sam-sample-k7x2`
:::

- **Pay now** keeps working after Stripe's own link expires.
- The **QR code and short address** open their statement. The code and address appear only for a customer who has a portal. A bill addressed to someone else never shows either one. A customer with a portal and no short address is given one on their first bill. The short address is their name plus a random tail. You can change it from the globe.
- Replies come to whoever pressed Send.
- In **test mode** the email comes to you, marked as a test, and never to the customer. Test mode is Stripe's practice setting, where no real money moves. The people copied on the bill get nothing either. One copy comes to you, naming who it would have gone to.
- If our email cannot go out, Stripe sends its own instead. The toast, the small pop-up message, says so. Stripe's own email has no code.

Settings → **What customers see** shows the email as the customer reads it.

## The paperwork dates

Stripe won't accept a past due date. So the converted bill is due **on receipt**, which is the truth for an outstanding bill. The original billed date still travels with the paperwork twice. The Stripe invoice **number** carries it. The **memo** says "Originally billed …" right on the customer's invoice.

:::example When the button is greyed out
Hover it and it tells you why. **Payments may already be counted** on that bill. Unlink them first, from each payment line's ⋯ under the bill. The job may have **no linked customer** or **no customer email** yet. Add one on the Edit tab, since Stripe needs somewhere to bill. Or the line may have no amount.
:::
