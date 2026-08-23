---
title: bid one project to multiple GCs
category: Office
roles: dev
keywords: bids, versions, GC, builder, cover letter, multiple GCs, packets, pricing
order: 71
---
When several general contractors are chasing the same project, you can price and send the same bid to each of them without rebuilding it — each GC gets their own cover letter document with only their own pricing.

## Add a GC

1. On the bid's **Counts / Takeoffs / Pricing / Cover Letter** page, the strip at the top reads **Send to** — one group per GC, each showing whether it was sent and its ★ price.
2. Press {{button:blue|＋ Another GC…}}: pick the GC, choose which packet to **start from** (its counts, takeoff and prices are copied), and optionally name it — it defaults to the GC's name.
3. Inside a GC group, **+ version** adds a same-GC variant with its own takeoff (a VE, say). The ✎ on any version still lets you rename it or point it at a different GC.

:::example Chips show where each version points
Once any version has its own GC, every chip shows a small tag — {{chip:blue|GC: Turner Const.}} on overridden versions, and *GC: bid default* on the rest — so nothing is ambiguous.
:::

Typical setup: one version per GC (e.g. "Turner" and "DPR"), each with its own pricing. Use **+ New version** with *copy current pricing* checked, then adjust margins per GC.

## Generate the documents

1. On the **Cover Letter** page (New), tick the bids to include under **In this cover letter** — each goes in at its ★ price. (On Old, tick price scenarios under *Versions in this submission*.)
2. When the included versions point at more than one GC, a **Documents by GC** box appears — one card per GC, showing which versions land in that GC's document.
3. Click a card to select it: the preview, {{button:blue|Print}}, and copy buttons all follow the selected GC.

Each GC's document contains **only that GC's versions and pricing**, headed with their name and address. Documents never mix GCs, so one builder can't see what another was quoted.

## The bid remembers everyone you sent it to

Open **Edit Bid** and look under the GC/Builder picker: the **Also sent to** row lists every other GC this bid went out to. GCs you point a Version at land here automatically; use {{button:outline|+ Add GC}} to record the rest — the GCs who got the same letter without their own version. The × removes one.

This list is what keeps multi-GC bids honest in follow-up: instead of a made-up "Multiple GC's" customer, the bid keeps its real primary GC and the recipients carry the others — so each real GC can be called for a bid tab.

## Tips

- A version left on **Use bid default** still generates — grouped under the bid's own GC.
- Single-GC bids are unaffected: with no overrides there's no Documents by GC box and everything works as before.
- Outside the bundle, the single letter always follows the **active Version chip**: switch the Version and the letterhead, amount, and fixtures all switch together. When the letter is headed for someone other than the bid's own GC, a *· for {{chip:blue|GC name}}* tag appears next to **Combined document** so the mismatch with the Customer block up top explains itself.
