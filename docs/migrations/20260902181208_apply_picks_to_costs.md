# 20260902181208_apply_picks_to_costs

RFQ Round 2 Rung G (v2.2655; owner-approved option (a)). Two pieces:
`bid_quote_lines` gains `lot_id` + `lot_total_cents` (package prices —
lines sharing a lot carry ONE total, no per-line unit); new
`bid_count_row_custom_costs` (bid_id + count_row_id unique,
`unit_materials_cents`, source 'quoted', quote_line_id, lot_group_id,
house_name, applied_by/at) — the cost-side sibling of
`bid_count_row_custom_prices`. It overrides the row's MATERIALS
component only (labor untouched; taxed like takeoff materials;
recomputed against live counts). RLS = the five cost-side roles; ends
with all three fence appliers.
