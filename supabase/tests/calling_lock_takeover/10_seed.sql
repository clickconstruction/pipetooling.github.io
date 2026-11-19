-- The seed of the calling-lock takeover bed (scripts/pgtest-calling-lock-takeover.sh). It opens the transaction that
-- 20_scenario.sql rolls back, and writes the locks the migration's second run meets: one long stale, one with no time,
-- one live. The migration file runs right after this one, in the same transaction. Never against prod.
\set ON_ERROR_STOP 1
BEGIN;

-- Ann and Bo are callers. Cy left and is archived. Di is in training (read-only).
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000c10a1', 'ann@lock.test'),
  ('00000000-0000-0000-0000-0000000c10a2', 'bo@lock.test'),
  ('00000000-0000-0000-0000-0000000c10a3', 'cy@lock.test'),
  ('00000000-0000-0000-0000-0000000c10a4', 'di@lock.test');
INSERT INTO public.users (id, email, name, role, read_only, is_digital_twin, archived_at) VALUES
  ('00000000-0000-0000-0000-0000000c10a1', 'ann@lock.test', 'Ann First', 'assistant', false, false, NULL),
  ('00000000-0000-0000-0000-0000000c10a2', 'bo@lock.test', 'Bo Second', 'assistant', false, false, NULL),
  ('00000000-0000-0000-0000-0000000c10a3', 'cy@lock.test', 'Cy Away', 'assistant', false, false, now()),
  ('00000000-0000-0000-0000-0000000c10a4', 'di@lock.test', 'Di Training', 'assistant', true, false, NULL)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, read_only = EXCLUDED.read_only, archived_at = EXCLUDED.archived_at;

INSERT INTO public.prospects (id, master_user_id, created_by)
SELECT ('00000000-0000-0000-0000-0000000c10b' || n)::uuid, '00000000-0000-0000-0000-0000000c10a1', '00000000-0000-0000-0000-0000000c10a1'
  FROM generate_series(1, 7) AS n;

-- What prod held before the fix: Ann dialed, and no release was ever sent.
INSERT INTO public.prospect_calling_locks (prospect_id, user_id, locked_at) VALUES
  ('00000000-0000-0000-0000-0000000c10b1', '00000000-0000-0000-0000-0000000c10a1', now() - interval '21 days'),
  ('00000000-0000-0000-0000-0000000c10b2', '00000000-0000-0000-0000-0000000c10a1', NULL),
  ('00000000-0000-0000-0000-0000000c10b3', '00000000-0000-0000-0000-0000000c10a1', now() - interval '5 minutes');

-- The migration file follows, then 20_scenario.sql.
