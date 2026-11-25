SET lock_timeout = '3s';

-- Addresses that look alike (punch list #439, piece 2). A job's address is free text, and the addresses already on
-- file stay as they were typed, so some places are written two ways: a typo, a unit, a missing space, a neighbour at
-- the same map point. The app pairs those up (src/lib/addresses/lookAlikes.ts) and a person answers each pair once:
-- Same place, or Not the same. This table keeps the answers.
--
--   * One row a pair, under the two addresses' cleaned keys in their one order (key_a < key_b), so a pair has one
--     answer whichever way it was asked. The key is the form the app already matches addresses by
--     (normalizeAddressKey in src/lib/developments/notInIt.ts). No job is named: an answer is about two ways of
--     writing a place, and it holds for every job and bid at either.
--   * An answer changes no job's address. Same place only records the match. What reads it: the list of pairs still
--     to answer, the job form's address box, and after this piece the site a paper names and the hold on a send.
--   * Who: the office answers (is_office_staff: dev, master, assistant, controller). The estimator reads beside
--     them, since a bid has an address too and the site match covers bids.
--   * The stamp is the database's, not the caller's: who answered, their name that day, and when, set by a trigger
--     on every insert and update, so a second answer on a pair says who gave it.
--   * Undo is a delete: the pair is then asked again.
--   * One table is made, so the four fence calls close the file. Everything is CREATE ... IF NOT EXISTS or OR REPLACE.

CREATE TABLE IF NOT EXISTS public.address_place_answers (
  key_a text NOT NULL,
  key_b text NOT NULL,
  -- true: the two are one place. false: they are not, and the pair is not asked again.
  same boolean NOT NULL,
  answered_by uuid DEFAULT auth.uid() REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '',
  answered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key_a, key_b),
  CONSTRAINT address_place_answers_ordered CHECK (key_a < key_b),
  CONSTRAINT address_place_answers_keys CHECK (
    btrim(key_a) <> '' AND btrim(key_b) <> '' AND char_length(key_a) <= 300 AND char_length(key_b) <= 300
  )
);

COMMENT ON TABLE public.address_place_answers IS
  'Addresses that look alike (punch list #439): one row a pair of cleaned address keys (key_a < key_b) with a person''s answer, same place or not. It changes no job''s address. The office writes, the estimator reads beside them. answered_by, by_name and answered_at are stamped by trigger.';

CREATE INDEX IF NOT EXISTS address_place_answers_key_b_idx ON public.address_place_answers (key_b);
CREATE INDEX IF NOT EXISTS address_place_answers_answered_by_idx ON public.address_place_answers (answered_by);

CREATE OR REPLACE FUNCTION public.address_place_answers_stamp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.answered_by := auth.uid();
  NEW.answered_at := now();
  NEW.by_name := COALESCE((SELECT u.name FROM public.users u WHERE u.id = auth.uid()), '');
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.address_place_answers_stamp() IS
  'Stamps who answered a pair of look-alike addresses, their name that day and when, on every insert and update of address_place_answers (punch list #439).';

DROP TRIGGER IF EXISTS address_place_answers_stamp ON public.address_place_answers;
CREATE TRIGGER address_place_answers_stamp
  BEFORE INSERT OR UPDATE ON public.address_place_answers
  FOR EACH ROW EXECUTE FUNCTION public.address_place_answers_stamp();

ALTER TABLE public.address_place_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS address_place_answers_read ON public.address_place_answers;
CREATE POLICY address_place_answers_read ON public.address_place_answers FOR SELECT TO authenticated
  USING ((SELECT public.is_office_or_estimator()));

DROP POLICY IF EXISTS address_place_answers_insert ON public.address_place_answers;
CREATE POLICY address_place_answers_insert ON public.address_place_answers FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_office_staff()));

DROP POLICY IF EXISTS address_place_answers_update ON public.address_place_answers;
CREATE POLICY address_place_answers_update ON public.address_place_answers FOR UPDATE TO authenticated
  USING ((SELECT public.is_office_staff()))
  WITH CHECK ((SELECT public.is_office_staff()));

DROP POLICY IF EXISTS address_place_answers_delete ON public.address_place_answers;
CREATE POLICY address_place_answers_delete ON public.address_place_answers FOR DELETE TO authenticated
  USING ((SELECT public.is_office_staff()));

REVOKE ALL ON public.address_place_answers FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.address_place_answers TO authenticated;

-- House rules: training mode writes nothing, a twin writes nothing here, an archived caller reads nothing.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
