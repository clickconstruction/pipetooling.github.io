SET lock_timeout = '3s';

-- v2.5814 — Quickfill's Email station reads Gmail's own labels (punch list #159, PR 1 of 5). The station was three free
-- boxes and a mark; its history showed the same six emails retyped every morning for a week. The `gmail-count` edge
-- function (PR 2) sweeps each counted box's labels under the bids@ reader's delegation with Gmail's metadata-only
-- scope (senders, subjects and dates; Google refuses the words) and keeps:
--   * email_box_watch: the app's own list of what it reads. A shared box (user_id null: bids@, work@) or a person's own
--     mailbox (`users.email`), the labels the row names (Inbox, Follow Up, Next Actions to start), on or off, who added
--     it, and the sweep's health for that box. Nothing not on this list is ever read.
--   * email_box_threads: one row per thread the sweep saw in a counted label: when it arrived, its last activity, who
--     wrote first and the subject, when the sweep first and last saw it, and when it was gone (cleared). Never a body.
--   * email_box_days: the trend, one row per box, label and day: how many sat, the oldest's age, what came, what cleared.
-- Who sees what (the stance, docs/ACCESS_CONTROL.md): a shared box's rows to the office team; a person's rows to that
-- person and to the one lead the owner names (app_settings email_count_lead_v1), and to nobody else. The owner and a
-- dev see the list itself (never a person's threads unless named the lead); a person may change their own labels and
-- switch their own row off, which deletes what was kept of their threads.
-- The switch email_count_on_v1 ships off; the limit email_count_limit_days_v1 ships at 3 days. The cron posts to
-- gmail-count every 15 minutes while the switch is on. Idempotent, additive.

-- ---------- the list of what the app reads ----------

CREATE TABLE IF NOT EXISTS public.email_box_watch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Null for a shared box; a person's users.id for their own mailbox. Deleting the person deletes the rows.
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  address text NOT NULL,
  labels text[] NOT NULL DEFAULT ARRAY['Inbox', 'Follow Up', 'Next Actions']::text[],
  is_on boolean NOT NULL DEFAULT true,
  added_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- The sweep's health for this box, written by gmail-count as the service role.
  last_run_at timestamptz,
  last_ok_at timestamptz,
  last_error text,
  -- What the last sweep found per label, by the label's name as the row spells it:
  -- { "Inbox": { "total": 2, "listed": 2, "cut": false, "at": "<iso>" }, "Follow Up": { "missing": true, "at": "<iso>" } }.
  -- total is Gmail's own count (exact even for a 4,000-thread Inbox); listed is how many threads the rows hold; cut says
  -- the listing stopped at the page cap; missing says the box has no label of that name.
  labels_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT email_box_watch_address_is_one CHECK (address = lower(btrim(address)) AND address ~ '^[^[:space:]@<>]+@[^[:space:]@<>]+\.[^[:space:]@<>]+$'),
  CONSTRAINT email_box_watch_one_row_per_address UNIQUE (address)
);

COMMENT ON TABLE public.email_box_watch IS
  'Quickfill Email station (v2.5814): the mailboxes and labels the gmail-count sweep counts. user_id null is a shared box (the office team sees it); a person''s row shows to them and to the lead (app_settings email_count_lead_v1). The owner or a dev adds and removes rows; a person may switch their own off. gmail-count writes the health columns.';

CREATE INDEX IF NOT EXISTS email_box_watch_user_idx ON public.email_box_watch (user_id);

-- A person may change their own labels and their own switch, and nothing else: only the owner or a dev changes whose
-- box a row is, and only the count (the service role, no auth.uid()) writes how a box is doing.
CREATE OR REPLACE FUNCTION public.email_box_watch_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF (NEW.address IS DISTINCT FROM OLD.address OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.added_by IS DISTINCT FROM OLD.added_by)
       AND NOT public.is_master_or_dev() THEN
      RAISE EXCEPTION 'Only the owner or a dev changes whose box this is.';
    END IF;
    IF NEW.labels_state IS DISTINCT FROM OLD.labels_state OR NEW.last_run_at IS DISTINCT FROM OLD.last_run_at
       OR NEW.last_ok_at IS DISTINCT FROM OLD.last_ok_at OR NEW.last_error IS DISTINCT FROM OLD.last_error
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Only the count writes how a box is doing.';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS email_box_watch_guard ON public.email_box_watch;
CREATE TRIGGER email_box_watch_guard
  BEFORE UPDATE ON public.email_box_watch
  FOR EACH ROW EXECUTE FUNCTION public.email_box_watch_guard();

-- ---------- the threads the sweep saw ----------

CREATE TABLE IF NOT EXISTS public.email_box_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_id uuid NOT NULL REFERENCES public.email_box_watch(id) ON DELETE CASCADE,
  label_name text NOT NULL,
  gmail_thread_id text NOT NULL,
  -- The first message's date; null when Gmail gave none.
  arrived_at timestamptz,
  -- The last message's date.
  last_at timestamptz,
  from_name text,
  from_address text,
  subject text NOT NULL DEFAULT '',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  -- Set when a sweep no longer finds the thread in the label: cleared. Null while it sits.
  gone_at timestamptz,
  CONSTRAINT email_box_threads_once UNIQUE (watch_id, label_name, gmail_thread_id)
);

