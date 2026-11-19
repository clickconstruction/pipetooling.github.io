SET lock_timeout = '3s';

-- ===============================================================================================================
-- Materials on site: an answer to a press.
--
-- The ledger is append only: a press that should not stand could only be pressed against. A dev now answers a
-- press one of two ways, each with a reason, and nothing is deleted.
--   taken back   the press did not happen or should not stand. It is closed to every ordinary read, so every sum
--                reads as if it was never made, and History shows it struck through from a read of its own.
--   marked       the press happened and was not allowed. The numbers keep it. The mark is the record.
-- An answer is withdrawn with a reason, never deleted, and a press has one live answer at a time.
--
--   job_movement_answers                    one row an answer: the press, which answer, why, who, and its withdrawal
--   job_material_movements.taken_back_at    the live switch: set while a taken-back answer stands on the row
--   job_material_movements_not_taken_back   RESTRICTIVE SELECT on the ledger: a row taken back is not read
--   on_site_taken_back_rows(uuid[])         the office's read of the rows taken back, for History
--
-- Why a column and a policy, not a rule in every sum: the screens' kernel, the database's job summary and the dev
-- seat each sum the ledger under the caller's own RLS, so one policy closes a row to all of them at once and no
-- two screens can disagree. The functions that run as their owner and touch the ledger carry rows between jobs
-- or rename them, and those must carry a taken-back row too, which they do: they never see the policy.
-- ===============================================================================================================

ALTER TABLE public.job_material_movements ADD COLUMN IF NOT EXISTS taken_back_at timestamptz;
COMMENT ON COLUMN public.job_material_movements.taken_back_at IS 'Set while a taken-back answer stands on the row (job_movement_answers): the row is then closed to every ordinary read by job_material_movements_not_taken_back. Written by job_movement_answers_switch and by nothing else.';

-- A press cannot arrive already taken back: only an answer sets the switch.
CREATE OR REPLACE FUNCTION public.job_material_movements_arrive_standing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.taken_back_at := NULL;
  RETURN NEW;
END;
$fn$;
COMMENT ON FUNCTION public.job_material_movements_arrive_standing() IS 'BEFORE INSERT on job_material_movements: a new press stands, whatever the client sent in taken_back_at.';
CREATE OR REPLACE TRIGGER job_material_movements_arrive_standing BEFORE INSERT ON public.job_material_movements
  FOR EACH ROW EXECUTE FUNCTION public.job_material_movements_arrive_standing();

-- ---------------------------------------------------------------------------------------------------------------
-- 1. The answers.
-- ---------------------------------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.job_movement_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id uuid NOT NULL REFERENCES public.job_material_movements(id) ON DELETE CASCADE,
  answer text NOT NULL CHECK (answer IN ('taken_back', 'marked')),
  why text NOT NULL CHECK (length(btrim(why)) BETWEEN 1 AND 500),
  by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '' CHECK (length(by_name) <= 120),
  at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  withdrawn_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  withdrawn_by_name text NOT NULL DEFAULT '' CHECK (length(withdrawn_by_name) <= 120),
  withdrawn_why text NOT NULL DEFAULT '' CHECK (length(withdrawn_why) <= 500)
);
-- One live answer a press. A withdrawn one stays as the record that it was given.
CREATE UNIQUE INDEX IF NOT EXISTS job_movement_answers_live_key ON public.job_movement_answers (movement_id) WHERE withdrawn_at IS NULL;
CREATE INDEX IF NOT EXISTS job_movement_answers_movement_idx ON public.job_movement_answers (movement_id, at);
COMMENT ON TABLE public.job_movement_answers IS 'Materials on site: a dev''s answer to a press. taken_back closes the ledger row to every ordinary read; marked leaves the numbers and records that the press was not allowed. One live answer a press; withdrawn with a reason, never deleted.';

-- Who answered and who withdrew are the caller. An answer's press, kind and reason never change; the one change
-- an answer takes is its withdrawal, once.
CREATE OR REPLACE FUNCTION public.job_movement_answers_stamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.by_user_id := auth.uid();
    NEW.by_name := public.box_sticker_caller_name();
    NEW.at := now();
    NEW.withdrawn_at := NULL;
    NEW.withdrawn_by := NULL;
    NEW.withdrawn_by_name := '';
    NEW.withdrawn_why := '';
    RETURN NEW;
  END IF;
  IF OLD.withdrawn_at IS NOT NULL THEN
    RAISE EXCEPTION 'This answer was withdrawn. Give a new one instead.' USING ERRCODE = 'P0001';
  END IF;
  NEW.movement_id := OLD.movement_id;
  NEW.answer := OLD.answer;
  NEW.why := OLD.why;
  NEW.by_user_id := OLD.by_user_id;
  NEW.by_name := OLD.by_name;
  NEW.at := OLD.at;
  IF NEW.withdrawn_at IS NULL THEN
    NEW.withdrawn_by := NULL;
    NEW.withdrawn_by_name := '';
    NEW.withdrawn_why := '';
    RETURN NEW;
  END IF;
  IF length(btrim(COALESCE(NEW.withdrawn_why, ''))) = 0 THEN
    RAISE EXCEPTION 'Say why the answer is withdrawn.' USING ERRCODE = 'P0001';
  END IF;
  NEW.withdrawn_at := now();
  NEW.withdrawn_by := auth.uid();
  NEW.withdrawn_by_name := public.box_sticker_caller_name();
  RETURN NEW;
