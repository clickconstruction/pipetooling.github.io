SET lock_timeout = '3s';

-- v2.7072 (punch list #329, PR 1 of 6): stickers before boxes, the ground.
--
-- A label's code is cut from its box's own row (job_containers.code), so a label cannot exist before its box.
-- On a site that is backwards: someone walks in with a roll of stickers, sticks one on each box that is already
-- there, and only then says what it is. This makes a sticker its own row: a printed code and a short number that
-- point at one box, or at nothing yet. A box may carry several stickers and its own old label. Every one opens it.
-- job_containers.code is not touched: every label printed so far keeps working.
--
--   1. sticker_runs          a run of stickers printed at once: the job its new boxes go on, how many, the first
--                            and the last number, copies of each, who printed and when.
--   2. box_stickers          one sticker: its run, its number (one company-wide count, printed 0147), its code
--                            (eight characters cut from its own id by job_containers.code's rule), the box it is
--                            on (null while blank), who put it there and when, and the day it was marked lost.
--   3. box_sticker_events    insert only, and the one door a sticker changes through: placed, moved, taken off,
--                            lost, with the box it left and the box it went to, who and when. The caller's own RLS
--                            judges the row; a trigger then moves the sticker. No client updates box_stickers.
--   4. job_container_names   insert only, written by a trigger when a box's label changes: the old name, the new
--                            name, who and when. Every client is covered at once, the dev seat and a job combine too.
--   5. Functions: mint_sticker_run (a run and its stickers), sticker_by_code (the little a scan needs before it
--      knows the job), place_sticker (a blank sticker onto a known box, or onto a new box made in the same
--      transaction).
--
-- Who (docs/ACCESS_CONTROL.md, Materials on site):
--   * A sticker on a box follows its box's job through on_site_can_touch_job, as the box does.
--   * A blank sticker is read by whoever may touch the job its run was printed for. An orphaned run (its job
--     deleted) is the office's. Nobody else lists a blank sticker, so nobody harvests codes ahead of their boxes.
--   * Whoever holds a sticker's code reads the little sticker_by_code answers: the number, blank / on a box /
--     lost, and the box. The code is the capability, as it is for a label signed out.
--   * A run is printed by the office, a primary or a superintendent, for a job they can reach.
--   * Placing is open to anyone who may touch the box's job. A training account and a digital twin write nothing.
--
-- Idempotent: IF NOT EXISTS, CREATE OR REPLACE, and every policy is dropped before it is made.

-- ---------------------------------------------------------------------------------------------------------------
-- 0. Small helpers.
-- ---------------------------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sticker_can_mint()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT auth.uid() IS NOT NULL
    AND (public.is_office_staff() OR public.is_primary() OR public.is_superintendent())
$fn$;
COMMENT ON FUNCTION public.sticker_can_mint() IS 'Stickers before boxes (#329): who may print a run of stickers. The office (dev, master, assistant, controller), a primary or a superintendent.';
REVOKE EXECUTE ON FUNCTION public.sticker_can_mint() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sticker_can_mint() FROM anon;
GRANT EXECUTE ON FUNCTION public.sticker_can_mint() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.box_sticker_caller_name()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT COALESCE((SELECT left(btrim(u.name), 120) FROM public.users u WHERE u.id = auth.uid()), '')
$fn$;
COMMENT ON FUNCTION public.box_sticker_caller_name() IS 'Stickers before boxes (#329): the signed-in caller''s own name, for the who of a run, a placing and a rename. Empty with no session.';
REVOKE EXECUTE ON FUNCTION public.box_sticker_caller_name() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.box_sticker_caller_name() FROM anon;
GRANT EXECUTE ON FUNCTION public.box_sticker_caller_name() TO authenticated, service_role;

-- The number as a person reads it: 0147, and five digits past 9999. The client's twin is stickerNumberWords.
CREATE OR REPLACE FUNCTION public.box_sticker_number_words(p_number integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $fn$
  SELECT CASE WHEN p_number IS NULL THEN '' WHEN p_number < 10000 THEN lpad(p_number::text, 4, '0') ELSE p_number::text END
$fn$;
COMMENT ON FUNCTION public.box_sticker_number_words(integer) IS 'Stickers before boxes (#329): a sticker''s number as printed, 0147, five digits past 9999.';

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Runs.
-- ---------------------------------------------------------------------------------------------------------------

-- One company-wide count. Only the mint trigger reads it, under a lock, so a run's numbers are one unbroken block.
CREATE SEQUENCE IF NOT EXISTS public.box_sticker_number_seq AS integer START WITH 1 MINVALUE 1;
REVOKE ALL ON SEQUENCE public.box_sticker_number_seq FROM PUBLIC;
REVOKE ALL ON SEQUENCE public.box_sticker_number_seq FROM anon;
REVOKE ALL ON SEQUENCE public.box_sticker_number_seq FROM authenticated;

CREATE TABLE IF NOT EXISTS public.sticker_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE SET NULL,
  sticker_count integer NOT NULL CHECK (sticker_count BETWEEN 1 AND 500),
  first_number integer,
  last_number integer,
  copies integer NOT NULL DEFAULT 1 CHECK (copies BETWEEN 1 AND 6),
  printed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  printed_by_name text NOT NULL DEFAULT '' CHECK (length(printed_by_name) <= 120),
  printed_at timestamptz NOT NULL DEFAULT now(),
  -- Both numbers or neither, and the block is as long as the run. Each is asked for by name: a check passes when
  -- its answer is unknown, so half a block would otherwise slip through.
  CONSTRAINT sticker_runs_numbers_check CHECK (
    (first_number IS NULL AND last_number IS NULL)
    OR (first_number IS NOT NULL AND last_number IS NOT NULL AND first_number >= 1 AND last_number = first_number + sticker_count - 1)
  )
);
CREATE INDEX IF NOT EXISTS sticker_runs_job_idx ON public.sticker_runs (job_id);
COMMENT ON TABLE public.sticker_runs IS 'Stickers before boxes (#329): a run of stickers printed at once. job_id is where a new box made from one of its stickers lands; it is null once that job is deleted, and the stickers stay good.';
COMMENT ON COLUMN public.sticker_runs.sticker_count IS 'How many stickers the run made, 1 to 500. A set is copies of one sticker, so 200 stickers at 2 copies are 400 strips.';
COMMENT ON COLUMN public.sticker_runs.first_number IS 'The run''s first number. Filled with last_number by the mint trigger in the statement that inserts the run.';
COMMENT ON COLUMN public.sticker_runs.copies IS 'Copies of each sticker in a set, 1 to 6, for a box with more than one side. Every copy carries the same code.';

-- Who prints a run, and the facts no client names for itself. Refused in words before a number is taken.
CREATE OR REPLACE FUNCTION public.sticker_runs_stamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to print a run of stickers.' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot print a run of stickers.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot print a run of stickers.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.sticker_can_mint() THEN
    RAISE EXCEPTION 'Only the office, a primary or a superintendent prints a run of stickers.' USING ERRCODE = '42501';
  END IF;
  IF NEW.job_id IS NULL THEN
    RAISE EXCEPTION 'A run names the job its new boxes go on.';
  END IF;
  IF NEW.sticker_count IS NULL OR NEW.sticker_count < 1 OR NEW.sticker_count > 500 THEN
    RAISE EXCEPTION 'A run is 1 to 500 stickers.';
  END IF;
  NEW.copies := COALESCE(NEW.copies, 1);
  IF NEW.copies < 1 OR NEW.copies > 6 THEN
    RAISE EXCEPTION 'Copies of each is 1 to 6.';
  END IF;
  NEW.first_number := NULL;
  NEW.last_number := NULL;
  NEW.printed_by := auth.uid();
  NEW.printed_by_name := public.box_sticker_caller_name();
  NEW.printed_at := now();
  RETURN NEW;
END;
$fn$;
COMMENT ON FUNCTION public.sticker_runs_stamp() IS 'Stickers before boxes (#329): BEFORE INSERT on sticker_runs. Refuses in words anyone who may not print a run, and fills who and when from the session.';
REVOKE EXECUTE ON FUNCTION public.sticker_runs_stamp() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sticker_runs_stamp() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sticker_runs_stamp() FROM authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. Stickers.
-- ---------------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.box_stickers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.sticker_runs(id) ON DELETE RESTRICT,
  number integer NOT NULL CHECK (number >= 1),
  code text GENERATED ALWAYS AS (upper(left(replace(id::text, '-', ''), 8))) STORED,
  container_id uuid REFERENCES public.job_containers(id) ON DELETE SET NULL,
  placed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  placed_by_name text NOT NULL DEFAULT '' CHECK (length(placed_by_name) <= 120),
  placed_at timestamptz,
  lost_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS box_stickers_number_key ON public.box_stickers (number);
CREATE UNIQUE INDEX IF NOT EXISTS box_stickers_code_key ON public.box_stickers (code);
CREATE INDEX IF NOT EXISTS box_stickers_run_idx ON public.box_stickers (run_id);
CREATE INDEX IF NOT EXISTS box_stickers_container_idx ON public.box_stickers (container_id) WHERE container_id IS NOT NULL;
COMMENT ON TABLE public.box_stickers IS 'Stickers before boxes (#329): a printed sticker. It points at one box (container_id) or at nothing yet (blank). It changes only through a box_sticker_events row.';
COMMENT ON COLUMN public.box_stickers.number IS 'What a person reads, printed 0147: one company-wide count from box_sticker_number_seq, never given out twice.';
COMMENT ON COLUMN public.box_stickers.code IS 'The id''s first eight hex characters in capitals, by job_containers.code''s rule: what the QR carries (prts.co/b/<code>). No box carries the same code: the mint tries again, and a new box is refused one a sticker holds.';
COMMENT ON COLUMN public.box_stickers.container_id IS 'The box the sticker is on. Null while blank, and null again when its box''s row is deleted.';
COMMENT ON COLUMN public.box_stickers.lost_at IS 'When someone marked the sticker lost. It keeps the box it was on, and no longer opens it.';

-- A sticker with no box has no placer. Fires on the foreign key''s own SET NULL too.
CREATE OR REPLACE FUNCTION public.box_stickers_keep_whole()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF NEW.container_id IS NULL THEN
    NEW.placed_by := NULL;
    NEW.placed_by_name := '';
    NEW.placed_at := NULL;
  END IF;
  RETURN NEW;
END;
$fn$;
COMMENT ON FUNCTION public.box_stickers_keep_whole() IS 'Stickers before boxes (#329): BEFORE UPDATE OF container_id on box_stickers. A sticker that leaves its box, or whose box is deleted, loses who put it there.';
CREATE OR REPLACE TRIGGER box_stickers_keep_whole BEFORE UPDATE OF container_id ON public.box_stickers
  FOR EACH ROW EXECUTE FUNCTION public.box_stickers_keep_whole();

-- The run's stickers, made in the statement that inserts the run and after its policy has passed, so a refused
-- run takes no number. The lock makes the block unbroken; a code a box or a sticker already carries is cut again.
CREATE OR REPLACE FUNCTION public.sticker_runs_mint()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_first integer;
  v_last integer;
  v_n integer;
  v_id uuid;
  v_code text;
  v_tries integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('box_sticker_numbers'));
  v_first := nextval('public.box_sticker_number_seq');
  v_last := v_first + NEW.sticker_count - 1;
  PERFORM setval('public.box_sticker_number_seq', v_last);
  FOR v_n IN v_first..v_last LOOP
    v_tries := 0;
    LOOP
      v_id := gen_random_uuid();
      v_code := upper(left(replace(v_id::text, '-', ''), 8));
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.job_containers c WHERE c.code = v_code)
            AND NOT EXISTS (SELECT 1 FROM public.box_stickers s WHERE s.code = v_code);
      v_tries := v_tries + 1;
      IF v_tries >= 20 THEN
        RAISE EXCEPTION 'No free code for sticker %. Print the run again.', public.box_sticker_number_words(v_n);
      END IF;
    END LOOP;
    INSERT INTO public.box_stickers (id, run_id, number) VALUES (v_id, NEW.id, v_n);
  END LOOP;
  UPDATE public.sticker_runs SET first_number = v_first, last_number = v_last WHERE id = NEW.id;
  RETURN NULL;
