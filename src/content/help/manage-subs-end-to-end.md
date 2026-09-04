---
title: manage subs end to end
category: Office
roles: dev, master_technician, assistant, controller
keywords: subcontractor, subs, sub labor, work order, offer, sign to accept, compliance, W-9, COI, insurance, backcharge, sub portal, roster, onboarding, payments, settle
---
Subs run through six surfaces, each with one job. This guide walks the whole lifecycle — onboarding paperwork, the roster, offering work, tracking money, and their portal — in the order you'll actually use it.

## 1 · Onboard the paperwork — People → Contracts

Before a sub works a job, their file should hold a signed **Master Subcontract Agreement**, a **W-9**, and a current **insurance certificate (COI)**.

- Assign the **Subs packet** on their row ({{button:blue|Assign packets}}) — it flags every missing document as {{chip:red|unsent}} until handled.
- {{button:blue|Send}} a document to collect a signature by text or email (they can type or draw it), or use the **Upload Signed** tab when you're holding paper. Give COIs their **expiration date** — expiry warnings flow everywhere from that one field.
- The {{chip:gray|Dashboard}} checkbox on a document nags a signed-in sub at clock-in until it's signed.

:::example The one-minute onboard
Assign the Subs packet → Send the agreement → upload their W-9 and COI with the expiry date. Their compliance pills go green on People → Subs.
:::

## 2 · Run the roster — People → Subs

The Subs tab is HQ: one row per sub with **compliance pills** (agreement / W-9 / COI at a glance), **open work orders**, **balance due**, and their **track record**. Two things to act on here:

- The **globe** 🌐 manages their private portal — see the *share a sub their portal* guide.
- The **unlinked-sheets warning** at the top means money isn't attributed to anyone on the roster — link those sheets so every balance lands on a sub's row.
- The **Gen. Cond.** pill tracks whether they've signed the current General Conditions from the Contract library — see *review your subs in one place*.

(People → Users is only for login accounts. A roster-only sub with no login is fine — their portal link works without one.)

## 3 · Offer work — a project step's Sub work order panel

On any project workflow step, {{button:blue|Offer to…}} a sub: set the **amount**, the **work window**, the **scope lines** (frozen into the offer — exactly what they sign), and how long the **offer is good for**.

- The sub answers from their dashboard or **signs to accept on their portal** — the signature binds that scope at that price under their Master Subcontract Agreement, and a note lands in the dispatch inbox the moment they answer.
- A decline always carries a reason, so you know whether to re-price, re-window, or offer someone else.
- When the step completes, {{button:green|Settle}} releases the money into a Sub Labor sheet — the ledger below.
- No project? A **Sub Labor sheet** can send the same signed work order on its own — the **Work order** box in the sheet editor ticks the trade's scope library and freezes the sheet total as the price. See *send a sub a work order from a sheet*.

## 4 · Track the money — Jobs → Sub Labor

Every sub's pay lives on **sheets**: line items (fixtures × hours × rate, or fixed prices), payments, and backcharges. Outstanding is always *sheet total minus what's moved* — there is no separate "paid" flag to forget.

- Record payments with a **date sent** and a memo. **Memos show on the sub's portal** — write them like they'll read them; Edit Payment has a *hide memo* switch for the rare internal note.
- Backcharges are negative amounts with a required memo — the portal explains them as "a deduction we went over with you first," so go over them first.
- Each sheet's {{chip:blue|Shown on the sub's portal}} box answers their only real question — *when*: a status chip, a **payable after** date, and a plain-words reason. Blank fields make no promises.

## 5 · Set the pay rhythm once — Settings → Jobs & billing

**Sub portal · pay schedule** holds the company **pay-run day** (drives "queued for Friday's pay run" on every portal) and the **"How pay works here"** wording. Write it once, honestly — it's the paragraph that stops the where's-my-money calls.

## 6 · What comes back to you

Sub activity arrives in the **dispatch inbox**: signed-and-accepted work orders and declines with reasons. Treat those like any other dispatch item — they're subs telling you how to keep them busy.