END;
$fn$;
COMMENT ON FUNCTION public.job_movement_answers_stamp() IS 'BEFORE INSERT OR UPDATE on job_movement_answers: who answered and who withdrew are the caller, the press, the answer and its reason never change, a withdrawal needs its reason, and a withdrawn answer is closed.';
REVOKE EXECUTE ON FUNCTION public.job_movement_answers_stamp() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.job_movement_answers_stamp() FROM anon;
REVOKE EXECUTE ON FUNCTION public.job_movement_answers_stamp() FROM authenticated;
CREATE OR REPLACE TRIGGER job_movement_answers_stamp BEFORE INSERT OR UPDATE ON public.job_movement_answers
  FOR EACH ROW EXECUTE FUNCTION public.job_movement_answers_stamp();

-- The switch follows the answers: set while a live taken-back answer stands on the press, clear otherwise.
CREATE OR REPLACE FUNCTION public.job_movement_answers_switch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  UPDATE public.job_material_movements m
     SET taken_back_at = (
       SELECT a.at FROM public.job_movement_answers a
        WHERE a.movement_id = m.id AND a.answer = 'taken_back' AND a.withdrawn_at IS NULL
     )
   WHERE m.id = NEW.movement_id;
  RETURN NULL;
END;
$fn$;
COMMENT ON FUNCTION public.job_movement_answers_switch() IS 'AFTER INSERT OR UPDATE on job_movement_answers: sets or clears job_material_movements.taken_back_at so the ledger''s policy and the answers never disagree.';
REVOKE EXECUTE ON FUNCTION public.job_movement_answers_switch() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.job_movement_answers_switch() FROM anon;
REVOKE EXECUTE ON FUNCTION public.job_movement_answers_switch() FROM authenticated;
CREATE OR REPLACE TRIGGER job_movement_answers_switch AFTER INSERT OR UPDATE ON public.job_movement_answers
  FOR EACH ROW EXECUTE FUNCTION public.job_movement_answers_switch();

-- Who reads an answer: the office. Who gives one and withdraws one: a dev. Nobody deletes one.
CREATE OR REPLACE FUNCTION public.on_site_reads_answers()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.archived_at IS NULL
      AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role])
  )
$fn$;
COMMENT ON FUNCTION public.on_site_reads_answers() IS 'Materials on site: may the caller read the answers to a press and the rows taken back. The office: dev, master_technician, assistant, controller.';
REVOKE ALL ON FUNCTION public.on_site_reads_answers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.on_site_reads_answers() TO authenticated, service_role;

ALTER TABLE public.job_movement_answers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.job_movement_answers FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.job_movement_answers TO authenticated;
GRANT ALL ON TABLE public.job_movement_answers TO service_role;
DROP POLICY IF EXISTS job_movement_answers_select ON public.job_movement_answers;
CREATE POLICY job_movement_answers_select ON public.job_movement_answers FOR SELECT TO authenticated USING (public.on_site_reads_answers());
DROP POLICY IF EXISTS job_movement_answers_insert ON public.job_movement_answers;
CREATE POLICY job_movement_answers_insert ON public.job_movement_answers FOR INSERT TO authenticated WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS job_movement_answers_update ON public.job_movement_answers;
CREATE POLICY job_movement_answers_update ON public.job_movement_answers FOR UPDATE TO authenticated USING (public.is_dev()) WITH CHECK (public.is_dev());

-- ---------------------------------------------------------------------------------------------------------------
-- 2. A row taken back is not read.
-- ---------------------------------------------------------------------------------------------------------------

DROP POLICY IF EXISTS job_material_movements_not_taken_back ON public.job_material_movements;
CREATE POLICY job_material_movements_not_taken_back ON public.job_material_movements AS RESTRICTIVE FOR SELECT TO authenticated
  USING (taken_back_at IS NULL);

-- The office's read of what was taken back, for History: the rows the policy closes, on the jobs asked for.
CREATE OR REPLACE FUNCTION public.on_site_taken_back_rows(p_job_ids uuid[])
RETURNS SETOF public.job_material_movements
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT m.*
    FROM public.job_material_movements m
   WHERE public.on_site_reads_answers()
     AND m.taken_back_at IS NOT NULL
     AND m.job_id = ANY (COALESCE(p_job_ids, '{}'::uuid[]))
   ORDER BY m.at DESC, m.id
   LIMIT 2000
$fn$;
COMMENT ON FUNCTION public.on_site_taken_back_rows(uuid[]) IS 'Materials on site: the ledger rows taken back on the jobs asked for, newest first, at most 2,000. For the office (on_site_reads_answers); anyone else gets no row. SECURITY DEFINER because the ledger''s own policy closes these rows to every caller.';
REVOKE ALL ON FUNCTION public.on_site_taken_back_rows(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.on_site_taken_back_rows(uuid[]) TO authenticated, service_role;

-- The four fences every CREATE TABLE migration closes with (CLAUDE.md, DB migrations).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
