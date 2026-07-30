SET lock_timeout = '3s';

-- Idle-in-transaction guard (v2.1136) — protective fix from the 2026-07-30
-- freeze investigation (docs/DB_FREEZE_RUNBOOK.md).
--
-- Three app-wide freezes that day were NOT crashes and NOT capacity (CPU
-- peaked at 12%, DB is ~245 MB): ordinary queries piled up behind a lock
-- holder until statement timeouts cascaded and the office restarted the
-- instance. The classic holder of such locks is a session that opened a
-- transaction and then went idle (a wedged client, an abandoned SQL-editor
-- tab, a stalled tool) — it does no work, so the instance looks healthy,
-- while everything queues behind the locks it still holds.
--
-- This caps how long any session may sit idle INSIDE a transaction before
-- Postgres kills it and releases its locks. 60s is far above anything the
-- app does legitimately (PostgREST wraps each request in its own immediately-
-- committed transaction; edge functions don't hold interactive transactions)
-- and far below the 10+ minute freezes it prevents.
--
-- Database-level so every NEW session inherits it regardless of role.
-- Takes effect for sessions opened after this applies; existing sessions
-- keep their old setting until they reconnect.
-- Rollback: ALTER DATABASE postgres RESET idle_in_transaction_session_timeout;

ALTER DATABASE postgres SET idle_in_transaction_session_timeout = '60s';
