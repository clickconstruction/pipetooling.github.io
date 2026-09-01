# 20260901070000 — bid_audits.self_assessment (v2.2553)

Adds nullable `bid_audits.self_assessment text` — the twin's own confession of
where its draft is least sure, written by twin-mcp `ct_finish_takeoff`
(optional `self_assessment` param; insert on audit creation, refreshed on a
re-finish). Rendered atop the audit card as "🤖 Where I'm least sure" so the
auditor checks the robot's suspicions first.

Additive and idempotent (`ADD COLUMN IF NOT EXISTS`); no RLS changes (column
rides the existing bid_audits policies). Deploy order: push this migration
BEFORE deploying twin-mcp v1.3.3 — the insert includes the column when the
param is present and would fail silently against the old schema.
