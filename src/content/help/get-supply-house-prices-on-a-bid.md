---
title: get supply house prices on a bid
category: Bids & Estimating
roles: dev, estimator, master_technician, assistant
keywords: supply house, quotes, vendor prices, compare quotes, plug in a quote, paste quote, rfq, price request, ferguson, moore supply, parts pricing, best price, quote comparison
---

Getting parts priced used to mean texting a list, getting prices back in three different shapes, and retyping them into a spreadsheet. Now the whole loop lives on **Bids → Pricing**: send the list, get the reply in whatever form the vendor likes, and compare houses part by part. Your sale prices never leave the building — vendors only ever see names and counts.

{{gif:get-supply-house-prices-on-a-bid.gif|Plug in a quote: paste the vendor's reply, Match to fixtures, save — then compare by Division 22 section and tap a price to pick it}}

## Step 1 — Send the list

Open the {{button:green|▾}} menu beside Share and pick **Supply house list**. Scope it to what that vendor actually prices ({{chip:blue|Whole job}}, {{chip:blue|Pipe &amp; fittings}}, or hand-picked rows), then either:

- **{{button:green|Copy}}** — paste it into a text or email like always, or
- **{{button:blue|Copy with quote link}}** — the same paste, ending with a link where the vendor types prices straight in. See *send a supply house a quote link* for that lane.

When you pick a house for the link, a line tells you what they've quoted before — "Ferguson has last-quoted prices for 9 of these 83 items · newest today" — handy for choosing who to ask.

## Step 2 — Get the reply in, any shape

If the vendor used the quote link, you're done — their quote is already on the bid. If they texted, emailed, or called:

1. Open the same {{button:green|▾}} menu and pick **Plug in a quote**. You can also **drop the vendor's file** — .xlsx, .csv, or .pdf — straight onto it: the extracted text lands in the paste box for you to see (spreadsheets with an "Ext Price" column are handled safely — only unit prices survive), and matching runs like always. Scanned image PDFs get a straight answer: copy/paste for now.
2. Pick the supply house, the rep if you want, and the **good until** date from the quote.
3. Paste the reply exactly as it came — "4" cast iron 18.90/ft", "$368/box of 50", "wc carriers no stock til Oct" — and tap {{button:blue|Match to fixtures}}.
4. Each line lands on the part it names, with the original text beside it: a green ✓ matched cleanly, a **?** wants a look. "No stock" phrasing marks **can't supply** automatically; box and per-foot pricing is converted to $/each so every house compares in the same units. Fix anything with the dropdowns, drop a line with the ×, or add lines by hand.
5. {{button:green|Save quote → compare}}. The raw paste stays with the quote, so you can always see what the vendor actually said.

:::example A phone-call quote
The Ferguson rep reads prices over the phone. Wendi types them as rough lines in the paste box — "4 inch cast iron 18.90 a foot", "floor drains 148" — hits Match, confirms two guesses, and saves. Thirty seconds, structured quote.
:::

## Step 3 — Compare and pick

Once any quote is saved, a {{chip:blue|Quotes (1)}} chip sits beside Share — it turns **green** when a quote link comes back. Open it:

- Parts run down the left, **grouped by Division 22 section**, one column per supply house. The best live price wears a ★.
- **Tap a price to pick it** for that part — split the order across houses line by line. The picked total at the bottom recomputes at today's counts, and picks are saved for a future PO handoff.
- A **Last quoted** column shows what each house said the last time anyone asked about that part name, on any bid — a high number smells wrong before you commit.

## The honesty rules

The comparison won't quietly mislead you:

- A quote past its **good until** date goes gray and crossed out and loses its ★ — and if it expires **before your needed-by date**, an amber warning says so up top.
- Coverage rides each house's chip ("9 of 14 lines"), and the house totals only count **lines every house priced** — no house wins just by skipping the expensive parts.
- If a vendor re-quotes, the newest quote is what you see; older ones stay as history.

:::example Two houses, one order
Wendi plugs in Ferguson's texted reply, then Moore Supply's link quote comes back green. Ferguson's better on cast iron, Moore on copper. She taps her picks line by line and the picked total shows what the split order costs at today's counts.
:::
