# 20261022052738_twin_heartbeat_progress.sql (2026-10-22, v2.5730)

Robot rounds, PR 1 (punch list #142): the heartbeat grows. Additive, idempotent.

- `twin_runs.state` admits a fifth value, `idle` (a round that found nothing to do); the inline CHECK from `20260829032237` is dropped and re-added with the new list.
- `twin_runs` gains `credential_id` (which key said it), `progress jsonb` (the plain-words shape: `step`, `read`, `wrote`, `waiting_on`, `next`; `rounds` on a collapsed idle row) and `is_round` (a round said it, so the stop reaches it). Two partial indexes: heartbeats by twin, rows by key.
- `twin_credentials` gains `last_seen_at` (every twin-mcp verb stamps it, at most once a minute, so a robot that forgets its heartbeat still reads alive), `stopped_at` and `stopped_by` (the Console's **Stop the rounds**; **Start again** clears both).

**Order**: push this, then `supabase functions deploy twin-mcp` — the function's heartbeat insert names the new columns, and before the push its `last_seen_at` stamp fails quietly.
