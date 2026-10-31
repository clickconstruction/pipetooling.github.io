SET lock_timeout = '3s';

-- Punch list #49 (v2.6220): the per-sender statement round retires. Since
-- 20260928040549 the Dashboard's Needs You row reads get_my_statement_week()
-- and the statement-round-email-dispatch function reads
-- get_statement_week_for_office(); the two functions below were kept only as
-- the fallback each used while that migration was unpushed. Read on
-- 2026-10-31 over the four Wednesdays since 2026-10-07: no statement round
-- email request has ever been made, so the dispatcher never called either;
-- the client's fallback fired only on a PGRST202, and get_my_statement_week
-- answers. v2.6220's client and function carry no call to either name, and
-- this file is pushed only once both are live — PostgREST answers a dropped
-- name with a refusal, and the old client would read it as one.

DROP FUNCTION IF EXISTS public.get_my_statement_round();
DROP FUNCTION IF EXISTS public.get_statement_round_for_user(uuid);

COMMENT ON TABLE public.statement_round_email_requests IS
  'Requested sends of the "Your statement round" email (v2.2771). Office roles insert for themselves or another office user; statement-round-email-dispatch (pg_cron */5, :02 lane) processes rows with send_at <= now(), rebuilds the office''s week fresh via get_statement_week_for_office (v2.3976, punch list #49; the per-sender get_statement_round_for_user was dropped in v2.6220), and stamps sent_at/error. repeat_weekly rows re-enqueue +7d on successful send; cancelling the pending row ends the chain.';