END;
$fn$;
COMMENT ON FUNCTION public.sticker_runs_mint() IS 'Stickers before boxes (#329): AFTER INSERT on sticker_runs. Takes the run''s block of numbers under a lock and makes its box_stickers rows, cutting a new id for any code a box or a sticker already carries.';
REVOKE EXECUTE ON FUNCTION public.sticker_runs_mint() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sticker_runs_mint() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sticker_runs_mint() FROM authenticated;

CREATE OR REPLACE TRIGGER sticker_runs_stamp BEFORE INSERT ON public.sticker_runs
  FOR EACH ROW EXECUTE FUNCTION public.sticker_runs_stamp();
CREATE OR REPLACE TRIGGER sticker_runs_mint AFTER INSERT ON public.sticker_runs
  FOR EACH ROW EXECUTE FUNCTION public.sticker_runs_mint();

-- The other half of one code, one thing: a new box whose id would cut a code a sticker already holds is refused,
-- and the app makes the box again under a new id. Four billion to one a box, so nobody will meet it.
CREATE OR REPLACE FUNCTION public.job_containers_code_free()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF EXISTS (SELECT 1 FROM public.box_stickers s WHERE s.code = upper(left(replace(NEW.id::text, '-', ''), 8))) THEN
    RAISE EXCEPTION 'A sticker already carries this box''s code. Add the box again.' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$fn$;
