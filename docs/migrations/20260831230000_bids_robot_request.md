# 20260831230000_bids_robot_request

Adds `bids.robot_requested_at timestamptz` + `robot_requested_by uuid` (FK →
users, `ON DELETE SET NULL`). Set when a board user clicks the yellow robot icon
(request), nulled on re-click (withdraw). Drives the green icon state and the
dev-only 🤖 Queue lens ordering (v2.2542); intended as the priority signal for
twin-mcp `get_shadow_queue` in a follow-up. Additive and idempotent; no new
table, so the read-only appliers are not required.
