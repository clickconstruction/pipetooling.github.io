---
title: offer options on an estimate
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: estimate options, good better best, repair or replace, customer chooses, option cards, recommended option, multiple prices, choice, tiers, add-on, add-ons, approve more than one, extras, tick any
order: 63
---
An estimate can offer the customer a **choice** — Repair vs. Replace, Good / Better / Best — and the customer picks one on the acceptance page before they sign. It can also offer **add-ons** — a softener, two hose bibs — that ride along with whatever they choose, and they tick as many as they want. One quote number, one link, one signature; only the scope they approve becomes the job.

## Build the options

On a draft estimate, press {{button:outline|＋ Option}} above the Line items. The first press turns your current estimate into **two options**: your current line items become Option 1 (marked {{chip:yellow|★ Recommended}}), and Option 2 starts as an editable copy. Press {{button:outline|＋ Option}} again for more — six is the ceiling; past that a customer stops choosing.

- **The cards are the options.** Each card shows the option's name, its running total, and how many line items it holds. Click a card to edit that option — the Line items editor below always edits the card that says *editing*.
- **Name and pitch**: the fields under the cards name the option ("Replace 50-gal") and give the one-line pitch the customer reads under it ("New 50-gallon gas heater, code-current install, 6-yr warranty"). Sell it here — this is your word on the page.
- {{button:gray|★ Recommended}} marks the option the customer page pre-selects, and the one whose total the office sees on the Pipeline until the customer decides. Exactly one option carries the star.
- {{button:gray|Remove option}} deletes the option you're editing. Removing down to one puts the estimate back to a normal single price.

:::example Repair or replace
A 9-year-old water heater fails. Option 1 "Repair" — new gas valve and anode, $1,850. Option 2 "Replace 50-gal" ★ — new unit, code kit, permit, $3,400. Option 3 "Tankless upgrade" — $6,150. You recommend the replacement; the customer sees all three and decides.
:::

## Choices and add-ons

Every option is offered one of two ways — the {{chip:gray|Offered as}} switch under the option's name:

- {{button:blue|One of the choices}} — the customer picks **exactly one** of these. Repair *or* Replace. The {{chip:yellow|★ Recommended}} one is pre-selected. This is how every option starts.
- {{button:outline|An add-on}} — rides along with whichever choice they make; they **tick any**, and none is ticked for them. The card wears a blue {{chip:blue|Add-on}} badge and its price shows with a **+**.

Make **every** option an add-on when there is nothing to choose between — five separate scopes on one estimate, say — and the customer page simply asks them to pick what they want done; at least one tick is needed before they can approve. The star cannot sit on an add-on while the estimate has a choice (add-ons are never pre-selected); on an all-add-on estimate it marks the one whose total the office sees until the customer decides.

:::example The heater, plus extras
Option 1 "Repair" and Option 2 "Replace 50-gal" ★ are **choices**. Option 3 "Water softener" ($1,950) and Option 4 "Hose bibs (2)" ($390) are **add-ons**. The customer picks Replace, ticks both add-ons, and approves *"Replace 50-gal" + 2 add-ons — $5,740*. All three options' lines become the job.
:::

## What the customer sees

Open **Customer experience → Page** (or **Preview as customer** for the full-page rehearsal) before you send: the customer gets your options as cards — name, pitch, price, and a *What's included* line-item breakdown one tap away. Choices sit under **Choose one** with the recommended one pre-selected and badged; add-ons sit under **Add to it · tick any**. Every tap swaps the document and total below, the Approve button names the whole selection — *Approve "Replace 50-gal" — $3,400.00*, or *Approve "Replace 50-gal" + 2 add-ons — $5,740.00* — and their signature applies to everything they picked. The estimate email lists every option's price in a small table, choices first and add-ons under them with a **+**, your recommendation marked and the subject carrying its total. When they accept, the estimate locks to what they picked — the accepted document (each option's lines under its own heading), the job you create from it, and the totals everywhere show exactly that.

## While it's their move

Until acceptance, the estimate's total on the Pipeline and the Estimates list is the **recommended option's** total — the number you'd forecast; add-ons are upside, not forecast — with a small *· 3 options* (or *· 4 options · 2 add-ons*) mark beside it. The estimate's **Customer activity** shows their deliberation as it happens: *Viewed option — Tankless upgrade*, each time they look. When they decide, the acceptance record says what they took of what was offered — *Accepted "Replace 50-gal" + 2 add-ons · $5,740.00 (of 4 offered)* — with each add-on and each passed-on option listed for the record.
