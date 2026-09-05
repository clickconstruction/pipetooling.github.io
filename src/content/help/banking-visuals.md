---
title: see where money flows
category: Billing & Money
roles: assistant, controller, master_technician
keywords: banking, mercury, visuals, sankey, money flow, transfers, accounts, card spend, diagram
---
Banking → Mercury → **Visuals** draws your money as rivers: the wider the band, the more dollars moved. Three views answer three different questions, and the buttons at the top switch the view and the time window ({{button:outline|This month}} · {{button:outline|Quarter}} · {{button:blue|YTD}} · {{button:outline|All time}}).

Want a specific stretch instead? The **Zoom** chips at the end of the period row list your years — pick one, then {{button:outline|Full year}} or {{button:outline|Q1}}–{{button:outline|Q4}}, and every view redraws to exactly that window, with the dates spelled out beside the chips. Quarters that haven't started yet are grayed out, and the zoomed window is part of the page address, so a bookmark or shared link opens straight to "Q2 2025".

Hover any band or bar to see the exact dollar amount — and **click a band** to open the transactions behind it: a list with date, counterparty, account, and amount, plus the count and total up top.

**Click a transaction in that list to open it.** The left side is the bank's record — posted time, card, bank description, memo, the raw detail, and an *Open in Mercury* link — and it's read-only. The right side is your books, and it's editable: change the **accounting label**, pick the **person** (its own field — and if a rule tagged them, it says so), edit the **job splits** (the same Link-to-person-and-jobs window used everywhere else — it always shows the transaction's current splits and person, read fresh when it opens, and it won't save over a change someone else made while you had it open), or add a **note**. The moment you save, the rivers behind the window redraw — label a stray purchase and you'll see the dollars slide from the gray Unlabeled band into the right category.

**Tip**: accounting rules can tag people for you. When you edit a rule on the Accounting tab, set **Also attribute to person** — every approved match then carries that person automatically, and it never overwrites one you set by hand. Saving the rule also offers to **tag the transactions it already sorted**, so the history catches up in one click (skip it, and re-saving the rule offers again). And if the person isn't on your roster yet, just type their name — the picker offers **Add … to People as a sub** and selects them for you.

**Tag people while you sort**: the Accounting tab's Sorting Ledger shows **Accounting Label | Person** in one column, and the {{button:outline|+}} on an unlabeled row sets both at once. On a computer the popup shows the label list and a person picker side by side — pick both, then **Save**. On a phone the person picker sits above the list, and tapping a label saves both in one go (leave it on *no person* and it works exactly like before). A labeled row that's missing its person shows a quiet **| add person** link — tap it to tag the person without touching the label.

## Where the money goes

The profit-and-loss as a picture: money in on the left, fanning out through expense families (People, Job costs, Vehicles, Overhead) to the same accounting labels you maintain in Drag Sort.

**Go a layer deeper**: click any family or label **bar** (the cursor becomes a magnifier) and the chart zooms into just that slice — one band per payee, so Contract Labor becomes the actual people you paid, biggest first. Cash App payments show the person named in the bank record, not "Cash App". {{button:outline|‹ All flows}} (or Esc) zooms back out, and payee bands click through to their transactions like everywhere else.

- **Income** is everything labeled Income; **Other money in** is deposits that carry any other label (or none yet).
- A gray **From reserves** band appears automatically when the period's spending is bigger than the period's money in — the diagram never hides a gap.
- When money in is bigger than spending, a **Kept → Still in the bank** band shows what stayed.
- An **Unlabeled** band means transactions nobody has sorted yet — label them in Drag Sort and this view sharpens on its own.

:::example Reading the widths
If the Contract Labor band is twice as wide as Wages, you paid subs twice what you paid employees in that window — no report needed.
:::

## Between accounts

The whole route your money takes. Deposits enter on the far left (check deposits, wires, card refunds), land in an account, move between accounts in the middle, and leave on the far right as card spend, payments, and external transfers. Each account keeps one color everywhere, and a band that flows straight across an account is money that left the same account it landed in.

Two gray bands keep the picture honest: **From balances** is spending or transfers funded by money already in an account before the period started, and **Kept in accounts** is money that arrived and stayed. A small **Unmatched transfer legs** band appears when a transfer's other half posted outside the selected window.

## Cards → jobs

Card spend by person on the left, flowing into the jobs it was split to on the right. The amber {{chip:yellow|⚠ No job yet}} band is spend not yet split to any job — the same purchases the Dashboard's "Purchases waiting to be sorted" card nags about, so a wide amber band tells you whose purchases need sorting before it costs you at billing time.

Duplicates are excluded everywhere, and internal transfers never count as spending — the pictures match your books.
