---
title: report a turnaway and bill a trip charge
category: Field Work
roles: subcontractor, helpers, superintendent, assistant
keywords: turnaway, client not home, site not ready, trip charge, no access
order: 20
---
A **Turnaway** is when you're dispatched to a job but can't do the work — the client isn't home, or the site isn't ready. Filing it takes seconds and lets the office bill the customer a trip charge for the wasted visit.

## For technicians: filing a Turnaway

On the Job Mode card, tap {{button:amber|Turnaway — not ready / not home}}. A small form opens:

:::example The Turnaway form
**J512** &nbsp; Smith House Repipe
123 Main St

What happened?
{{button:outline-amber|Client not home}} &nbsp; {{button:outline|Site not ready}} &nbsp; {{button:outline|Other}}

Note (optional): *"no answer, called twice"*

{{button:outline|Cancel}} &nbsp; {{button:amber|File Turnaway}}
:::

Pick the reason, add a quick note if it helps, and tap {{button:amber|File Turnaway}}. Two things happen automatically:

- A **field report** is saved on the job (with your location), so there's a permanent record.
- **Dispatch gets an instant alert** — you don't need to call the office.

Then head to your next job as usual. The job stays on the schedule to be re-booked.

## For the office: creating the trip charge

Turnaway alerts arrive as push notifications and appear in the **Dispatch inbox** (on the Dashboard and the Checklist → Review tab), with a button right on the inbox row:

:::example A Turnaway in the Dispatch inbox
From Mike T · Wed, 7/9, 8:14 AM
**Turnaway: J512 Smith House Repipe — Client not home. No answer, called twice**

{{button:outline-amber|Create trip charge}} &nbsp; {{button:outline|Dismiss}}
:::

1. Tap {{button:outline-amber|Create trip charge}}.
2. The amount is pre-filled from Settings for that reason — adjust it if this job warrants something different.
3. Confirm with {{button:amber|Create trip charge}}. The charge lands in **Ready to Bill** as its own line, and the inbox item closes itself with a record of what was created.

The job itself is untouched — it stays in its normal pipeline and gets rescheduled. When you bill the trip charge through {{button:blue|Bill Customer}}, the invoice shows one clean line like "Trip charge — client not home".

## Setting the default amounts

Devs set the per-reason default amounts in **Settings → Jobs & dispatch → Turnaway Trip Charges**:

:::example Settings → Turnaway Trip Charges (dev)
Client not home ($): `95` &nbsp;&nbsp; Site not ready ($): `95` &nbsp;&nbsp; {{button:blue|Save}}
:::

Leave an amount blank to make the office type it each time instead.
