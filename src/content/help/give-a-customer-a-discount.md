---
title: give a customer a discount
category: Billing & Money
roles: dev, master_technician, assistant, controller
keywords: discount, percent off, dollars off, negotiated, referral, goodwill, price match, line item, job total, draw, credit, write-down
order: 12
---
A discount is a line item on the job — a percent that stays live as prices change, or a fixed dollar amount — and it prints on the customer's bill as its own line. It lives in **① Line Items** on the job's **Bill** tab, next to the work it reduces.

## Add one

1. Open the job (Jobs → Pipeline → {{button:outline|Edit}} → **Bill**) and find **① Line Items**.
2. Press {{button:green|− Add discount}} under the list. A row with a dashed **−** badge appears.
3. Type what it is for — or tap a chip: {{chip:green|Negotiated}} {{chip:green|Referral}} {{chip:green|Repeat customer}} {{chip:green|Goodwill}} {{chip:green|Price match}}. The chip fills the name; edit it if you like.
4. In the amount box type **10%** for a percent or **500** for dollars. The other form shows beside it — *−$3,774.50* under a percent, *1.32%* under dollars — and tapping it swaps which one you are entering.

:::example Job 892 — three stages, $37,745 of work, 10% negotiated
Rough In $15,098 · Top Out $15,098 · Trim Set $7,549 · **Negotiated discount 10% = −$3,774.50** → the footer reads *$37,745.00 work − $3,774.50 discount* and **Job Total: $33,970.50**.
:::

The row's second line says what it does: *10% off all 3 work lines · follows each draw · not on riders*.

## Or type the total

Agreed a number instead of a percent? Tap the **Job Total** under the list, type the total you promised — *33,500* — and press Enter. The discount row takes the difference (one is added for you if the job has none, as a *Negotiated discount*). A note under the total says what happened: type a total at or above the work and the discount clears; a discount that is already on a bill stays locked.

## From the bill itself

Already in **Bill Customer** with the customer on the phone? Press {{button:green|− Add discount}} by the amount. Two lines, in your own words: **Take off** `10%` or `500`, **or make this bill** `13,500`. A sentence tells you what it does and the new amount — *10% off Rough In · this draw only → $13,588.20* — and {{button:green|Apply}} writes the same discount row the Bill tab uses, updates the bill and the previews in place, and leaves the trail. A draw discounts its own lines; the whole-job bill discounts every line; *apply to the whole job instead* flips a draw's discount and says how much of it rides this bill.

## A standing discount

Some customers always get a rate — a repeat customer, a GC with a negotiated number. Put it on the customer once: **Customers → {{button:outline|Edit}} → Standing discount**, type `5`, tap the reason chip. From then on every new job and every bill for that customer offers it: *Done Right Foundation gets 5% (repeat customer, set on their card) — −$120.00 here* with {{button:green|Apply}} and *not on this job*. Nothing is added by itself: Apply writes the ordinary discount row (and the trail), *not on this job* waves it off for that job, and a job that already has any discount gets no offer — so a bid that was already cut is never cut twice. In Bill Customer the offer is the first line of {{button:green|− Add discount}}; **Use it** fills in the rate and the reason.

## What "follows each draw" means

A discount follows the work it applies to. When you bill a stage, that stage's share of the discount rides on the same bill as a labeled line — *Negotiated discount (10%) −$1,509.80* with Rough In — and the draws together always add up to the whole discount to the cent. The customer sees the discount on every bill, never a mystery credit on the last one. The row itself shows the first few shares: *On the customer's bill: Negotiated discount (10%) −$1,509.80 with Rough In, −$1,509.80 with Top Out, −$754.90 with Trim Set*.

The ② Invoices strip and the Make Invoice slider already show the job after the discount, so nothing there needs a second thought.

## Only part of the job?

When the job has more than one work line, the words *all 3 work lines* are a link. Tap it, untick the lines the discount should not touch, and the readout names the ones that remain — *5% off Rough In, Top Out*. A discount never applies to hazmat riders; they are pass-through fees.

## Good to know

- **It can't exceed the work.** Type more than the lines it applies to and the row says so — *Can't exceed $37,745.00 — the work it applies to* — and holds the discount at that figure.
- **Once part of it is on a bill, it locks.** Delete or send back that bill to change the discount. On a bill that already went out, use **Add discount** on the invoice row instead — that is an agreed write-down, and it keeps Stripe in sync with a credit note.
- **A discount is never a stage.** It has no Order / Any / — selector, no window, no percent done; it just follows its work.
- A change order's credit lines (a negative line on a signed change order) land on the job as a dollar discount when you apply the change order.
- The Job tab, the Pipeline's money views, and Job Summary all read the Job Total after the discount. Job Summary also marks the job with a green {{chip:green|− discount}} chip, and its toolbar totals what was discounted across the jobs in view.
- **Every change leaves a trail.** Adding, changing or removing a discount writes a **Discount** line in the job's activity feed — who, how much, on which lines — once per real change.
- On a draft bill in **② Invoices**, {{button:gray|Add discount}} adds a discount line here; on a sent bill the same button is the agreed write-down.

## Related

- To bill the stages the discount rides on, see *split a job into stages and bill stage by stage*.
- To reduce a bill that has already gone out, see *bill a customer and get paid* → Add discount.
