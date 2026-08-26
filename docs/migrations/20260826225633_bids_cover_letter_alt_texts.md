# 20260826225633_bids_cover_letter_alt_texts.sql (2026-08-26, v2.2370)

Adds `bids.cover_letter_alt_texts jsonb` (nullable, additive) — the customer-facing wording for
the cover letter's same-page Alternates block, edited by clicking the dashed text on the Cover
Letter preview.

Shape:

```json
{
  "heading": "Alternates — priced in lieu of the proposal above:",
  "sections": {
    "<bid_version_id>": { "label": "Alternate 1 — PEX in lieu of copper", "note": "Same scope as below." },
    "<bid_version_id>:<offered_pricing_id>": { "label": "…" }
  }
}
```

Null / missing keys = automatic wording (the version · price-option names). Parsed defensively by
`parseCoverLetterAltTexts` in `src/lib/bids/coverLetterSamePage.ts`; junk shapes read as empty.
No RLS changes — existing `bids` policies cover the column.