COMMENT ON FUNCTION public.job_containers_code_free() IS 'Stickers before boxes (#329): BEFORE INSERT on job_containers. Refuses a box whose code a sticker already carries, so a scanned code names one thing.';
REVOKE EXECUTE ON FUNCTION public.job_containers_code_free() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.job_containers_code_free() FROM anon;
REVOKE EXECUTE ON FUNCTION public.job_containers_code_free() FROM authenticated;
CREATE OR REPLACE TRIGGER job_containers_code_free BEFORE INSERT ON public.job_containers
  FOR EACH ROW EXECUTE FUNCTION public.job_containers_code_free();

-- ---------------------------------------------------------------------------------------------------------------
-- 3. Events: the door a sticker changes through.
-- ---------------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.box_sticker_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sticker_id uuid NOT NULL REFERENCES public.box_stickers(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('placed', 'moved', 'taken_off', 'lost')),
  from_container_id uuid REFERENCES public.job_containers(id) ON DELETE SET NULL,
  to_container_id uuid REFERENCES public.job_containers(id) ON DELETE SET NULL,
  by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '' CHECK (length(by_name) <= 120),
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS box_sticker_events_sticker_idx ON public.box_sticker_events (sticker_id, at);
CREATE INDEX IF NOT EXISTS box_sticker_events_to_idx ON public.box_sticker_events (to_container_id) WHERE to_container_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS box_sticker_events_from_idx ON public.box_sticker_events (from_container_id) WHERE from_container_id IS NOT NULL;
COMMENT ON TABLE public.box_sticker_events IS 'Stickers before boxes (#329): what happened to a sticker, insert only. placed (blank onto a box), moved (one box to another), taken_off (blank again), lost. Inserting a row is the act: the row is judged by the caller''s own RLS and a trigger then moves the sticker.';

