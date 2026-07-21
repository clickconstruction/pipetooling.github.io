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
Generating adds a separate **ready-to-bill line** to the job — a rider invoice, billed independently of the main bill through the normal Bill Customer channels — and saves the incident record with all the evidence.
:::

## The printable notice

After generating, click {{button:primary|Open printable notice}} for a customer-facing packet: incident summary, photo references, technician statements, the terms clause, and the fee. Include it when you send the bill (attach to the physical-invoice email, or reference it on the Stripe invoice).

You can come back to the notice any time: open **Edit Job** and look for the **Riders** list in the billing section — every hazmat incident shows there with {{button:outline|Open notice}} and {{button:outline|Download PDF}} buttons, and the rider's line in the Invoices table carries a ☣ **Hazmat** tag with its memo so it never reads as an anonymous draft.

## Notes

- The fee's memo ("Hazmat remediation fee — incident {date}") shows on the Stripe invoice line automatically.
- The default amount lives in the org setting `hazmat_fee_default` (devs can change it).
- If the wizard says the terms have no §11 clause, the fee has no contractual basis — fix the terms first.
