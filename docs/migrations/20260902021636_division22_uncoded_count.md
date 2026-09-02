# 20260902021636_division22_uncoded_count

Division 22 Needs You feed (v2.2627). One RPC,
`spec_section_uncoded_name_count()` → integer: distinct trimmed
lowercased fixture names across `bids_count_rows` that match NO
`spec_section_match_rules` row (NULL-section rules count as handled).
First-match semantics mirrored via CASE on match_kind with
`position()`/`left()` (never LIKE — patterns may contain `%`).
SECURITY DEFINER + `search_path = public`, gated inside to the
ledger-writer roles. STABLE, read-only, no new tables.
