# 20260905220000_search_rpcs_escape_and_numeric_order.sql (2026-09-05, v2.2902)

Journey-map Tier-3 B19 (C68; J28-F1 / J28-N1). `CREATE OR REPLACE` of the three header-search RPCs plus one new helper; no table, no RLS, no signature change, so `src/types/database.ts` is untouched and the client needs no coordinated change.

- **New `public.escape_like_pattern(text)`** — `IMMUTABLE STRICT PARALLEL SAFE`, `search_path = ''`, EXECUTE to `anon` / `authenticated` / `service_role`. Escape rule (LIKE's default ESCAPE is the backslash): `\` → `\\`, `%` → `\%`, `_` → `\_`. Apply it to user text (and to the remainder after a prefix strip), never to the prefix comparison.
- **`search_jobs_ledger(text)`** — SECURITY DEFINER, same RETURNS shape (incl. `click_number`). Every `ILIKE '%' || … || '%'` now uses the escaped text; the `J` strip and `ledger_job_prefix` strip escape their remainder; the prefix test is a literal `lower(left(text, n)) = lower(prefix)`. ORDER BY: rows with a number first, then `substring(effective_number from '[0-9]+')::numeric DESC NULLS LAST`, then text DESC — so `1004` ranks above `999` and the newest jobs are the last to fall off `LIMIT 50`.
- **`search_bids_for_clock(text, uuid, uuid[])`** — SECURITY DEFINER; escaped patterns for `bid_number`, the `B` / `ledger_bid_prefix` strips, `project_name`, `address`, customer and GC-builder names. `ORDER BY project_name` unchanged.
- **`search_estimates_for_nav(text)`** — SECURITY INVOKER (RLS enforced); escaped patterns for `estimate_number::text`, the `E` strip, `title`, `customer_email`, `for_address`, customer name/address. `ORDER BY updated_at DESC` unchanged.
- Comments on all four functions name the escape rule; grants re-issued identically (`GRANT ALL … TO anon, authenticated, service_role`).
- **Apply order:** client first or migration first — either is fine. Before the push, search behaves exactly as before.
- **Validation:** applied twice on a throwaway local Postgres 15 with a mock schema (idempotent); literal `%` / `_` / `\` matching, prefix strips, numeric order, security modes and EXECUTE privileges all checked.
