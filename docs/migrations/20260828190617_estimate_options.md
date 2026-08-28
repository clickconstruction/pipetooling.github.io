# 20260828190617 — estimate options columns (2026-08-28)

Estimate Options (v2.2457, Phase 1): adds two nullable columns to `estimates`.

- `options_snapshot jsonb` — `[{ key, name, description, recommended, line_items }]`;
  null/absent = single-option estimate (zero behavior change for existing rows).
- `accepted_option_key text` — stamped at acceptance (Phase 2); acceptance also freezes the
  chosen option's lines into `line_items_snapshot` + `total_cents`, which is what keeps every
  downstream reader working unchanged. Pre-accept, the legacy fields mirror the RECOMMENDED
  option (owner decision).

Additive + idempotent; no new table → no read-only RLS re-appliers. Applied with
`supabase db push` per house rules.
