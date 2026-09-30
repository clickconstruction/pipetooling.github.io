---
title: see where money flows
category: Billing & Money
roles: dev, master_technician, controller
keywords: banking, mercury, visuals, sankey, money flow, transfers, accounts, card spend, diagram
---
Open Banking, then Mercury, then Visuals. The page draws your money as rivers, so the wider the band, the more dollars moved.

Three views answer three different questions. The buttons at the top switch the view and the time window. The time buttons are {{button:outline|This month}}, {{button:outline|Quarter}}, {{button:blue|YTD}} and {{button:outline|All time}}.

Want a specific stretch instead? The **Zoom** chips at the end of the period row list your years. Pick one. Then tap {{button:outline|Full year}}, or one of {{button:outline|Q1}} through {{button:outline|Q4}}. Every view redraws to exactly that window. The dates are spelled out beside the chips. Quarters that have not started yet are grayed out. The zoomed window is part of the page address. So a bookmark or shared link opens straight to "Q2 2025".

Hover any band or bar to see the exact dollar amount. **Click a band** to open the transactions behind it. The list shows the date, the counterparty, the account and the amount. The counterparty is the other side of the payment. The count and total sit up top.

**Click a transaction in that list to open it.** The left side is the bank's record. It shows the posted time, the card, the bank description, the memo and the raw detail. It also has an *Open in Mercury* link. The left side is read-only. The right side is your books, and you can edit it. Change the **accounting label**. Pick the **person** in its own field. If a rule tagged them, it says so. Edit the **job splits**. That is the same Link-to-person-and-jobs window used everywhere else. It always shows the transaction's current splits and person, read fresh when it opens. It will not save over a change someone else made while you had it open. Or add a **note**. The moment you save, the rivers behind the window redraw. Label a stray purchase and you see the dollars slide from the gray Unlabeled band into the right category.

**Tip**: accounting rules can tag people for you. When you edit a rule on the Accounting tab, set **Also attribute to person**. Every approved match then carries that person on its own. It never overwrites one you set by hand. Saving the rule also offers to **tag the transactions it already sorted**. So the history catches up in one click. Skip it, and re-saving the rule offers again. The person may not be on your roster yet. Just type their name. The picker offers **Add … to People as a sub** and selects them for you.

**Tag people while you sort**: the Accounting tab's Sorting Ledger shows **Accounting Label | Person** in one column. The {{button:outline|+}} on an unlabeled row sets both at once. On a computer the popup shows the label list and a person picker side by side. Pick both, then tap **Save**. On a phone the person picker sits above the list. Tapping a label saves both in one go. Leave it on *no person* and it works exactly like before. A labeled row that is missing its person shows a quiet **| add person** link. Tap it to tag the person without touching the label.

## Where the money goes

This is the profit-and-loss as a picture. Money in is on the left. It fans out through the expense families. Those are People, Job costs, Vehicles and Overhead. They lead to the same accounting labels you maintain in Drag Sort.

**Go a layer deeper**: click any family or label **bar**. The cursor becomes a magnifier. The chart zooms into just that slice, with one band per payee. A payee is the person or company you paid. So Contract Labor becomes the actual people you paid, biggest first. Cash App payments show the person named in the bank record, not "Cash App". {{button:outline|‹ All flows}} or Esc zooms back out. Payee bands click through to their transactions like everywhere else.

- **Income** is everything labeled Income. **Other money in** is deposits that carry any other label, or none yet.
- Sometimes the period's spending is bigger than the period's money in. Then a gray **From reserves** band appears on its own. The diagram never hides a gap.
- When money in is bigger than spending, a **Kept → Still in the bank** band shows what stayed.
- An **Unlabeled** band means transactions nobody has sorted yet. Label them in Drag Sort and this view sharpens on its own.

:::example Reading the widths
If the Contract Labor band is twice as wide as Wages, you paid subs twice what you paid employees in that window — no report needed.
:::

## Between accounts

This is the whole route your money takes. Deposits enter on the far left. Those are check deposits, wires and card refunds. They land in an account. Money moves between accounts in the middle. It leaves on the far right as card spend, payments and external transfers. Each account keeps one color everywhere. A band that flows straight across an account is money that left the same account it landed in.

Two gray bands keep the picture honest. **From balances** is spending or transfers funded by money already in an account before the period started. **Kept in accounts** is money that arrived and stayed. A small **Unmatched transfer legs** band appears when a transfer's other half posted outside the selected window.

## Cards → jobs

Card spend by person is on the left. It flows into the jobs it was split to on the right. The amber {{chip:yellow|⚠ No job yet}} band is spend not yet split to any job. Those are the same purchases the Dashboard's "Purchases waiting to be sorted" card nags about. So a wide amber band tells you whose purchases need sorting. Sort them before it costs you at billing time.

Duplicates are excluded everywhere. Internal transfers never count as spending. The pictures match your books.
