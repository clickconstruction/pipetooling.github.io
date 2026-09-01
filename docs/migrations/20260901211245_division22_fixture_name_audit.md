# 20260901211245_division22_fixture_name_audit

Division 22 audit feed (v2.2598). One RPC,
`spec_section_fixture_name_audit()` → (fixture text, bid_count bigint):
distinct trimmed non-blank fixture names across all `bids_count_rows`
with per-name distinct-bid counts, ordered worst-offenders first.
SECURITY DEFINER + `search_path = public` so the aggregate skips per-row
RLS fan-out; gated inside to dev/master_technician/assistant/controller/
estimator (the `spec_section_match_rules` writer roles). STABLE,
read-only — no new tables, so no fence appliers.