-- BEFORE INSERT: hold the sticker, read where it truly is, refuse an act that does not fit, and fill the facts no
-- client names for itself. It runs before the INSERT policy, so the policy judges the boxes the database filled in.
-- P0STK means the sticker is not where the caller thought: place_sticker answers that as a verdict, not an error.
CREATE OR REPLACE FUNCTION public.box_sticker_events_judge()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  s public.box_stickers%ROWTYPE;
  c public.job_containers%ROWTYPE;
  v_words text;
BEGIN
  SELECT * INTO s FROM public.box_stickers WHERE id = NEW.sticker_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That sticker is not one the app printed.';
  END IF;
  v_words := public.box_sticker_number_words(s.number);
  NEW.by_user_id := auth.uid();
  NEW.by_name := public.box_sticker_caller_name();
  NEW.at := now();

  IF s.lost_at IS NOT NULL THEN
    RAISE EXCEPTION 'Sticker % was marked lost.', v_words USING ERRCODE = 'P0STK';
  END IF;
  IF NEW.kind = 'placed' THEN
    IF s.container_id IS NOT NULL THEN
      RAISE EXCEPTION 'Sticker % is already on a box.', v_words USING ERRCODE = 'P0STK';
    END IF;
    NEW.from_container_id := NULL;
  ELSIF NEW.kind = 'moved' THEN
    IF s.container_id IS NULL THEN
      RAISE EXCEPTION 'Sticker % is not on a box yet.', v_words USING ERRCODE = 'P0STK';
    END IF;
    IF NEW.to_container_id IS NOT NULL AND s.container_id = NEW.to_container_id THEN
      RAISE EXCEPTION 'Sticker % is already on that box.', v_words USING ERRCODE = 'P0STK';
    END IF;
    NEW.from_container_id := s.container_id;
  ELSIF NEW.kind IN ('taken_off', 'lost') THEN
    IF s.container_id IS NULL THEN
      RAISE EXCEPTION 'Sticker % is not on a box yet.', v_words USING ERRCODE = 'P0STK';
    END IF;
    NEW.from_container_id := s.container_id;
    NEW.to_container_id := NULL;
  ELSE
    RAISE EXCEPTION 'A sticker is placed, moved, taken off or marked lost.';
  END IF;

  IF NEW.kind IN ('placed', 'moved') THEN
    IF NEW.to_container_id IS NULL THEN
      RAISE EXCEPTION 'Name the box the sticker goes on.';
    END IF;
    SELECT * INTO c FROM public.job_containers WHERE id = NEW.to_container_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That box is not in the app.';
    END IF;
    IF c.kind = 'unsorted' THEN
      RAISE EXCEPTION 'A sticker goes on a cage, a box or a pile. Unsorted takes none.';
    END IF;
    IF c.retired_at IS NOT NULL THEN
      RAISE EXCEPTION 'That box was retired. Bring it back first.';
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;
COMMENT ON FUNCTION public.box_sticker_events_judge() IS 'Stickers before boxes (#329): BEFORE INSERT on box_sticker_events. Locks the sticker, refuses an act that does not fit where it is (SQLSTATE P0STK), fills the box it left, who and when.';
REVOKE EXECUTE ON FUNCTION public.box_sticker_events_judge() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.box_sticker_events_judge() FROM anon;
REVOKE EXECUTE ON FUNCTION public.box_sticker_events_judge() FROM authenticated;

