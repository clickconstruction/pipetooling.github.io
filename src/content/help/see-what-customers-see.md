---
title: see what customers see
category: Office
roles: dev
keywords: what customers see, customer view, sample customer, estimate email preview, bid room preview, journeys, settings, customer experience, sample data
order: 65
---
**Settings → What customers see** shows every email and page a customer or general contractor gets, rendered live with sample data, in the order they meet them. Use it after you change a Setting — the estimate copy, the public terms, the footer, the bid cover-letter defaults — to see every surface follow.

## Read the strips

Each strip is one audience. Each step names what sends it (*Estimates → Send to customer*), when it happens (*Day 0*), and which Settings it reflects.

:::example The homeowner's strip
{{chip:gray|Estimate email}} → {{chip:gray|Accept page}} → {{chip:gray|Thank-you}} → {{chip:gray|Bill email}} → {{chip:gray|Portal}}
:::

- A step with a small picture is **live**: the real page, or the real email, at phone width.
- **Sent by another system** means it is not built by this app (the bill email comes from Stripe).
- **Next release** marks a surface this view does not render yet.

## Open a step large

1. Tap a step. It opens below its strip.
2. Switch {{button:outline|Phone}} / {{button:outline|Desktop}} in the toolbar to see it at either width.
3. {{button:outline|Open in new tab}} opens a page on its own; emails show their plain-text part underneath.

Pages open with a **sample token** and carry an orange *Sample* strip. You can click through them — pick an option, sign, decline — and nothing is saved. The sample customer is **Sam Sample**, the sample bid is **Cedar Bend Apartments** for **Sample Contracting**; neither exists in the database.

## After a Settings change

Press {{button:outline|Refresh all}}. The tab re-reads Settings and reloads every frame.
