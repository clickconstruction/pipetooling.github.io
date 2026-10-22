SET lock_timeout = '3s';

-- Robot rounds, PR 1 (punch list #142, v2.5730): the heartbeat grows. A robot's heartbeat
-- already lands a twin_runs row (bid, stage, state, a note). This gives it a shape a person can
-- read on the bid, a fifth state for a round that found nothing, the key that sent it and the
-- round flag; and gives the key itself a last-seen stamp every verb refreshes and the two stop
-- columns the Console's Stop the rounds press writes. Additive; every existing row reads as before.
-- Deploy order: push this, then deploy twin-mcp (its inserts name the new columns).

BEGIN;

-- The fifth state: idle, a round with nothing to do. The inline CHECK from 20260829032237 is
-- named twin_runs_state_check by Postgres.
ALTER TABLE public.twin_runs DROP CONSTRAINT IF EXISTS twin_runs_state_check;
ALTER TABLE public.twin_runs ADD CONSTRAINT twin_runs_state_check
  CHECK (state IS NULL OR state = ANY (ARRAY['working'::text, 'blocked'::text, 'done'::text, 'idle'::text]));

-- Which key said it, the plain-words shape (step, read, wrote, waiting_on, next; rounds on an
-- idle row), and whether a round said it (the stop reaches rounds only).
ALTER TABLE public.twin_runs ADD COLUMN IF NOT EXISTS credential_id uuid REFERENCES public.twin_credentials(id) ON DELETE SET NULL;
ALTER TABLE public.twin_runs ADD COLUMN IF NOT EXISTS progress jsonb;
ALTER TABLE public.twin_runs ADD COLUMN IF NOT EXISTS is_round boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS twin_runs_heartbeat_idx ON public.twin_runs (twin_user_id, started_at DESC) WHERE mission = 'heartbeat';
CREATE INDEX IF NOT EXISTS twin_runs_credential_idx ON public.twin_runs (credential_id, started_at DESC) WHERE credential_id IS NOT NULL;

-- The key: last seen by any verb (stamped at most once a minute), and the stop.
ALTER TABLE public.twin_credentials ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
ALTER TABLE public.twin_credentials ADD COLUMN IF NOT EXISTS stopped_at timestamptz;
ALTER TABLE public.twin_credentials ADD COLUMN IF NOT EXISTS stopped_by uuid REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.twin_runs.progress IS 'Robot rounds (v2.5730): the heartbeat''s plain-words shape — step, read, wrote, waiting_on, next; rounds on a collapsed idle row.';
COMMENT ON COLUMN public.twin_credentials.last_seen_at IS 'Robot rounds (v2.5730): the newest twin-mcp call on this key, stamped at most once a minute.';
COMMENT ON COLUMN public.twin_credentials.stopped_at IS 'Robot rounds (v2.5730): Stop the rounds — set by the Console, read by the round in the reply to its next heartbeat; Start again clears it.';

COMMIT;
