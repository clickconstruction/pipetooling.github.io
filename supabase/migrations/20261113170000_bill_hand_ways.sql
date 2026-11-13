SET lock_timeout = '3s';

-- The ways a bill can go when the app did not send it (punch list #340, PR 2; the owner's picks of 2026-11-13).
--
-- Bills sent (/bills-sent) has one form, Say how it went…, with a list under How the bill went. Until now the list
-- was four choices fixed in code (src/lib/billing/billsSent.ts, BILLS_SENT_BY_HAND_HOWS), so a bill uploaded to a
-- builder's pay portal had no choice that fits and only a release could add one. The owner asked that the people who
-- open the page can add to the list and edit it. This is the list's own table.
--
--   1. bill_hand_ways — one way per row: its words, its place in the list, and retired_at when the office takes it
--      off. A way is taken off, never deleted. A record made by hand keeps the words it was made with on its own row
--      (sent_documents.source_snapshot.how_label, v2.7145), so nothing here can reword a record already made.
--   2. The guard: the database writes who and when, makes a new way's key, holds key and sent_how still, trims the
--      words, and refuses a name already on the list, a 13th live way and taking off the last one. Each refusal is a
--      sentence a person can read.
--   3. The gates: the four roles that open Bills sent read and write (is_office_staff(): dev, master, assistant,
--      controller). The office has no delete; a dev does.
--   4. The four ways there today, as the first four rows, with the keys the records already carry.
--   5. sent_documents.how gains one value, other, for a way the office types: it is not by hand, by mail or by email.
--
-- Nothing reads this table until the client of the same PR, which falls back to the four in code while the read is
-- refused, so the form works before this file is pushed.

-- 1. The list.
CREATE TABLE IF NOT EXISTS public.bill_hand_ways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL DEFAULT ('w_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  label text NOT NULL,
  sent_how text NOT NULL DEFAULT 'other',
  sort_order integer NOT NULL DEFAULT 0,
  retired_at timestamptz,
  retired_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  retired_by_name text NOT NULL DEFAULT '',
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bill_hand_ways_key_unique UNIQUE (key),
  CONSTRAINT bill_hand_ways_key_shape CHECK (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  CONSTRAINT bill_hand_ways_label_length CHECK (label = btrim(label) AND length(label) BETWEEN 1 AND 60),
  CONSTRAINT bill_hand_ways_sent_how_known CHECK (sent_how IN ('hand', 'mail', 'email', 'other'))
);

COMMENT ON TABLE public.bill_hand_ways IS
  'Bills sent (punch list #340): the ways a bill can go when the app did not send it, the list under How the bill went in Say how it went…. One way per row in sort_order. A way taken off is retired, never deleted. A record made by hand keeps its own words (sent_documents.source_snapshot.how_label), so a rename or a retire changes no record already made. At most 12 live ways and never none.';
COMMENT ON COLUMN public.bill_hand_ways.key IS 'The code a record carries in source_snapshot.how. Never made from the words and never changed: the four first rows keep handed, mailed, own_mailbox and housecall_pro, a way the office adds gets w_ and ten random characters.';
COMMENT ON COLUMN public.bill_hand_ways.sent_how IS 'What the sent copy''s own how column gets for a record made with this way: hand, mail, email, or other for a way the office typed. The office is never asked for it.';
COMMENT ON COLUMN public.bill_hand_ways.retired_at IS 'When the office took the way off the list. It leaves the form and stays here; clearing it brings the way back.';

-- One live way per set of words, whatever the capitals. The guard says so in a sentence first; this is the floor.
CREATE UNIQUE INDEX IF NOT EXISTS bill_hand_ways_live_label_key ON public.bill_hand_ways (lower(label)) WHERE retired_at IS NULL;

-- 2. The guard. A signed-in writer's row is stamped and held here whatever the client sends. A row with no signed-in
-- writer (this file's own four, the service role) is taken as given.
CREATE OR REPLACE FUNCTION public.bill_hand_ways_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := '';
BEGIN
  NEW.label := btrim(regexp_replace(COALESCE(NEW.label, ''), '\s+', ' ', 'g'));
  IF v_uid IS NULL THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  -- One writer at a time, so the counts below are the ones this write lands on.
  PERFORM pg_advisory_xact_lock(hashtext('bill_hand_ways'));
  v_name := COALESCE((SELECT u.name FROM public.users u WHERE u.id = v_uid), '');

  IF TG_OP = 'INSERT' THEN
    NEW.key := 'w_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
    NEW.sent_how := 'other';
    NEW.retired_at := NULL;
    NEW.retired_by := NULL;
    NEW.retired_by_name := '';
    NEW.created_by := v_uid;
    NEW.created_by_name := v_name;
    NEW.created_at := now();
    NEW.sort_order := COALESCE((SELECT max(w.sort_order) FROM public.bill_hand_ways w), 0) + 1;
  ELSE
    NEW.key := OLD.key;
    NEW.sent_how := OLD.sent_how;
    NEW.created_by := OLD.created_by;
    NEW.created_by_name := OLD.created_by_name;
    NEW.created_at := OLD.created_at;
    IF OLD.retired_at IS NULL AND NEW.retired_at IS NOT NULL THEN
      IF NOT EXISTS (SELECT 1 FROM public.bill_hand_ways w WHERE w.retired_at IS NULL AND w.id <> OLD.id) THEN
        RAISE EXCEPTION 'The list needs one way. Add another before you take this one off.' USING ERRCODE = '23514';
      END IF;
      NEW.retired_at := now();
      NEW.retired_by := v_uid;
      NEW.retired_by_name := v_name;
    ELSIF OLD.retired_at IS NOT NULL AND NEW.retired_at IS NULL THEN
      NEW.retired_by := NULL;
      NEW.retired_by_name := '';
    ELSE
      NEW.retired_at := OLD.retired_at;
      NEW.retired_by := OLD.retired_by;
      NEW.retired_by_name := OLD.retired_by_name;
    END IF;
  END IF;

  IF NEW.retired_at IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.bill_hand_ways w WHERE w.retired_at IS NULL AND w.id <> NEW.id AND lower(w.label) = lower(NEW.label)) THEN
      RAISE EXCEPTION 'That way is already on the list.' USING ERRCODE = '23505';
    END IF;
    -- A new way, or one brought back, needs room.
    IF (TG_OP = 'INSERT' OR OLD.retired_at IS NOT NULL)
       AND (SELECT count(*) FROM public.bill_hand_ways w WHERE w.retired_at IS NULL AND w.id <> NEW.id) >= 12 THEN
      RAISE EXCEPTION 'The list is full at 12 ways. Take one off first.' USING ERRCODE = '23514';
    END IF;
  END IF;

  NEW.updated_by := v_uid;
  NEW.updated_at := now();
  RETURN NEW;
END
$fn$;
-- A trigger function is never called by hand.
REVOKE ALL ON FUNCTION public.bill_hand_ways_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS bill_hand_ways_guard ON public.bill_hand_ways;
CREATE TRIGGER bill_hand_ways_guard
  BEFORE INSERT OR UPDATE ON public.bill_hand_ways
  FOR EACH ROW EXECUTE FUNCTION public.bill_hand_ways_guard();

-- 3. The gates: the people who open Bills sent, the sent copies' own readers.
ALTER TABLE public.bill_hand_ways ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bill_hand_ways_select_office ON public.bill_hand_ways;
CREATE POLICY bill_hand_ways_select_office
  ON public.bill_hand_ways FOR SELECT TO authenticated
  USING (public.is_office_staff());

DROP POLICY IF EXISTS bill_hand_ways_insert_office ON public.bill_hand_ways;
CREATE POLICY bill_hand_ways_insert_office
  ON public.bill_hand_ways FOR INSERT TO authenticated
  WITH CHECK (public.is_office_staff());

DROP POLICY IF EXISTS bill_hand_ways_update_office ON public.bill_hand_ways;
CREATE POLICY bill_hand_ways_update_office
  ON public.bill_hand_ways FOR UPDATE TO authenticated
  USING (public.is_office_staff())
  WITH CHECK (public.is_office_staff());

-- A way is taken off, not removed. A dev can remove a row made by mistake.
DROP POLICY IF EXISTS bill_hand_ways_delete_dev ON public.bill_hand_ways;
CREATE POLICY bill_hand_ways_delete_dev
  ON public.bill_hand_ways FOR DELETE TO authenticated
  USING (public.is_dev());

REVOKE ALL ON public.bill_hand_ways FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bill_hand_ways TO authenticated;

-- 4. The four ways there today, under the keys the records already carry.
INSERT INTO public.bill_hand_ways (key, label, sent_how, sort_order) VALUES
  ('handed', 'Handed over', 'hand', 1),
  ('mailed', 'Mailed', 'mail', 2),
  ('own_mailbox', 'Emailed from a person’s own mailbox', 'email', 3),
  ('housecall_pro', 'Sent from Housecall Pro', 'email', 4)
ON CONFLICT (key) DO NOTHING;

-- 5. A way the office types is not by hand, by mail or by email: the sent copy's how gains other. Not valid first, so
-- the lock is short, then checked without one that blocks writers.
ALTER TABLE public.sent_documents DROP CONSTRAINT IF EXISTS sent_documents_how_known;
ALTER TABLE public.sent_documents
  ADD CONSTRAINT sent_documents_how_known CHECK (how IN ('print', 'email', 'hand', 'mail', 'link', 'download', 'other')) NOT VALID;
ALTER TABLE public.sent_documents VALIDATE CONSTRAINT sent_documents_how_known;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
