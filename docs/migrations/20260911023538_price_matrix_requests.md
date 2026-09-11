# 20260911023538_price_matrix_requests.sql (2026-09-10, v2.3263)

Robot price matrix, PR 1 of 5 ([`docs/PRICE_MATRIX_PLAN.md`](../PRICE_MATRIX_PLAN.md)). The quote store learns the shape of a real fixture quote so a pricing twin can write it and the compare can read it.

- `bid_quote_lines`: `component_role text` (check: kit · bowl · seat · flush_valve · carrier · faucet · drain · trap · supply · stops · trim · mixing_valve · accessory · freight · loose — mirrors `COMPONENT_ROLES` in `src/lib/rfq/quoteKits.ts`), `label text`, `option_group text`, `option_label text`, `option_chosen boolean NOT NULL DEFAULT false`, `page_ref text`, `pick_reason text`, `pick_source text` (check: human | robot).
- `bid_quotes`: `source` check widened to `link | pasted | typed | robot`; `source_doc_url text`, `robot_request_id uuid`.
- New `bid_price_matrix_requests` (bid, requester, `scope jsonb` fixture snapshot, `sources jsonb` folder links, `status` queued | working | ready | blocked | cancelled | done, `claimed_by`, `claimed_at`, `heartbeat_at`, `finished_at`, `reviewed_at`, `summary`, `result jsonb`) with a bid index and a partial queue index on open statuses.
- New `fixture_component_rules` (`rule` in plain words, `kind` placement | sheet | option_default | required_role, `fixture_pattern`, `role`, `active`, `source` human | robot, `created_by`, `source_bid_id`, `mirror_note`, `times_used`, `last_used_at`).
- New `fixture_component_corrections` (request, bid, quote line, `action` move | unpick | repick | not_a_component | choose_option, from/to fixture and role, `remember`, `rule_text`, `rule_id`, `created_by`, `digested_at`) with a partial index on undigested rows.
- `users.twin_kind text` (check: estimator | pricer; null reads as estimator).
- RLS on the three new tables: the quote store's five pricing-sharer roles (dev, master_technician, assistant, controller, estimator) read and write; `GRANT ALL … TO service_role` for twin-mcp. Ends with all three fence appliers.
- Column and table comments throughout.

Additive and idempotent (`IF NOT EXISTS`, constraint guards, `DROP … IF EXISTS` before the widened check). Replayed twice on a scratch Postgres with stubbed dependencies before the PR; constraint probes confirmed `component_role` and `bid_quotes.source` refuse bogus values and accept `robot`. **Push after the v2.3263 client deploys.** Nothing writes the new columns until PR 3 (twin-mcp) and nothing renders them until PR 4. Regenerate types afterwards.
