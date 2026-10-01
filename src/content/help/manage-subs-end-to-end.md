---
title: manage subs end to end
category: Office
roles: dev, master_technician, assistant, controller
keywords: subcontractor, subs, sub labor, work order, offer, sign to accept, compliance, W-9, COI, insurance, backcharge, sub portal, roster, onboarding, payments, settle, bench, inactive sub, active sub, reactivate, last worked
---
Subs, your subcontractors, run through six surfaces, each with one job. This guide walks the whole lifecycle in the order you will actually use it.

That lifecycle is onboarding paperwork, the roster, offering work, tracking money, and their portal.

## 1 · Onboard the paperwork: People → Contracts

Before a sub works a job, their file should hold three documents. Those are a signed **Master Subcontract Agreement**, a **W-9**, and a current ***insurance certificate (COI)***. The COI is the sub's proof of insurance.

- Assign the **Subs packet** on their row with {{button:blue|Assign packets}}. It flags every missing document as {{chip:red|unsent}} until handled.
- {{button:blue|Send}} a document to collect a signature by text or email. They can type or draw it. Or use the **Upload Signed** tab when you are holding paper. Give COIs their **expiration date**. Expiry warnings flow everywhere from that one field.
- The {{chip:gray|Dashboard}} checkbox on a document nags a signed-in sub at clock-in until it is signed.

:::example The one-minute onboard
Assign the Subs packet → Send the agreement → upload their W-9 and COI with the expiry date. Their compliance pills go green on People → Subs.
:::

## 2 · Run the roster: People → Subs

The Subs tab is HQ, with one row per sub. Each row shows **compliance pills**, **open work orders**, **balance due**, and their **track record**. The compliance pills show agreement, W-9 and COI at a glance. Two things to act on here:

- The **globe** 🌐 manages their private portal. See the *share a sub their portal* guide.
- The **unlinked-sheets warning** at the top means money is not attributed to anyone on the roster. Link those sheets so every balance lands on a sub's row.
- A sheet also links to its **job**. Pick the job on the sheet, or use {{button:outline|Link this sheet}} on Jobs → Subs → Work. The link is the job itself, not its number. So a job that only has a Click number links like any other. The sheet follows the job on the Team board, the Job Summary and the work-order board.
- The ***Gen. Cond.*** pill tracks whether they have signed the current General Conditions from the Contract library. See *review your subs in one place*.

### Active or on the bench

Every row has a **Status**. It is {{chip:green|Active}} with *last worked &lt;date&gt;* beneath it, or {{chip:gray|Bench since &lt;date&gt;}}. The pills at the top switch between **Active**, **On the bench**, and **All**.

- {{button:outline|Bench…}} sets a sub aside without archiving them. Pick the date and type a one-line reason. Their portal link, sheets, balances, and documents stay exactly where they are. The row just moves to the bench. A benched sub is left out of the Sub Labor sheet form's crew lists until you reactivate them. A name already on a sheet stays.
- {{button:blue|Reactivate}} brings them back with one click.
- The app never moves anyone on its own. It only nudges. An active sub with no work for **90 days** shows *Quiet for N months · Bench…*. A sub who never worked shows it 60 days after being added. A benched sub who turns up on a new sheet or accepts a work order shows *New work · Reactivate?*.
- While benched, a sub sits behind {{button:outline|+ N on the bench}} in the work order's Sub step. They are still pickable there, since offering work is how they come back. They sit under **On the bench** in the Assign… list. They show one gray {{chip:gray|on the bench}} chip on People → Users. Their paperwork nags pause until you reactivate them.

:::example When to bench, when to archive
Bench a sub who moved, went quiet, or you've paused for now — anyone who might come back. Archive a sub who is gone for good; archived sheets fold into a quiet summary line instead of a row.
:::

People → Users is only for login accounts. A roster-only sub with no login is fine. Their portal link works without one.

## 3 · Offer work: a project step's Sub work order panel

On any project workflow step, click {{button:blue|Offer to…}} to offer a sub work. Set the **amount**, the **work window**, the **scope lines**, and how long the **offer is good for**. The scope lines are frozen into the offer. They are exactly what the sub signs.

- The sub answers from their dashboard or **signs to accept on their portal**. The signature binds that scope at that price under their Master Subcontract Agreement. A note lands in the dispatch inbox the moment they answer.
- A decline always carries a reason. So you know whether to re-price, re-window, or offer someone else.
- When the step completes, {{button:green|Settle}} releases the money into a Sub Labor sheet. That is the ledger below.
- No project? A **Sub Labor sheet** can send the same signed work order on its own. The **Work order** box in the sheet editor ticks the trade's scope library. It freezes the sheet total as the price. See *send a sub a work order from a sheet*.

## 4 · Track the money: Jobs → Subs → Pay

Every sub's pay lives on **sheets**. A sheet holds line items, payments, and backcharges. A line item is fixtures × hours × rate, or a fixed price. Outstanding is always *sheet total minus what's moved*. There is no separate "paid" flag to forget.

- Record payments with a **date sent** and a memo. **Memos show on the sub's portal**. Write them like they will read them. Edit Payment has a *hide memo* switch for the rare internal note.
- Backcharges are negative amounts with a required memo. A backcharge is money held back from the sub. The portal explains them as "a deduction we went over with you first," so go over them first.
- A payment you **Move…** to another sheet or **Remove** leaves a crossed-out line on the sub's portal where it was. The line reads *Moved to #922 by the office* or *Removed by the office*, never your reason. So nobody phones about money that vanished. The destination sheet lists the payment itself.
- Each sheet's {{chip:blue|Shown on the sub's portal}} box answers their only real question, *when*. It holds a status chip, a **payable after** date, and a plain-words reason. Blank fields make no promises.

## 5 · Set the pay rhythm once: Settings → Jobs & billing

***Sub portal · pay schedule*** holds the company **pay-run day** and the **"How pay works here"** wording. The pay-run day drives *queued for Friday's pay run* on every portal. Write it once, honestly. It is the paragraph that stops the where's-my-money calls.

## 6 · What comes back to you

Sub activity arrives in the **dispatch inbox**. That is signed-and-accepted work orders and declines with reasons. Treat those like any other dispatch item. They are subs telling you how to keep them busy.