-- AFTER INSERT: the row passed its policy, so the sticker follows it.
CREATE OR REPLACE FUNCTION public.box_sticker_events_apply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF NEW.kind IN ('placed', 'moved') THEN
    UPDATE public.box_stickers
       SET container_id = NEW.to_container_id, placed_by = NEW.by_user_id, placed_by_name = NEW.by_name, placed_at = NEW.at
     WHERE id = NEW.sticker_id;
  ELSIF NEW.kind = 'taken_off' THEN
    UPDATE public.box_stickers SET container_id = NULL WHERE id = NEW.sticker_id;
  ELSIF NEW.kind = 'lost' THEN
    UPDATE public.box_stickers SET lost_at = NEW.at WHERE id = NEW.sticker_id;
  END IF;
  RETURN NULL;
END;
$fn$;
COMMENT ON FUNCTION public.box_sticker_events_apply() IS 'Stickers before boxes (#329): AFTER INSERT on box_sticker_events. Moves the sticker to match the row that was just allowed.';
REVOKE EXECUTE ON FUNCTION public.box_sticker_events_apply() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.box_sticker_events_apply() FROM anon;
REVOKE EXECUTE ON FUNCTION public.box_sticker_events_apply() FROM authenticated;

CREATE OR REPLACE TRIGGER box_sticker_events_judge BEFORE INSERT ON public.box_sticker_events
  FOR EACH ROW EXECUTE FUNCTION public.box_sticker_events_judge();
CREATE OR REPLACE TRIGGER box_sticker_events_apply AFTER INSERT ON public.box_sticker_events
  FOR EACH ROW EXECUTE FUNCTION public.box_sticker_events_apply();

