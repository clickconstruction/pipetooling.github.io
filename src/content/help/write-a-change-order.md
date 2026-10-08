---
title: write a change order and send it for signature
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: change order, CO, signature, net change, credit, scope change, GC, estimates, confirm sheet, net change to contract, apply to job, bids change order tab
order: 87
---

When the scope, the work agreed on, changes mid-job, a **change order** documents what changed and what it costs. The change order also gets the customer's signature.

The change might come from an owner directive, a field condition or a plan revision. Change orders live in **Estimates** and ride the same rails as an estimate. Change orders get the same send, the same acceptance page, the same typed signature and the same paper trail.

## The numbered guide

Drafts now carry a numbered guide. On a wide screen the guide sits to the left of the document. On a phone the guide is the pinned row of pills up top. The guide answers the two questions that matter: *what do I fill out* and *why can't I send yet*.

- Steps under **On the customer's copy** are the parts of the document itself, in the order the customer reads them. **Behind the scenes** holds Delivery, which the customer never sees. Delivery is who gets notified, the project link and internal notes.
- Each step shows where it stands. A green check means done. An amber dot with a short reason means the step wants attention. The reason reads like "no lines yet" or "email needed for the accept link". Or the step says "optional".
- You tap any step to jump straight to it. The send button under the guide tells you what's left, like *2 steps left: cost lines · delivery*. The button lights up when the draft is ready.
- The **Editing / Customer view** switch under the guide flips the page to the exact document your customer will see. That view is rendered by the same code as the signature page, live as you type. You switch back to Editing to change anything.
- A $0 document can still be sent, since schedule-only change orders are real. A $0 send asks you to confirm first.

## Starting one

On **Estimates**, you click {{button:outline|New change order}}, right next to {{button:blue|New estimate}}. You get a draft marked with an amber {{chip:yellow|Change order}} chip. That chip follows it everywhere: the Pipeline and Ledger lists, the detail header, and the customer's document.

You pick the **customer** just like an estimate. You use the project link if the work belongs to one.

## Filling it out

The editor asks for the change-order story:

- **Description of change**: what is changing, with the plan reference if there is one.
- **Reason for change**: owner directive, field condition, plan revision…
- **Impact on schedule**: plain words, like "+2 working days" or "none".
- **Response requested by**: the date you want an answer.

**Impact on cost is real line items**, not a typed total. A new change order opens the section with one question: *What does this change include?* The section offers two ways to answer:

- {{button:outline|+ Added work}}: work going **into** the contract. One tap adds the line. You name the work and note what's included, like fixtures, materials or labor. You set quantity and unit price right on it.
- {{button:outline-amber|− Credit / removed work}}: work coming **out**. One tap adds a line labeled *Credit —*. The price you enter is credited back automatically.

Each tap on a button is one line. The buttons stay below the list, so the next line is always one tap away. Repeat-priced work is still one tap away in the **line-item catalog**.

:::example Impact on cost
Reroute condensate line — labor + materials — **$2,840.00**
Credit — delete original stub-out — **−$390.00**
**Net change to contract: $2,450.00**
:::

The **net change** is computed from the lines, so the customer sees exactly how the number was built.

## Sending it for signature

{{button:amber|Send to customer}} works exactly like an estimate. The customer gets an email with a **Review & sign the change order** button. The email's subject reads *Change order #12 — <title> — $net · Click Plumbing*. The customer reviews the change-order document: description, reason, cost breakdown, net change and schedule impact. The customer signs it by typing or drawing their name. You get the same accepted notification. The signature record is stored with the change order. The record holds the name, the time and the IP address, the internet address they signed from.

## Starting from Bids

Working a commercial job through **Bids**? The `bids?tab=change-order` form works like always. You fill it out, then {{button:blue|Copy to clipboard}} or open the Google Docs template. The template is for GCs who want their own paper. A GC is the general contractor. But now there's also {{button:green|Send for signature →}}. That button opens a short confirm sheet before anything is created.

Each of the three buttons now says what it does with your work, right under it:

:::example What leaves a record
{{button:blue|Copy to clipboard}} — *Paper copy only — nothing is saved here.* · {{button:outline|Open in Google Docs}} — *Paper copy in Docs — nothing is saved here.* · {{button:green|Send for signature →}} — *Creates a tracked change order the GC signs online — the only one of the three that leaves a record.*
:::

And as you type in **Impact on Cost**, a line under the box reads the money back to you. The line reads **$2,450.00** *Reads as a net change of $2,450.00 — this becomes the draft's total and its one cost line when you send for signature.*

Your text may have several figures and no "Net …" line. Then the line says the confirm sheet will ask you for the number instead of guessing.

:::example The confirm sheet
**Create a change order draft in Estimates?** · the description, reason, schedule impact, response-by date and your cost text, as they'll land · **Net change to contract ($)** — prefilled when your cost text has one clear number or a "Net …" line; type it otherwise (credits negative, blank = $0 for schedule-only changes) · {{button:outline|Cancel}} creates nothing · {{button:green|Create draft →}}
:::

You confirm, and the draft opens in Estimates, prefilled from the form and linked to the bid. The net change lands as a **real cost line**, not $0 with the money hidden in a note. Your typed breakdown becomes the line's description. Above **Impact on cost** the draft shows *From the Bids form — Impact on Cost as typed:* with your exact text. So you don't have to scroll to the internal notes to remember the breakdown. You adjust the lines there if you want the breakdown itemized. Then you send it like any change order.

## After the customer signs

An accepted change order's money needs to land on a job. On the accepted row or the detail page, you tap {{button:outline|Apply to job}}:

- **Add to an existing job**: the usual case. You search for the job. Any job the search finds will do. It does not have to be a job you made. The preview shows exactly what will happen. The preview shows how many lines join the job's Specific Work. The preview also shows the job total before → after, moved by the **net change**. Credits subtract. You tap **Apply to job** and the job's activity feed gets a note. The note reads *"Change order #52 applied: +$2,450.00 — …"*, so the office sees the change in Pipeline and Job Detail.
- **Create a new job**: for change-order work you want billed on its own job number. This choice works exactly like creating a job from an estimate. The lines carry over as Specific Work.
- ***Link only (no cost change)***: the quiet escape hatch for jobs already billed or tracked elsewhere. This choice connects the change order to the job without touching its numbers.

Applying is one-time: once a change order is linked to a job, the button becomes a link to that job.

## Keeping track

Change orders appear in the Estimates Pipeline and Ledger alongside estimates. The amber chip tells them apart. Statuses are the same: Draft → Sent → Accepted, or Declined.

One old estimate, #1, was *titled* "change order" before change orders had their own kind. That estimate carries a quiet dashed tag in the lists and on its detail page. The tag reads {{chip:gray|titled "change order" — an estimate, not a tracked change order}}. The old estimate follows the estimate rails and has no **Apply to job**. To track a change against a job, you start a **New change order**.
