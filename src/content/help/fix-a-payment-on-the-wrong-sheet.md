---
title: fix a payment on the wrong sheet
category: Billing & Money
roles: dev, master_technician, assistant, superintendent
keywords: wrong job, wrong sheet, move payment, remove payment, delete payment, undo, duplicate entry, wrong amount, backcharge, trace line, sub labor, payment
---
A payment on the wrong sub sheet moves to the right one, with nothing retyped. You open the sheet with Edit sheet on Jobs → Subs → Pay, then press Move on the payment.

## Fix a payment that landed on the wrong sheet

Open the sheet with **Edit sheet**. [The expanded row](/help/sub-labor-outstanding#paying-it-down) only lists the payments. Every row in its **Payments** table is two lines. The first has the date, type and amount. The second has the memo beside three buttons: {{button:gray|Edit}}, {{button:outline|Move…}} and {{button:outline|Remove}}. On a phone it is Edit and a **⋯** menu. Nothing is retyped.

- {{button:outline|Move…}} opens **Move this payment**. The same sub's other sheets are listed first. Search finds any other sheet by job number, address or sub. Pick one and a **What changes** panel reads both sheets before and after, like *880: paid $2,000.00 → $0.00, owed $2,200.00 → $4,200.00 · 922: paid $0.00 → $2,000.00, owed $2,000.00 → $0.00 · paid in full*. The amount, date, memo and portal-visibility setting travel with it. Say why, and press {{button:blue|Move $2,000.00 to 922}}. The reason starts as *wrong job*.
- {{button:outline|Remove}} opens **Remove this payment?** with a reason: {{chip:blue|Duplicate entry}}, {{chip:gray|Wrong amount}} or {{chip:gray|Something else}}. The window also has **Wrong job → Move it instead**, which is the door to Move. A removal can be undone for 30 days.
- A backcharge stays on the sheet it was raised on. Its {{button:outline|Move…}} says so on the row and opens nothing. To take one off, use {{button:outline|Remove}}.

A move and a removal both leave a grey **trace line** under the sheet's payments. The line reads like *Moved → 922 Michael Palmer · Taunya · wrong job*, *Moved here from 880 Reliant Health-HVAC* or *Removed · Taunya · Duplicate entry*. So a balance that jumped explains itself. A removed line carries {{button:gray|Undo}} while it can still come back.

:::example The check on the wrong job
Taunya recorded Airfordable's $2,000 check on the 880 sheet; it was for 922. On 880 she presses Move…, picks 922 (top of the list — same sub), reads the panel, and moves it. 880 shows *Moved → 922 · Taunya · wrong job*; 922 shows the payment and *paid in full*.
:::

## More on paying subs

- [See what I still owe each sub contractor](/help/sub-labor-outstanding): the tiles, the ledger, Pay when and paying.
