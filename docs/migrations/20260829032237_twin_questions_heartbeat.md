# 20260829032237_twin_questions_heartbeat

`twin_questions` (internal twin↔owner ask lane; `about_bid_id` dodges the fence's bid_id
auto-detection by design) + heartbeat columns on `twin_runs` (bid_id/stage/state). Re-creates
`apply_digital_twin_write_blocks()` with a twin_questions branch (twin: INSERT-as-self only);
RESTRICTIVE ask-only policies; both read-only appliers + the fence applier run at the end.
