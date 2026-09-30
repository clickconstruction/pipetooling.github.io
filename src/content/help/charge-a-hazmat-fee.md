---
title: charge a hazmat fee
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: hazmat, biohazard, exposure, fee, rider invoice, sewage, incident, terms of service
order: 13
---
A technician can be exposed to biohazardous material on a job, like sewage or waste from an open pipe. You can bill the customer a biohazard remediation fee.

The **biohazard remediation fee** is the charge for that cleanup. It is documented well enough to survive a dispute.

## Creating the fee

On **Jobs → Pipeline**, every job card has a red ☣ button. It sits next to the AIA G702 button. It opens a four-step wizard:

1. **Incident**: when it happened, what happened, who was exposed, and the stage of work. The stage is optional.
2. **Evidence**: at least one **photo link** and at least one **technician testimonial** in the tech's own words. Paste URLs for the photo links. The job's customer-pictures folder works well. Both are required. The fee won't generate without them.
3. **Liability**: the wizard shows §11 of the Terms & Conditions, the Biohazard / Hazmat Exposure Fee clause. It asks you to confirm the incident falls under it. The clause text is **snapshotted verbatim into the incident record**. That means it is copied word for word. So later edits to the terms can't weaken your evidence.
4. **Fee & generate**: the amount defaults to the org setting, normally **$500**. It is editable per incident.

:::example what generating does
Generating **adds the fee to the job's main bill** — a $1,380 billing line becomes $1,880 on the spot — and saves the incident record with all the evidence. When the bill goes out (Stripe or Physical Invoice), the fee appears as its **own labeled line item** ("Biohazard remediation fee — incident MM/DD/YYYY") so it never blends into the work lines. If the job has no open main bill (already billed, or nothing ready yet), no separate bill is created — the fee simply joins the **Job Total** (the rider shows an **In job total** tag on Edit Job) and rides on the next bill you send, where it appears as its own labeled line.
:::

## The printable notice

After generating, click {{button:blue|Open printable notice}} for a customer-facing packet. It holds the incident summary, photo references, technician statements, the terms clause, and the fee. Include it when you send the bill. Attach it to the physical-invoice email, or reference it on the Stripe invoice.

You can come back to the notice any time. Open **Edit Job**. Riders now sit in **① Line Items**, right under the fixture rows. A rider is an extra charge that rides on the job's bill. Each hazmat incident shows as its own red-tinted line. The fee is counted in the **Job Total**. The total reads *$4,210.00 work + $500.00 riders*. The line carries {{button:outline|Open notice}}, {{button:outline|Download PDF}}, and {{button:outline|Email notice…}} buttons. A bill carrying the fee still shows a ☣ **Hazmat** tag in the Invoices table. So it never reads as an anonymous draft.

## Getting the notice to the customer

Bill the job through **Bill Customer**. The bill can be the main bill carrying the fee, or a standalone rider. Either way the notice travels with the bill:

- **Physical Invoice** tab: a pre-checked **☣ Attach the Biohazard Remediation Fee Notice** box sends the notice as a second PDF. It goes beside the invoice in the same email.
- **Stripe** tab: Stripe invoices can't carry attachments, so two things happen instead. A **☣ Also email the notice** box sends the notice to the customer as its own email. It is unchecked by default. The email goes out right after the Stripe invoice is created. Click **Preview the email…** underneath to see exactly what they'll receive. The invoice **footer** automatically gains a link to a public copy of the notice. You'll see it in the Footer box before sending and can remove it. Left the box unchecked? The success screen offers **Email the notice now**. You can always send later from Edit Job, described below.
- Missed it or need it again? **Edit Job → ① Line Items → riders** has {{button:outline|Email notice…}} to re-send it any time. It confirms the recipient first. {{button:outline|Copy link}} gives the same public notice link the Stripe footer carries.

## Notes

- The fee's memo shows on the Stripe invoice line automatically. It reads *Hazmat remediation fee — incident {date}*.
- Using **Line item override** in Bill Customer folds the fee into your single custom line. The full amount ships under your wording, with no separate fee line. The notice still travels.
- The default amount lives in the org setting `hazmat_fee_default`. Devs can change it.
- If the wizard says the terms have no §11 clause, the fee has no contractual basis. Fix the terms first.

## Rolling the fee into the final bill

Open {{button:blue|Bill Customer}} on the job's main invoice. Has the biohazard fee bill **not** been sent yet? Then you'll see a checked box: **Include hazmat fee as a line item**. Leave it checked and the fee becomes its own labeled line on that one invoice. The separate draft is removed automatically. The notice link still rides in the invoice footer. Uncheck it to keep billing the fee separately. Fees the customer already received are never merged.

## When someone else pays the fee (e.g. the tenant)

The fee may belong to a different payer than the job's customer. Then click {{button:outline|Bill separately…}} on the fee's **RIDERS** row in Edit Job. The fee moves onto its own draft invoice. The customer's bill shrinks by the same amount. You're asked who pays it. Enter the tenant's name and email. Send both bills as usual. The fee invoice goes to the tenant. It **never rolls back into the customer's bill**. Full walkthrough: *bill part of a job to someone else*.

## Spotting jobs that have a fee

On **Jobs → Pipeline**, the ☣ button wears a **bright green box** on a job with a live hazmat fee. Hover it to confirm. Clicking still opens the wizard if the job needs another fee. Voided fees don't count.

## Sending the notice email after the fact

Every fee's RIDERS row in ① Line Items carries a pill that tracks the notice email:

- {{chip:yellow|Notice not emailed}} means the customer has not received the notice email yet.
- {{chip:green|Notice emailed Jul 28}} means it was sent, with the date. Hover for the address.

Click {{button:outline|Email notice…}} on the row to send it any time. A confirmation shows the address first. After the first send the button reads **Re-email notice…**. Re-sending is always safe. Every send is stamped on the fee and logged in the **Job activity** feed.

## Editing, voiding, or deleting a fee

Open {{button:outline|Edit Job}} and find the fee under **RIDERS** in ① Line Items:

- {{button:outline|Edit…}} changes the **amount, description, photo links, or testimonials**. Changing the amount also moves the Job Total and the open bill by the difference. The terms snapshot stays frozen.
- {{button:outline|Void…}} removes the charge but **keeps the record**. The record turns gray and struck-through, with a VOIDED banner on the notice. Assistants can void.
- {{button:red|Delete…}} removes the incident entirely. Only devs, leaders, and controllers can delete. Deleted fees are restorable by a dev from **Recently deleted**.

:::example Locked once billed
After the fee is on a bill the customer received, all three buttons lock and show why. Send the bill back first if the fee truly must change.
:::

Every edit, void, and delete is logged in the **Job activity** feed. An edited fee's notice carries a "Record edited" date.
