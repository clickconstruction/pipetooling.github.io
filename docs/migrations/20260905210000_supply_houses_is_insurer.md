# 20260905210000_supply_houses_is_insurer.sql (2026-09-05, v2.2893)

Adds `public.supply_houses.is_insurer boolean NOT NULL DEFAULT false` (idempotent `ADD COLUMN IF NOT EXISTS`) with a column comment. Journey-map Tier-2 #19 / J34-N2: the `supply_houses` roster doubles as the vendor ledger ("Texas Mutual (Workers Comp)", "Sunbelt Rentals", "Outside Subcontractors", "Amazon"), so the RFQ "pick the supply house…" list offered a quote link to a workers-comp insurer.

- **Writer:** the supply-house card's new **Quotes** checkbox ("Not a supplier we quote from") in `SupplyHouseForm.tsx`, saved by both hosts (Materials → Supply Houses tab, Materials page form). Nothing is seeded — the office tags the insurers.
- **Readers:** `src/lib/supplyHousePickerRows.ts` (`is_insurer = false`) for `RfqComposeModal`, `PlugInQuotesModal`, `PrepareFixtureCopyModal`. Everything else (Materials lists, POs, bills, backup exports) still sees every row.
- **Apply order:** client first is fine — the pickers fall back to the unfiltered roster while the column is missing. Until the migration lands, **saving a supply house from the card fails** with "column is_insurer does not exist" (the form always writes the flag), so push promptly after the client deploys.
- No RLS change: the column rides the existing `supply_houses` policies; no new table, so the read-only write-block helpers are not re-applied.