COMMENT ON TABLE public.email_box_threads IS
  'Quickfill Email station (v2.5814): one row per thread gmail-count saw in a counted label: arrival, last activity, first sender, subject, first and last seen, gone_at when cleared. Never a body or a file. Read by who may see the box (email_box_can_see); written by gmail-count as the service role.';

CREATE INDEX IF NOT EXISTS email_box_threads_open_idx ON public.email_box_threads (watch_id, label_name) WHERE gone_at IS NULL;

-- The stance: nothing named is kept for a box that is switched off, or for a label the row no longer names. A switch
-- turned off deletes the box's threads (the counts in the trend stay; they name nobody); a label dropped from the row
-- deletes that label's threads. The names compare trimmed and case-blind, as the sweep's cleanLabels spells them.
CREATE OR REPLACE FUNCTION public.email_box_watch_forget()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_on AND NOT NEW.is_on THEN
    DELETE FROM public.email_box_threads WHERE watch_id = NEW.id;
  ELSIF NEW.labels IS DISTINCT FROM OLD.labels AND cardinality(NEW.labels) > 0 THEN
    DELETE FROM public.email_box_threads t
    WHERE t.watch_id = NEW.id
      AND lower(btrim(t.label_name)) <> ALL (SELECT lower(btrim(l)) FROM unnest(NEW.labels) AS l);
  END IF;
  RETURN NULL;
END
$$;

DROP TRIGGER IF EXISTS email_box_watch_forget ON public.email_box_watch;
CREATE TRIGGER email_box_watch_forget
  AFTER UPDATE OF is_on, labels ON public.email_box_watch
  FOR EACH ROW EXECUTE FUNCTION public.email_box_watch_forget();

-- ---------- the trend ----------

