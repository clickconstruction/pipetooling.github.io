---
title: bid one project to multiple GCs
category: Office
roles: dev
keywords: bids, versions, GC, builder, cover letter, multiple GCs, packets, pricing
order: 71
---
When several general contractors are chasing the same project, you can price and send the same bid to each of them without rebuilding it — each GC gets their own cover letter document with only their own pricing.

## Point a Version at a GC

1. On the bid's **Pricing** (or Takeoff / Cover Letter) page, find the **Version** chips.
2. Click the ✎ on a version. Under the name you'll see **GC/Builder (customer) for this version**.
3. Pick the GC this version is priced for, or leave it on **Use bid default** to keep the GC from the bid itself.

:::example Chips show where each version points
Once any version has its own GC, every chip shows a small tag — {{chip:blue|GC: Turner Const.}} on overridden versions, and *GC: bid default* on the rest — so nothing is ambiguous.
:::

Typical setup: one version per GC (e.g. "Turner" and "DPR"), each with its own pricing. Use **+ New version** with *copy current pricing* checked, then adjust margins per GC.

## Generate the documents

1. On the **Cover Letter** page, tick the versions to include under **Versions in this submission**.
2. When the included versions point at more than one GC, a **Documents by GC** box appears — one card per GC, showing which versions land in that GC's document.
3. Click a card to select it: the preview, {{button:blue|Print}}, and copy buttons all follow the selected GC.

Each GC's document contains **only that GC's versions and pricing**, headed with their name and address. Documents never mix GCs, so one builder can't see what another was quoted.

## Tips

- A version left on **Use bid default** still generates — grouped under the bid's own GC.
- Single-GC bids are unaffected: with no overrides there's no Documents by GC box and everything works as before.
- Outside the bundle, the single letter always follows the **active Version chip**: switch the Version and the letterhead, amount, and fixtures all switch together. When the letter is headed for someone other than the bid's own GC, a *· for {{chip:blue|GC name}}* tag appears next to **Combined document** so the mismatch with the Customer block up top explains itself.
