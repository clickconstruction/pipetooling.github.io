---
title: offer options on an estimate
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: estimate options, good better best, repair or replace, customer chooses, option cards, recommended option, multiple prices, choice, tiers
order: 63
---
An estimate can offer the customer a **choice** — Repair vs. Replace, Good / Better / Best — and the customer picks one on the acceptance page before they sign. One quote number, one link, one signature; only the scope they choose becomes the job.

## Build the options

On a draft estimate, press {{button:outline|＋ Option}} above the Line items. The first press turns your current estimate into **two options**: your current line items become Option 1 (marked {{chip:yellow|★ Recommended}}), and Option 2 starts as an editable copy. Press {{button:outline|＋ Option}} again for more — six is the ceiling; past that a customer stops choosing.

- **The cards are the options.** Each card shows the option's name, its running total, and how many line items it holds. Click a card to edit that option — the Line items editor below always edits the card that says *editing*.
- **Name and pitch**: the fields under the cards name the option ("Replace 50-gal") and give the one-line pitch the customer reads under it ("New 50-gallon gas heater, code-current install, 6-yr warranty"). Sell it here — this is your word on the page.
- {{button:gray|★ Recommended}} marks the option the customer page pre-selects, and the one whose total the office sees on the Pipeline until the customer decides. Exactly one option carries the star.
- {{button:gray|Remove option}} deletes the option you're editing. Removing down to one puts the estimate back to a normal single price.

:::example Repair or replace
A 9-year-old water heater fails. Option 1 "Repair" — new gas valve and anode, $1,850. Option 2 "Replace 50-gal" ★ — new unit, code kit, permit, $3,400. Option 3 "Tankless upgrade" — $6,150. You recommend the replacement; the customer sees all three and decides.
:::

## What the customer sees

Open **Customer experience → Page** (or **Preview as customer** for the full-page rehearsal) before you send: the customer gets your options as cards — name, pitch, price, and a *What's included* line-item breakdown one tap away. The recommended one is pre-selected and badged. Picking a card swaps the document and total below it, the Approve button names their choice — *Approve "Replace 50-gal" — $3,400.00* — and their signature applies to the option they chose. The estimate email lists every option's price with a star on your recommendation. When they accept, the estimate locks to that option — the accepted document, the job you create from it, and the totals everywhere show exactly what they picked.

## While it's their move

Until acceptance, the estimate's total on the Pipeline and the Estimates list is the **recommended option's** total — the number you'd forecast — with a small *· 3 options* mark beside it. The estimate's **Customer activity** shows their deliberation as it happens: *Viewed option — Tankless upgrade*, each time they look. When they decide, the acceptance record says what they chose of what was offered, with the passed-on options listed for the record.