CREATE TABLE IF NOT EXISTS public.email_box_days (
  watch_id uuid NOT NULL REFERENCES public.email_box_watch(id) ON DELETE CASCADE,
  label_name text NOT NULL,
  day date NOT NULL,
  count integer NOT NULL DEFAULT 0 CONSTRAINT email_box_days_count_counted CHECK (count >= 0),
  oldest_days integer CONSTRAINT email_box_days_oldest_counted CHECK (oldest_days IS NULL OR oldest_days >= 0),
  new_count integer NOT NULL DEFAULT 0 CONSTRAINT email_box_days_new_counted CHECK (new_count >= 0),
  cleared_count integer NOT NULL DEFAULT 0 CONSTRAINT email_box_days_cleared_counted CHECK (cleared_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (watch_id, label_name, day)
);

COMMENT ON TABLE public.email_box_days IS
  'Quickfill Email station (v2.5814): the trend, one row per counted box, label and app-calendar day: how many threads sat, the oldest''s age in days, how many came and how many cleared that day. The last sweep of the day wins. Read by who may see the box; written by gmail-count as the service role.';

-- ---------- the switch, the lead and the limit ----------

INSERT INTO public.app_settings (key, value_text) VALUES ('email_count_on_v1', 'false') ON CONFLICT (key) DO NOTHING;
INSERT INTO public.app_settings (key, value_text) VALUES ('email_count_lead_v1', '') ON CONFLICT (key) DO NOTHING;
INSERT INTO public.app_settings (key, value_text) VALUES ('email_count_limit_days_v1', '3') ON CONFLICT (key) DO NOTHING;

DROP POLICY IF EXISTS master_or_dev_update_email_count ON public.app_settings;
CREATE POLICY master_or_dev_update_email_count ON public.app_settings
  FOR UPDATE TO authenticated
  USING (key IN ('email_count_on_v1', 'email_count_lead_v1', 'email_count_limit_days_v1') AND public.is_master_or_dev())
  WITH CHECK (key IN ('email_count_on_v1', 'email_count_lead_v1', 'email_count_limit_days_v1') AND public.is_master_or_dev());

-- ---------- who sees a box's facts ----------

-- A shared box: the office team. A person's box: that person, and the lead the owner named. Nobody else, the owner
-- included unless he names himself the lead (the stance of punch list #159).
CREATE OR REPLACE FUNCTION public.email_box_can_see(p_watch uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.email_box_watch w
    WHERE w.id = p_watch
      AND (
        (w.user_id IS NULL AND public.gc_office_team())
        OR w.user_id = auth.uid()
        OR (SELECT s.value_text FROM public.app_settings s WHERE s.key = 'email_count_lead_v1') = auth.uid()::text
      )
  );
$$;

COMMENT ON FUNCTION public.email_box_can_see(uuid) IS
  'Quickfill Email station (v2.5814): whether the caller may read a counted box''s threads and trend: the office team for a shared box; the person and the lead (app_settings email_count_lead_v1) for a person''s.';

REVOKE EXECUTE ON FUNCTION public.email_box_watch_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_box_watch_forget() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.email_box_can_see(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.email_box_can_see(uuid) TO authenticated, service_role;

ALTER TABLE public.email_box_watch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_box_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_box_days ENABLE ROW LEVEL SECURITY;

-- The list: who may see the box sees its row; the owner and a dev see every row, add and remove; a person updates
-- their own (the guard keeps the address and the person fixed).
DROP POLICY IF EXISTS email_box_watch_select ON public.email_box_watch;
CREATE POLICY email_box_watch_select ON public.email_box_watch
  FOR SELECT TO authenticated
  USING (public.is_master_or_dev() OR public.email_box_can_see(id));

DROP POLICY IF EXISTS email_box_watch_insert ON public.email_box_watch;
CREATE POLICY email_box_watch_insert ON public.email_box_watch
  FOR INSERT TO authenticated
  WITH CHECK (public.is_master_or_dev());

DROP POLICY IF EXISTS email_box_watch_delete ON public.email_box_watch;
CREATE POLICY email_box_watch_delete ON public.email_box_watch
  FOR DELETE TO authenticated
  USING (public.is_master_or_dev());

DROP POLICY IF EXISTS email_box_watch_update ON public.email_box_watch;
CREATE POLICY email_box_watch_update ON public.email_box_watch
  FOR UPDATE TO authenticated
  USING (public.is_master_or_dev() OR user_id = auth.uid())
  WITH CHECK (public.is_master_or_dev() OR user_id = auth.uid());

-- The threads and the trend: read by who may see the box; written by the sweep alone (service role bypasses RLS).
DROP POLICY IF EXISTS email_box_threads_select ON public.email_box_threads;
CREATE POLICY email_box_threads_select ON public.email_box_threads
  FOR SELECT TO authenticated
  USING (public.email_box_can_see(watch_id));

DROP POLICY IF EXISTS email_box_days_select ON public.email_box_days;
CREATE POLICY email_box_days_select ON public.email_box_days
  FOR SELECT TO authenticated
  USING (public.email_box_can_see(watch_id));

REVOKE ALL ON TABLE public.email_box_watch FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.email_box_threads FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.email_box_days FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.email_box_watch TO authenticated;
GRANT SELECT ON TABLE public.email_box_threads TO authenticated;
GRANT SELECT ON TABLE public.email_box_days TO authenticated;
GRANT ALL ON TABLE public.email_box_watch TO service_role;
GRANT ALL ON TABLE public.email_box_threads TO service_role;
GRANT ALL ON TABLE public.email_box_days TO service_role;

-- ---------- the cron ----------

-- Every 15 minutes, gmail-count with the cron secret, as gmail-sync's cron calls its function; nothing posts while the
-- switch is off, and the function (PR 2) checks the switch again. Vault PROJECT_URL and CRON_SECRET, uppercase.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'gmail-count';

SELECT cron.schedule(
  'gmail-count',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL') || '/functions/v1/gmail-count',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET')
    ),
    body := '{}'::jsonb
  ) AS request_id
  WHERE EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'email_count_on_v1' AND value_text = 'true');
  $$
);

-- House rules: read-only training mode and the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
