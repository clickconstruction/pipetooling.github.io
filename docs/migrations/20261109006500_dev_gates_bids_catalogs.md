# 20261109006500_dev_gates_bids_catalogs.sql (2026-11-08, v2.6764)

Punch list #188, PR 11 of the dev gates: Settings → Bids & materials, rows 27 to 29 of the audit table, taken as written by the owner on 2026-11-08 (row 63, the cost of estimating, is client lines alone).

- **The estimators' words (row 27)** — key-scoped `INSERT`/`UPDATE` on `app_settings` for `is_dev() OR is_estimator()` over the six prospect copy keys and the six cover letter keys (`bid_cover_letter_closing_v1`, `bid_cover_letter_exclusions_default_v1`, `bid_cover_letter_terms_default_v1`, `bid_sov_labor_share_pct_v1`, `bid_sov_material_factor_v1`, `bid_tax_rate_pct_v1`); `FOR ALL` policies on `counts_fixture_groups` and `counts_fixture_group_items` for `is_estimator()` beside the dev's. The line item catalog (`replace_estimate_catalog_payload`, `user_can_manage_estimate_catalog()`) and `fixture_types` admitted the estimator already.
- **The owner's words (rows 28, 29)** — key-scoped `INSERT`/`UPDATE` for `is_master_or_dev()` over the sixteen estimate experience keys, `estimate_public_terms_body` and `bid_board_value_rule_v1`.

No table is created, so no fence call is owed. Every policy is `DROP POLICY IF EXISTS` then `CREATE`: idempotent, additive.

**Order**: push right after the merge. Until the push the estimator's and the owner's saves on these blocks come back as refusals in words.
