---
title: report a turnaway and bill a trip charge
category: Field Work
roles: subcontractor, helpers, superintendent, assistant
keywords: turnaway, client not home, site not ready, trip charge, no access
order: 20
---
A **Turnaway** is when you're sent to a job but can't do the work. Filing it takes seconds and lets the office bill the customer a trip charge for the wasted visit.

Maybe the client isn't home, or the site isn't ready. A trip charge is a fee for the visit.

## For technicians: filing a Turnaway

On the Job Mode card, you tap {{button:amber|Turnaway — not ready / not home}}. A small form opens:

:::example The Turnaway form
**J512** &nbsp; Smith House Repipe
123 Main St

What happened?
{{button:outline-amber|Client not home}} &nbsp; {{button:outline|Site not ready}} &nbsp; {{button:outline|Other}}

Note (optional): *"no answer, called twice"*

{{button:outline|Cancel}} &nbsp; {{button:amber|File Turnaway}}
:::

Not in Job Mode? If the job is **on your schedule today**, the same option appears in yellow when you leave a report. You open **New Report** and pick the job. You tap {{button:amber|Turnaway — not ready / not home}} under the report types. Same form, same result.

You pick the reason and add a quick note if it helps. Then you tap {{button:amber|File Turnaway}}. Two things happen automatically:

- A **field report** is saved on the job with your location. So there's a permanent record.
- **Dispatch gets an instant alert**. You don't need to call the office.

Then you head to your next job as usual. The job stays on the schedule to be re-booked.

## For the office: creating the trip charge

Turnaway alerts arrive as push notifications. They appear in the **Dispatch inbox**, on the Dashboard and on the Checklist → Review tab. A button sits right on the inbox row:

:::example A Turnaway in the Dispatch inbox
From Mike T · Wed, 7/9, 8:14 AM
**Turnaway: J512 Smith House Repipe — Client not home. No answer, called twice**

{{button:outline-amber|Create trip charge}} &nbsp; {{button:outline|Dismiss}}
:::

1. You tap {{button:outline-amber|Create trip charge}}.
2. The amount is pre-filled from Settings for that reason. You adjust it if this job warrants something different.
3. You confirm with {{button:amber|Create trip charge}}. The charge lands in **Ready to Bill** as its own line. The inbox item closes itself with a record of what was created.

The trip charge is **extra money, not a slice of the job**. The job's total goes up by the same amount. So the job's own remainder bill, the bill for what is left, stays exactly what it was. The trip charge bills on its own line whenever you're ready, whatever stage the job is in.

The job itself is untouched. It stays in its normal pipeline and gets rescheduled. When you bill the trip charge through {{button:blue|Bill Customer}}, the invoice shows one clean line. It reads like *Trip charge — client not home*.

## Setting the default amounts

Devs set the per-reason default amounts in **Settings → Jobs & billing → Turnaway Trip Charges**:

:::example Settings → Turnaway Trip Charges (dev)
Client not home ($): `95` &nbsp;&nbsp; Site not ready ($): `95` &nbsp;&nbsp; {{button:blue|Save}}
:::

A dev can leave an amount blank. Then the office types it each time instead.
