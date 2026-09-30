---
title: change the default bid cover letter text
category: Office
roles: dev
keywords: cover letter, bids, terms, exclusions, closing, defaults, wording
order: 70
---
Every bid cover letter is built from a few standard text blocks. Three of them are org-editable, so you change them once and every future letter uses the new wording.

## Where to edit

Open **Settings → Bids & materials → Bid Cover Letter Defaults**. The section is marked dev. You see three boxes:

:::example The three editable blocks
**Terms & warranty** — the long paragraph, used when a bid's own Terms box is empty

**Exclusions** — one exclusion per line, used when a bid's Exclusions box is empty

**Closing paragraph** — the sentences before "Respectfully submitted…", on every letter

{{button:blue|Save}}
:::

Leave a box **blank** to keep the built-in wording. The built-in wording is shown as the placeholder. So you can copy it out, tweak a sentence, and save.

## How the defaults interact with a bid

- On the **Cover Letter tab** of a bid, the Inclusions, Exclusions and Terms boxes are per-bid. Anything typed there wins for that bid.
- When a bid's Terms or Exclusions box is empty, the letter falls back to your org default from Settings. Only if that is blank too does it use the built-in text.
- The **closing paragraph** is not per-bid. It comes from Settings, or from the built-in, on every letter. It is always followed by "Respectfully submitted by Click Plumbing and Electrical".

## Tips

- Put one sentence per line in the closing paragraph. Each line renders on its own line.
- Changes apply to letters generated after saving. Documents you already copied out are unaffected.
