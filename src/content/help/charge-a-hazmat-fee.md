---
title: charge a hazmat fee
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: hazmat, biohazard, exposure, fee, rider invoice, sewage, incident, terms of service
---
When a technician is exposed to biohazardous material on a job (sewage, waste discharged down an open pipe, and similar), you can bill the customer a **biohazard remediation fee** — documented well enough to survive a dispute.

## Creating the fee

On **Jobs → Stages**, every job card has a red ☣ button (next to the AIA G702 button). It opens a four-step wizard:

1. **Incident** — when it happened, what happened, who was exposed, and (optionally) the stage of work.
2. **Evidence** — at least one **photo link** (paste URLs — the job's customer-pictures folder works well) and at least one **technician testimonial** in the tech's own words. Both are required; the fee won't generate without them.
3. **Liability** — the wizard shows §11 (Biohazard / Hazmat Exposure Fee) of the Terms &amp; Conditions and asks you to confirm the incident falls under it. The clause text is **snapshotted verbatim into the incident record**, so later edits to the terms can't weaken your evidence.
4. **Fee &amp; generate** — the amount defaults to the org setting (normally **$500**) and is editable per incident.

:::example what generating does
Generating **adds the fee to the job's main bill** — a $1,380 billing line becomes $1,880 on the spot — and saves the incident record with all the evidence. When the bill goes out (Stripe or Physical Invoice), the fee appears as its **own labeled line item** ("Biohazard remediation fee — incident MM/DD/YYYY") so it never blends into the work lines. If the job has no open main bill (already billed, or nothing ready yet), no separate bill is created — the fee simply joins the **Job Total** (the rider shows an **In job total** tag on Edit Job) and rides on the next bill you send, where it appears as its own labeled line.
:::

## The printable notice

After generating, click {{button:primary|Open printable notice}} for a customer-facing packet: incident summary, photo references, technician statements, the terms clause, and the fee. Include it when you send the bill (attach to the physical-invoice email, or reference it on the Stripe invoice).

You can come back to the notice any time: open **Edit Job** — riders now sit in **① Line Items**, right under the fixture rows, where each hazmat incident shows as its own red-tinted line with the fee counted in the **Job Total** ("$4,210.00 work + $500.00 riders") plus {{button:outline|Open notice}}, {{button:outline|Download PDF}}, and {{button:outline|Email notice…}} buttons. A bill carrying the fee still shows a ☣ **Hazmat** tag in the Invoices table so it never reads as an anonymous draft.

## Getting the notice to the customer

When you bill the job through **Bill Customer** (the main bill carrying the fee, or a standalone rider), the notice travels with the bill:

- **Physical Invoice** tab — a pre-checked **☣ Attach the Biohazard Remediation Fee Notice** box sends the notice as a second PDF beside the invoice in the same email.
- **Stripe** tab — Stripe invoices can't carry attachments, so two things happen instead: a pre-checked **☣ Also email the notice** box sends it to the customer as its own email right after the Stripe invoice is created (click **Preview the email…** underneath to see exactly what they'll receive), and the invoice **footer** automatically gains a link to a public copy of the notice (you'll see it in the Footer box before sending and can remove it).
- Missed it or need it again? **Edit Job → ① Line Items → riders** has {{button:outline|Email notice…}} to re-send it any time (it confirms the recipient first) and {{button:outline|Copy link}} for the same public notice link the Stripe footer carries.

## Notes

- The fee's memo ("Hazmat remediation fee — incident {date}") shows on the Stripe invoice line automatically.
- Using **Line item override** in Bill Customer folds the fee into your single custom line — the full amount ships under your wording, with no separate fee line (the notice still travels).
- The default amount lives in the org setting `hazmat_fee_default` (devs can change it).
- If the wizard says the terms have no §11 clause, the fee has no contractual basis — fix the terms first.

## Rolling the fee into the final bill

If the biohazard fee bill has **not** been sent yet when you open {{button:primary|Bill Customer}} on the job's main invoice, you'll see a checked box: **Include hazmat fee as a line item**. Leave it checked and the fee becomes its own labeled line on that one invoice (the separate draft is removed automatically); the notice link still rides in the invoice footer. Uncheck it to keep billing the fee separately. Fees the customer already received are never merged.