-- ---------------------------------------------------------------------------------------------------------------
-- 4. A box's names.
-- ---------------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.job_container_names (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id uuid NOT NULL REFERENCES public.job_containers(id) ON DELETE CASCADE,
  old_label text NOT NULL,
  new_label text NOT NULL,
  by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '' CHECK (length(by_name) <= 120),
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_container_names_container_idx ON public.job_container_names (container_id, at);
COMMENT ON TABLE public.job_container_names IS 'Stickers before boxes (#329): a box''s name changed, insert only: the old name, the new one, who and when. Written by a trigger on job_containers.label and by nothing else.';

CREATE OR REPLACE FUNCTION public.job_containers_keep_names()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  INSERT INTO public.job_container_names (container_id, old_label, new_label, by_user_id, by_name)
  VALUES (NEW.id, OLD.label, NEW.label, auth.uid(), public.box_sticker_caller_name());
  RETURN NULL;
END;
$fn$;
COMMENT ON FUNCTION public.job_containers_keep_names() IS 'Stickers before boxes (#329): AFTER UPDATE OF label on job_containers. Keeps the old name, the new name, who and when, for every client at once.';
REVOKE EXECUTE ON FUNCTION public.job_containers_keep_names() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.job_containers_keep_names() FROM anon;
REVOKE EXECUTE ON FUNCTION public.job_containers_keep_names() FROM authenticated;
CREATE OR REPLACE TRIGGER job_containers_keep_names AFTER UPDATE OF label ON public.job_containers
  FOR EACH ROW WHEN (OLD.label IS DISTINCT FROM NEW.label) EXECUTE FUNCTION public.job_containers_keep_names();

-- ---------------------------------------------------------------------------------------------------------------
-- 5. The reads a scan needs.
-- ---------------------------------------------------------------------------------------------------------------

-- One sticker's facts by its id. A definer on purpose: the answer is the little a person holding the sticker
-- needs before they know its job, and the caller's own RLS would hide a sticker on a box of a job they are not on,
-- which is exactly when they need to read "Marcus put 0147 on R76". The id is a stronger key than the code.
CREATE OR REPLACE FUNCTION public.box_sticker_facts(p_sticker_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT jsonb_build_object(
    'id', s.id,
    'number', s.number,
    'code', s.code,
    'state', CASE WHEN s.lost_at IS NOT NULL THEN 'lost' WHEN s.container_id IS NOT NULL THEN 'on_box' ELSE 'blank' END,
    'container_id', s.container_id,
    'container_label', c.label,
    'container_kind', c.kind,
    'container_retired_at', c.retired_at,
    'job_id', c.job_id,
    'placed_by_name', NULLIF(s.placed_by_name, ''),
    'placed_at', s.placed_at,
    'lost_at', s.lost_at,
    'run_id', s.run_id,
    'run_job_id', r.job_id
  )
  FROM public.box_stickers s
  JOIN public.sticker_runs r ON r.id = s.run_id
  LEFT JOIN public.job_containers c ON c.id = s.container_id
  WHERE s.id = p_sticker_id
$fn$;
COMMENT ON FUNCTION public.box_sticker_facts(uuid) IS 'Stickers before boxes (#329): one sticker by its id. Its number, blank / on_box / lost, the box it is on with its name, kind and job, who put it there and when, and the job its run was printed for. Null when there is none. Signed-in callers only.';
REVOKE EXECUTE ON FUNCTION public.box_sticker_facts(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.box_sticker_facts(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.box_sticker_facts(uuid) TO authenticated, service_role;

-- The same by the code a scan reads, with or without its dash. Null when no sticker carries it.
CREATE OR REPLACE FUNCTION public.sticker_by_code(p_code text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT public.box_sticker_facts(s.id)
  FROM public.box_stickers s
  WHERE s.code = upper(regexp_replace(COALESCE(p_code, ''), '[^0-9A-Za-z]', '', 'g'))
$fn$;
COMMENT ON FUNCTION public.sticker_by_code(text) IS 'Stickers before boxes (#329): what a scan needs before it knows the job. The sticker a code names, as box_sticker_facts answers it, or null. The code is the capability; signed-in callers only (signed out, box-read answers less).';
REVOKE EXECUTE ON FUNCTION public.sticker_by_code(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sticker_by_code(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.sticker_by_code(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 6. The two writes a screen calls. Both SECURITY INVOKER on purpose: on_site_can_touch_job reads the ledger under
--    the caller's own RLS, and inside a definer it would say yes to every job.
-- ---------------------------------------------------------------------------------------------------------------

-- A run and its stickers in one call. The rules are the table's own (the stamp trigger, the INSERT policy, the mint
-- trigger); this adds the reach refusal in words and hands back what the print window draws.
CREATE OR REPLACE FUNCTION public.mint_sticker_run(p_job_id uuid, p_count integer, p_copies integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_id uuid := gen_random_uuid();
  v_run jsonb;
  v_stickers jsonb;
BEGIN
  IF p_job_id IS NULL OR NOT public.on_site_can_touch_job(p_job_id) THEN
    RAISE EXCEPTION 'That job is not one you can reach.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.sticker_runs (id, job_id, sticker_count, copies) VALUES (v_id, p_job_id, p_count, COALESCE(p_copies, 1));
  SELECT to_jsonb(r) INTO v_run
  FROM (
    SELECT id, job_id, sticker_count, first_number, last_number, copies, printed_by, printed_by_name, printed_at
    FROM public.sticker_runs WHERE id = v_id
  ) r;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'number', s.number, 'code', s.code) ORDER BY s.number), '[]'::jsonb)
    INTO v_stickers
  FROM public.box_stickers s WHERE s.run_id = v_id;
  RETURN jsonb_build_object('run', v_run, 'stickers', v_stickers);
END;
$fn$;
COMMENT ON FUNCTION public.mint_sticker_run(uuid, integer, integer) IS 'Stickers before boxes (#329): print a run. Inserts the sticker_runs row as the caller (the office, a primary or a superintendent, on a job they can reach) and answers { run, stickers: [{ id, number, code }] } in number order. SECURITY INVOKER.';
REVOKE EXECUTE ON FUNCTION public.mint_sticker_run(uuid, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mint_sticker_run(uuid, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.mint_sticker_run(uuid, integer, integer) TO authenticated;

-- A blank sticker onto a box. With p_job_id it makes the box first (named by the sticker's number when no name is
-- typed) and places the sticker in the same transaction; without it the sticker goes on the known box
-- p_container_id. Only a blank sticker is taken: one that is on a box or lost comes back as { ok: false, sticker }
-- for the screen to say who and when, and a new box made a moment before is undone. The same placing sent twice
-- answers ok the second time, so a phone that lost its signal may send again.
CREATE OR REPLACE FUNCTION public.place_sticker(
  p_sticker_id uuid,
  p_container_id uuid DEFAULT NULL,
  p_job_id uuid DEFAULT NULL,
  p_label text DEFAULT NULL,
  p_kind text DEFAULT 'cage',
  p_where_note text DEFAULT '',
  p_place_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $fn$
DECLARE
  v_facts jsonb;
  v_id uuid;
  v_label text;
  v_kind text := COALESCE(NULLIF(btrim(p_kind), ''), 'cage');
  v_created boolean := false;
  v_constraint text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to put a sticker on a box.' USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot put a sticker on a box.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot put a sticker on a box.' USING ERRCODE = '42501';
  END IF;

  v_facts := public.box_sticker_facts(p_sticker_id);
  IF v_facts IS NULL THEN
    RAISE EXCEPTION 'That sticker is not one the app printed.';
  END IF;
  -- Twice is once.
  IF v_facts ->> 'state' = 'on_box' AND p_container_id IS NOT NULL AND (v_facts ->> 'container_id')::uuid = p_container_id THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'created', false, 'container_id', p_container_id, 'sticker', v_facts);
  END IF;
  IF v_facts ->> 'state' <> 'blank' THEN
    RETURN jsonb_build_object('ok', false, 'sticker', v_facts);
  END IF;

  BEGIN
    IF p_job_id IS NOT NULL THEN
      IF NOT public.on_site_can_touch_job(p_job_id) THEN
        RAISE EXCEPTION 'That job is not one you can reach. Ask the office to add you to its team.' USING ERRCODE = '42501';
      END IF;
      v_label := regexp_replace(btrim(COALESCE(p_label, '')), '\s+', ' ', 'g');
      IF v_label = '' THEN
        v_label := public.box_sticker_number_words((v_facts ->> 'number')::integer);
      END IF;
      IF length(v_label) > 24 THEN
        RAISE EXCEPTION 'A box''s name is 24 characters at most.';
      END IF;
      IF v_kind NOT IN ('cage', 'box', 'loose') THEN
        RAISE EXCEPTION 'A sticker goes on a cage, a box or a pile.';
      END IF;
      IF p_place_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.job_places p WHERE p.id = p_place_id AND p.job_id = p_job_id) THEN
        RAISE EXCEPTION 'That place is not on this job.';
      END IF;
      v_id := COALESCE(p_container_id, gen_random_uuid());
      BEGIN
        INSERT INTO public.job_containers (id, job_id, label, kind, where_note, place_id)
        VALUES (v_id, p_job_id, v_label, v_kind, left(btrim(COALESCE(p_where_note, '')), 120), p_place_id);
      EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint = 'job_containers_live_label_key' THEN
          RAISE EXCEPTION 'A box on this job is already named %. Type another name.', v_label USING ERRCODE = '23505';
        END IF;
        RAISE;
      END;
      v_created := true;
    ELSE
      IF p_container_id IS NULL THEN
        RAISE EXCEPTION 'Name the box, or the job a new box goes on.';
      END IF;
      -- Under the caller's own RLS: a box on a job they cannot touch is not there for them.
      SELECT c.id INTO v_id FROM public.job_containers c WHERE c.id = p_container_id;
      IF v_id IS NULL THEN
        RAISE EXCEPTION 'That box is not on a job you can reach.' USING ERRCODE = '42501';
      END IF;
    END IF;
    INSERT INTO public.box_sticker_events (sticker_id, kind, to_container_id) VALUES (p_sticker_id, 'placed', v_id);
  EXCEPTION WHEN SQLSTATE 'P0STK' THEN
    -- Someone took the sticker between the read and the write. This block's new box is undone with it.
    RETURN jsonb_build_object('ok', false, 'sticker', public.box_sticker_facts(p_sticker_id));
  END;

  RETURN jsonb_build_object('ok', true, 'already', false, 'created', v_created, 'container_id', v_id, 'sticker', public.box_sticker_facts(p_sticker_id));
END;
$fn$;
COMMENT ON FUNCTION public.place_sticker(uuid, uuid, uuid, text, text, text, uuid) IS 'Stickers before boxes (#329): put a blank sticker on a box. p_job_id makes a new box there first (p_container_id its id when the client made one, p_label its name or the sticker''s number); without it the sticker goes on the known box p_container_id. One transaction, a blank sticker only: otherwise { ok: false, sticker } says where it is. SECURITY INVOKER, so the gate and every policy judge the caller.';
REVOKE EXECUTE ON FUNCTION public.place_sticker(uuid, uuid, uuid, text, text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.place_sticker(uuid, uuid, uuid, text, text, text, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.place_sticker(uuid, uuid, uuid, text, text, text, uuid) TO authenticated;

-- ---------------------------------------------------------------------------------------------------------------
-- 7. RLS.
-- ---------------------------------------------------------------------------------------------------------------

-- Runs: read by whoever may touch the run's job; an orphaned run by the office. Printed by the three roles on a
-- job they can reach. The one column a client changes is job_id (the unused ones moved to another job, a later
-- press): the same three roles, from a job they reach to a job they reach.
ALTER TABLE public.sticker_runs ENABLE ROW LEVEL SECURITY;
REVOKE UPDATE ON public.sticker_runs FROM anon;
REVOKE UPDATE ON public.sticker_runs FROM authenticated;
GRANT UPDATE (job_id) ON public.sticker_runs TO authenticated;
DROP POLICY IF EXISTS sticker_runs_select ON public.sticker_runs;
CREATE POLICY sticker_runs_select ON public.sticker_runs FOR SELECT TO authenticated
  USING (public.on_site_can_touch_job(job_id) OR (job_id IS NULL AND public.is_office_staff()));
DROP POLICY IF EXISTS sticker_runs_insert ON public.sticker_runs;
CREATE POLICY sticker_runs_insert ON public.sticker_runs FOR INSERT TO authenticated
  WITH CHECK (public.sticker_can_mint() AND printed_by = auth.uid() AND public.on_site_can_touch_job(job_id));
DROP POLICY IF EXISTS sticker_runs_update ON public.sticker_runs;
CREATE POLICY sticker_runs_update ON public.sticker_runs FOR UPDATE TO authenticated
  USING (public.sticker_can_mint() AND (public.on_site_can_touch_job(job_id) OR (job_id IS NULL AND public.is_office_staff())))
  WITH CHECK (public.sticker_can_mint() AND public.on_site_can_touch_job(job_id));

-- Stickers: one on a box follows its box's job; a blank one follows its run's job. No client inserts, updates or
-- deletes a sticker: the mint trigger makes it and the events trigger moves it.
ALTER TABLE public.box_stickers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS box_stickers_select ON public.box_stickers;
CREATE POLICY box_stickers_select ON public.box_stickers FOR SELECT TO authenticated
  USING (
    (container_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.job_containers c WHERE c.id = container_id AND public.on_site_can_touch_job(c.job_id)))
    OR (container_id IS NULL AND EXISTS (
      SELECT 1 FROM public.sticker_runs r
      WHERE r.id = run_id AND (public.on_site_can_touch_job(r.job_id) OR (r.job_id IS NULL AND public.is_office_staff()))
    ))
  );

-- Events: read by whoever may touch a box the row names. Inserted in the caller's own name by whoever may touch
-- every box it names, after the judge trigger has filled the box the sticker left.
ALTER TABLE public.box_sticker_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS box_sticker_events_select ON public.box_sticker_events;
CREATE POLICY box_sticker_events_select ON public.box_sticker_events FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.job_containers c WHERE c.id = from_container_id AND public.on_site_can_touch_job(c.job_id))
    OR EXISTS (SELECT 1 FROM public.job_containers c WHERE c.id = to_container_id AND public.on_site_can_touch_job(c.job_id))
  );
DROP POLICY IF EXISTS box_sticker_events_insert ON public.box_sticker_events;
CREATE POLICY box_sticker_events_insert ON public.box_sticker_events FOR INSERT TO authenticated
  WITH CHECK (
    by_user_id = auth.uid()
    AND (from_container_id IS NOT NULL OR to_container_id IS NOT NULL)
    AND (from_container_id IS NULL OR EXISTS (SELECT 1 FROM public.job_containers c WHERE c.id = from_container_id AND public.on_site_can_touch_job(c.job_id)))
    AND (to_container_id IS NULL OR EXISTS (SELECT 1 FROM public.job_containers c WHERE c.id = to_container_id AND public.on_site_can_touch_job(c.job_id)))
  );

-- Names: read with the box. Written by the trigger alone.
ALTER TABLE public.job_container_names ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS job_container_names_select ON public.job_container_names;
CREATE POLICY job_container_names_select ON public.job_container_names FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.job_containers c WHERE c.id = container_id AND public.on_site_can_touch_job(c.job_id)));

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md, DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
