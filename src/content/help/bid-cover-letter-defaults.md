---
title: change the default bid cover letter text
category: Office
roles: dev
keywords: cover letter, bids, terms, exclusions, closing, defaults, wording
order: 70
---
Every bid cover letter is assembled from a few standard text blocks. Three of them are org-editable — change them once and every future letter uses the new wording.

## Where to edit

**Settings → Templates & testing → Bid Cover Letter Defaults (dev)**:

:::example The three editable blocks
**Terms & warranty** — the long paragraph, used when a bid's own Terms box is empty

**Exclusions** — one exclusion per line, used when a bid's Exclusions box is empty

**Closing paragraph** — the sentences before "Respectfully submitted…", on every letter

{{button:blue|Save}}
:::

Leave a box **blank** to keep the built-in wording (it's shown as the placeholder, so you can copy it out, tweak a sentence, and save).

## How the defaults interact with a bid

- On the **Cover Letter tab** of a bid, the Inclusions / Exclusions / Terms boxes are per-bid. Anything typed there wins for that bid.
- When a bid's Terms or Exclusions box is empty, the letter falls back to your org default from Settings — and only if that's blank too, the built-in text.
- The **closing paragraph** isn't per-bid: it comes from Settings (or the built-in) on every letter, followed always by "Respectfully submitted by Click Plumbing and Electrical".

## Tips

- One line per sentence in the closing paragraph — each line renders on its own line.
- Changes apply to letters generated after saving; documents you already copied out are unaffected.
