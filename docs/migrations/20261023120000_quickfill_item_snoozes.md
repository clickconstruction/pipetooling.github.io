# 20261023120000_quickfill_item_snoozes.sql (2026-10-23, v2.5764)

Adds `public.quickfill_item_snoozes (kind, item_key, until, snoozed_by, created_at)`, primary key `(kind, item_key)`: the office-shared **Dismiss for one week** rows behind Quickfill's new **Percent complete** station (`kind = 'percent-complete'`, `item_key` = the `jobs_ledger` id). Any later station that needs a dismissal reuses the table with its own `kind`. RLS is the section marks' gate, `is_dev_or_master_or_assistant()`, for select / insert / update / delete; `authenticated` gets the four grants. The three house calls close it (read-only training mode, the statement trigger, the twin fence).

Apply order: the client ships first and reads the table fail-soft — with no table the station still lists and saves, and a press on **Dismiss for one week** says the dismissal is not ready yet — so `supabase db push` after the merge from a main checkout, then the types PR (`src/types/database.ts` regen + `node scripts/build-dev-mcp-catalog.mjs`). Nothing sweeps spent rows: the read ignores `until <= now()`.

**Applied** to prod by 2026-10-24: `npm run check:migration-drift` read 973 local files and 973 remote versions, fully applied (read in the docs pass after #6113).
