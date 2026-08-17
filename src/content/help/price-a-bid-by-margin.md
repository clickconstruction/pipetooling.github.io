---
title: price a bid at a target margin
category: Bids & Estimating
roles: dev, estimator, master_technician
keywords: margin, markup, pricing, sale price, apply margin, 50%, price by margin, bulk price, recent margins
---

On Bids → Pricing (Price Model view), the **Price by margin** toolbar sets Sale Prices from your target margin in one click — no calculator, no row-by-row typing.

## Apply a margin

1. Type a margin (1–95) in the box — or tap one of your **recent** chips (your last three margins, most recent first; they follow you from bid to bid on this device).
2. {{button:blue|Apply to all rows}} prices every row that has a Takeoffs cost: each Sale Price becomes cost ÷ (1 − margin), rounded to whole dollars — so the Margin column lands right on your number.

Rows with no Takeoffs cost are skipped (there's nothing to price *from*) — the toast tells you how many.

## Target specific rows

Check the boxes on the rows you want and the button becomes **Apply to N selected rows** — price the big fixtures at 50%, then select just the fittings and hit 40%. Checked rows tint blue; rows without a cost have their checkbox disabled. Clearing every box puts the button back to all-rows mode.

## Margin mode — price row by row without scrolling

Turn on **Margin mode** (the toggle at the right end of the toolbar — it stays on per device) and an **Apply margin** column appears between Revenue and Margin/Total. Each costed row gets your last-used margin as a one-tap chip — tap {{chip:gray|50%}} and that row is priced, right where you're reading it. The **…** opens a small picker with your three recent margins (each previewing the resulting Sale Price, like "45% → $6,472"), plus a custom box — type a percent, see the preview, press Enter or **→**. Row-by-row applies skip the replace-confirm: you're aiming at one row deliberately, and it's one tap to redo.

## Already-priced rows

If any target row already has a Sale Price, a confirmation asks whether to **replace all** of them or **fill only the unpriced rows** — so a stray click can never silently blow away pricing you set by hand.

:::example Two-speed pricing
34 rows, all costed. Type 50, Apply to all rows — done. Then check the four water-heater rows, tap the 45% chip, Replace all 4 — those now carry the tighter margin.
:::

Every price the toolbar writes is a normal custom price: edit any of them by hand afterward, or use the row's **Reset** to fall back to the price book. Margin here means profit ÷ revenue — the same definition as the Margin column and the line breakdown popup.
