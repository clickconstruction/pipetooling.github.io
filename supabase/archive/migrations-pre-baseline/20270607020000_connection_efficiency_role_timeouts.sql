-- Connection-efficiency hardening (to delay a compute-size upgrade).
--
-- Context: the 2026-06-04 incidents were connection-slot exhaustion — new
-- connections timed out while the pool was saturated. Supabase already sets
-- statement_timeout on the app roles (anon = 3s, authenticated = 8s), so the
-- normal request path is capped. Two gaps remained:
--
--   * service_role had NO statement_timeout, so a stuck edge-function / admin
--     query could pin a pooled connection indefinitely.
--   * NO role had idle_in_transaction_session_timeout, so a leaked transaction
--     (BEGIN without COMMIT, abandoned client) could hold a connection forever.
--
-- Both are connection-exhaustion vectors. These ALTER ROLE settings apply to
-- new sessions and persist across restarts. Values are intentionally generous
-- so they only kill genuinely stuck work; tighten later if pg_stat_statements
-- shows headroom.

-- Cap runaway service_role queries (edge functions, admin RPCs).
alter role service_role set statement_timeout = '60s';

-- Reclaim connections held by transactions left idle (leak protection).
alter role authenticated set idle_in_transaction_session_timeout = '30s';
alter role anon          set idle_in_transaction_session_timeout = '30s';
alter role service_role  set idle_in_transaction_session_timeout = '60s';
