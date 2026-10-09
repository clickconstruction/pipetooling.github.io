---
title: offer options on an estimate
category: Office
roles: dev, master_technician, assistant, controller, estimator
keywords: estimate options, good better best, repair or replace, customer chooses, option cards, recommended option, multiple prices, choice, tiers, add-on, add-ons, approve more than one, extras, tick any
order: 63
---
An estimate can offer the customer a choice, like Repair or Replace. The customer picks one on the acceptance page before they sign.

The choice can also be Good, Better or Best. The estimate can also offer **add-ons**, like a softener or two hose bibs. Add-ons ride along with whatever they choose. They tick as many as they want. It is one quote number, one link, one signature. Only the scope they approve becomes the job.

## Build the options

On a draft estimate, you press {{button:outline|＋ Option}} above the Line items. The first press turns your current estimate into **two options**. Your current line items become Option 1, marked {{chip:yellow|★ Recommended}}. Option 2 starts as an editable copy. You press {{button:outline|＋ Option}} again for more. Six is the ceiling. Past that a customer stops choosing.

- **The cards are the options.** Each card shows the option's name, its running total, and how many line items it holds. You click a card to edit that option. The Line items editor below always edits the card that says *editing*.
- **Name and pitch**: the fields under the cards name the option, like "Replace 50-gal". They give the one-line pitch the customer reads under it. A pitch reads like "New 50-gallon gas heater, code-current install, 6-yr warranty". Sell it here. This is your word on the page.
- {{button:gray|★ Recommended}} marks the option the customer page pre-selects. It is also the one whose total the office sees on the Pipeline until the customer decides. Exactly one option carries the star.
- {{button:gray|Remove option}} deletes the option you are editing. Removing down to one puts the estimate back to a normal single price.

:::example Repair or replace
A 9-year-old water heater fails. Option 1 "Repair" — new gas valve and anode, $1,850. Option 2 "Replace 50-gal" ★ — new unit, code kit, permit, $3,400. Option 3 "Tankless upgrade" — $6,150. You recommend the replacement; the customer sees all three and decides.
:::

## Choices and add-ons

Every option is offered one of two ways. You set it with the {{chip:gray|Offered as}} switch under the option's name:

- {{button:blue|One of the choices}} means the customer picks **exactly one** of these. Repair or Replace. The {{chip:yellow|★ Recommended}} one is pre-selected. This is how every option starts.
- {{button:outline|An add-on}} rides along with whichever choice they make. They **tick any**. The card wears a blue {{chip:blue|Add-on}} badge. Its price shows with a **+**.
- {{button:outline|✓ Start ticked}} sits beside an add-on you recommend. That add-on starts ticked on the customer page, with a {{chip:yellow|Recommended}} badge. The customer can untick it before they approve. The approval keeps only what is still ticked.

You make **every** option an add-on when there is nothing to choose between. Five separate scopes on one estimate, say. Then the customer page simply asks them to pick what they want done. At least one tick is needed before they can approve. The star cannot sit on an add-on while the estimate has a choice. Add-ons are never pre-selected. On an all-add-on estimate the star marks the one whose total the office sees until the customer decides.

:::example The heater, plus extras
Option 1 "Repair" and Option 2 "Replace 50-gal" ★ are **choices**. Option 3 "Water softener" ($1,950) and Option 4 "Hose bibs (2)" ($390) are **add-ons**. The customer picks Replace, ticks both add-ons, and approves *"Replace 50-gal" + 2 add-ons — $5,740*. All three options' lines become the job.
:::

## What the customer sees

You open **Customer experience → Page** before you send. Or you open **Preview as customer** for the full-page rehearsal. The customer gets your options as cards. Each card shows the name, the pitch and the price. A *What's included* line-item breakdown is one tap away. Choices sit under **Choose one**, with the recommended one pre-selected and badged. Add-ons sit under ***Add to it · tick any***. Every tap swaps the document and total below. The Approve button names the whole selection. It reads *Approve "Replace 50-gal" — $3,400.00*, or *Approve "Replace 50-gal" + 2 add-ons — $5,740.00*. Their signature applies to everything they picked. The estimate email lists every option's price in a small table. Choices come first, and add-ons sit under them with a **+**. Your recommendation is marked. The subject carries its total. When they accept, the estimate locks to what they picked. The accepted document shows each option's lines under its own heading. The job you create from it, and the totals everywhere, show exactly that.

## While it's their move

Until acceptance, the estimate's total on the Pipeline and the Estimates list is the **recommended option's** total. That is the number you would forecast. Add-ons are upside, not forecast. A small *· 3 options* mark sits beside it. It may read *· 4 options · 2 add-ons* instead. The estimate's **Customer activity** shows their deliberation as it happens. It reads *Viewed option — Tankless upgrade* each time they look. When they decide, the acceptance record says what they took of what was offered. It reads *Accepted "Replace 50-gal" + 2 add-ons · $5,740.00 (of 4 offered)*. Each add-on and each passed-on option is listed for the record.
