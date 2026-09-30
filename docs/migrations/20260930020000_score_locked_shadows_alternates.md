# 20260930020000_score_locked_shadows_alternates.sql (2026-09-30, alternates round two PR 5)

`CREATE OR REPLACE FUNCTION public.score_locked_shadows(uuid)` — the shadow scorer's sent reference becomes the **whole** bid: `bids.bid_value` (the base since v2.4195) plus every offered alternate's stamped add-on, summed in SQL from `cover_letter_alt_texts->'groups'` (`amount` where `offered` is not `'false'`, numeric and above zero). The best-effort branch (`bid_best_efforts.value`, preferred) is untouched: from v2.4199 the card records the whole. Mirrors `supabase/functions/_shared/referenceWhole.ts`, which twin-mcp's `score_shadows` / `score_backtest` and the client's Robot Board use. Body otherwise verbatim from `20260910210000_bid_best_efforts.sql`, the live definition. No table change, no new policy.

Apply order: client (v2.4199) first, then this migration, then `supabase functions deploy twin-mcp`.
