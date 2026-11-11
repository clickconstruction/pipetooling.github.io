# 20261111043500_permit_hint_both_decks.sql (2026-11-10, v2.6917)

Permits: the hint beside a name sees a lead on either calling deck (punch list #302, call 4; `to-dos/permit-skim/`).

## What it does

Replaces **`research_contact_history(p_keys text[])`** (SQL, STABLE, SECURITY INVOKER), same signature and columns. `on_deck` was true only for an open `gc_lead` prospect of that name. Since v2.6907 a pursued general contractor's lead lands on the Customers deck, so `on_deck` is now true for an open prospect of kind `gc_lead` or `customer`. A sub, and a lead with a `prospect_fit_status`, still do not count.

The deck's names are keyed once per call (`deck_names`) and joined to the names asked. The earlier body keyed every open lead again for each name asked, which was fine on the short Jobs to GC deck and would not be on the Customers deck.

The bids, the wins and the last bid day read as before. The reader's own RLS applies on every table.

No CREATE TABLE, so the four fence appliers are not run.

## Bed

`npm run test:pg:permit-hint-decks` (`scripts/pgtest-permit-hint-decks.sh`, `supabase/tests/permit_hint_decks/`): a lead on each deck is on the deck; a sub, a lead that left the queue and an unknown name are not; the bids read as before; one row per distinct name; the office reads the same answer under RLS; the migration applied twice changes nothing.

## Release order

Merge the PR, `supabase db push`. Nothing to deploy. The client reads the same columns, so either order is safe.
