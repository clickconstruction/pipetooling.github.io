---
title: see where someone stands and share a pay statement
category: Office
roles: dev, master_technician, assistant, controller
keywords: payments made, payments list, sort payments, pay run payments, payment method, how it was sent, cash app, mercury, apple pay, offsets, balance, settle up, backcharge, damage, credit, ledger, pay statement, payments, unpaid, unreported, jobs worked, share
---

**People → Offsets** opens with the **Settle up** table. The table has one row per person, with the whole pay picture priced into columns.

The columns are these:

- **Unpaid reports** is what's still owed on pay reports: gross minus recorded payments.
- **No report yet** is weeks of approved hours that never became a pay report. Those weeks are priced at the person's hourly wage, like *3 wk · 79.16 h · ~$1,187*.
- **Credits** and **Charges** are pending offsets, split by direction. An offset is an amount added to pay or taken off it.
- **Settle up** is the answer. Settle up totals everything above into one figure, with charges taken off: {{chip:green|pay $1,499.82}} or {{chip:red|owes $3,082.49}}.

Everything is **all-time**, so old charges can't hide behind a date filter. Rows needing the most attention sort first. Settled people sink to the bottom. A `*` means the person has unreported hours but no wage on file. So those hours aren't priced in. Archived people fold into a collapsed **Archived users** section below the table. Archived people are out of the way, but their balances don't vanish. The raw offset entry list lives under a collapsed **All offset entries** toggle at the bottom. The list has every backcharge, damage and credit, with its edit, apply and delete actions. Searching opens it automatically.

## The person ledger

You click any row. The ledger leads with the equation in plain words:

:::example The settle-up banner
Unpaid reports $620.06 + unreported ~$2,914.95 + credits $0.00 − charges $6,617.50 = **Tristen owes the company $3,082.49**
:::

Below it, **Needs action** lists every open item with its verb:

- {{chip:yellow|Unpaid}} reports → {{button:outline|Record payment}}, which jumps to Payroll.
- {{chip:red|No report}} weeks → {{button:outline|Draft reports}}
- {{chip:red|Charge}} offsets → {{button:outline|Apply to report}}, which opens the apply dialog.
- {{chip:green|Credit}} offsets are counted toward the next payment automatically.

**History** folds away until you want it. History has one block per week. Each block shows the report, each recorded payment with its date and memo, and any offsets from that week. So a report and its companion weekly credit read as one story with one status. The status is {{chip:green|paid}} or {{chip:yellow|$840.00 still owed}}. **Jobs worked** folds too. Jobs worked shows hours and billing credit per job, with its own date range. The billing credit is attributed the same way as on Crew P&L.

## See every payment made

The Payroll tab's **Payments** pill sits beside *Pay run* and *Balances*. Payments lists one row per payment made, across everyone. The columns are {{chip:gray|Paid on}}, Person, *Period (w#)*, Amount, **Method**, Memo, and who recorded it and when. Each row has a **Stub** link to the pay report it paid.

Every column header sorts. You click it again to flip the order. The arrow says which way. The choice is remembered on your device.

The window chips set how far back the list reads. The chips are {{chip:blue|90 d}} by default, {{chip:gray|30 d}}, {{chip:gray|This year}} and {{chip:gray|All}}. The name box also matches memo text, so a Cash App transfer id finds its row. The total under the table is what is showing.

**Method** is how the money went out: {{chip:green|Cash App}}, {{chip:green|Mercury}}, {{chip:green|Apple Pay}}, {{chip:green|Client direct}} or {{chip:green|Other}}. The method is the pick made on **Record payment** when the payment was recorded. A second row of chips filters to one method, with the count each would keep. The second row can also filter to **No method**.

Some payments were recorded before methods were kept. Such a payment wears a dashed chip when its memo's first words say the method, like *Cash App #D-…* or *Mercury*. The payment wears nothing when its memo does not say the method. The memo is still there to read.

Beside the window chips, ***Flat · By week paid · By person*** choose the layout. *By week paid* opens a tinted band for every company week the money went out. A week runs Sunday to Saturday and is labelled like a pay period: *9/13–19 w38 · 3 payments · $491.55 · 3 people*. *By person* opens one band per person, with their payments and the weeks they were paid in. Inside a band, the rows keep the sort you chose. The layout is remembered on your device.

Nothing is recorded on this view. Record payment stays on the Pay run row and on Balances. One send can pay more than one week. Then each row's memo ends *· 1 of 2 from $1,067.23*. The ending shows the row's part and the whole send. So a $600.06 row is never mistaken for the whole payment.

## Sharing a pay statement

{{button:outline|Pay statement}} builds a printable statement of every recorded payment. The statement shows each payment's paid date and amount, and the period's job hours that earned it. The statement also shows the offsets applied to that report, like *Less: windshield damage*. The statement shows **hours and job names only**, never company revenue. So the statement is safe to hand to the person. You print or save as PDF from the dialog.
