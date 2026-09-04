---
title: write a change order and send it for signature
category: Office
roles: assistant, master_technician
keywords: change order, CO, signature, net change, credit, scope change, GC, estimates
order: 87
---

When the scope changes mid-job — owner directive, field condition, plan revision — a **change order** documents what changed, what it costs, and gets the customer's signature on it. Change orders live in **Estimates** and ride the same rails as an estimate: same send, same acceptance page, same typed signature, same paper trail.

## The numbered guide

Drafts now carry a numbered guide — on a wide screen it sits to the left of the document; on a phone it's the pinned row of pills up top. It answers the two questions that matter: *what do I fill out* and *why can't I send yet*.

- Steps under **On the customer's copy** are the parts of the document itself, in the order the customer reads them. **Behind the scenes** holds Delivery — who gets notified, the project link, internal notes — which the customer never sees.
- Each step shows where it stands: a green check when done, an amber dot with a short reason ("no lines yet", "email needed for the accept link") when it wants attention, or "optional".
- Tap any step to jump straight to it. The send button under the guide tells you what's left ("2 steps left: cost lines · delivery") and lights up when the draft is ready.
- The **Editing / Customer view** switch under the guide flips the page to the exact document your customer will see — rendered by the same code as the signature page, live as you type. Switch back to Editing to change anything.
- A $0 document can still be sent — schedule-only change orders are real — but it asks you to confirm first.

## Starting one

On **Estimates**, click {{button:outline|New change order}} (right next to {{button:blue|New estimate}}). You get a draft marked with an amber {{chip:yellow|Change order}} chip — that chip follows it everywhere: the Pipeline and Ledger lists, the detail header, and the customer's document.

Pick the **customer** just like an estimate, and use the project link if the work belongs to one.

## Filling it out

The editor asks for the change-order story:

- **Description of change** — what is changing, with the plan reference if there is one.
- **Reason for change** — owner directive, field condition, plan revision…
- **Impact on schedule** — plain words: "+2 working days", "none".
- **Response requested by** — the date you want an answer.

**Impact on cost is real line items**, not a typed total. A new change order opens the section with one question — *What does this change include?* — and two ways to answer:

- {{button:outline|+ Added work}} — work going **into** the contract. One tap adds the line; name the work, note what's included (fixtures, materials, labor…), set quantity and unit price right on it.
- {{button:outline-amber|− Credit / removed work}} — work coming **out**. One tap adds a line labeled "Credit — "; the price you enter is credited back automatically.

Each tap on a button is one line — the buttons stay below the list so the next line is always one tap away. Repeat-priced work is still one tap away in the **line-item catalog**.

:::example Impact on cost
Reroute condensate line — labor + materials — **$2,840.00**
Credit — delete original stub-out — **−$390.00**
**Net change to contract: $2,450.00**
:::

The **net change** is computed from the lines, so the customer sees exactly how the number was built.

## Sending it for signature

{{button:amber|Send to customer}} works exactly like an estimate: the customer gets an email (subject "Change order #12 — <title> — $net · Click Plumbing") with a **Review & sign the change order** button, reviews the change-order document — description, reason, cost breakdown, net change, schedule impact — and signs it by typing or drawing their name. You get the same accepted notification, and the signature record (name, time, IP) is stored with the change order.

## Starting from Bids

Working a commercial job through **Bids**? The `bids?tab=change-order` form works like always — fill it out, {{button:blue|Copy to clipboard}} or open the Google Docs template for GCs who want their own paper. But now there's also {{button:green|Send for signature →}}: it creates a change-order draft in Estimates, prefilled from the form (description, reason, schedule impact, response-by date) and linked to the bid. The cost impact from the Bids form rides along as an internal note — enter it as real line items in the draft, then send it like any change order.

## After the customer signs

An accepted change order's money needs to land on a job. On the accepted row (or the detail page), tap {{button:outline|Apply to job}}:

- **Add to an existing job** — the usual case. Search for the job, and the preview shows exactly what will happen: how many lines join the job's Specific Work and the job total before → after, moved by the **net change** (credits subtract). Tap **Apply to job** and the job's activity feed gets a note — *"Change order #52 applied: +$2,450.00 — …"* — so the office sees it in Pipeline and Job Detail.
- **Create a new job** — for change-order work you want billed on its own job number. Works exactly like creating a job from an estimate; the lines carry over as Specific Work.
- **Link only (no cost change)** — the quiet escape hatch for jobs already billed or tracked elsewhere: connects the change order to the job without touching its numbers.

Applying is one-time: once a change order is linked to a job, the button becomes a link to that job.

## Keeping track

Change orders appear in the Estimates Pipeline and Ledger alongside estimates, with the amber chip telling them apart. Statuses are the same: Draft → Sent → Accepted (or Declined).
