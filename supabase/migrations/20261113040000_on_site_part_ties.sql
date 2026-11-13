SET lock_timeout = '3s';

-- A site's materials on one screen (punch list #330, PR 3): two names a person says are one part.
--
-- The site's screen folds two typed part names into one row only when their words are the same.
-- Two names that are nearly the same (a fitting named with and without its material, a typo) are
-- a person's call: the screen asks "Same part?" once, and the answer is one row here, 'same' or
-- 'different'. Either is kept, so the question is never asked twice.
--
-- A tie is a READING of the finished lines. It never touches job_material_movements: each
-- spelling keeps its own line and its own count in its box, and the screen's row adds the lines.
-- (A count resets its line, so joining two spellings in the ledger would let one count wipe the
-- other's pieces and report them missing.)
--
-- A tie belongs to the site where a person saw both names: a development, or one job that is on
-- no site. '2" 90' is PVC on one site and may be copper on the next, so a tie never travels.
--
-- The keys are the screen's row keys (src/lib/materials/siteRollup.ts, rollKey): 'id:<part id>'
-- for a parts-book part, 'words:<the same-words fold>' for a typed name. PR 4 ties a typed name
-- to a book part with the same row shape.
--
-- Reads: whoever may touch the job, or a job of the development, under the on-site gate.
-- Writes: insert and delete only, by the roles that read the Materials desk with its money.
-- An answer is undone by deleting its row; nothing is ever updated.

CREATE TABLE IF NOT EXISTS public.on_site_part_ties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  development_id uuid REFERENCES public.developments(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs_ledger(id) ON DELETE CASCADE,
  a_key text NOT NULL,
  b_key text NOT NULL,
  a_name text NOT NULL DEFAULT '',
  b_name text NOT NULL DEFAULT '',
  verdict text NOT NULL,
  by_user_id uuid DEFAULT auth.uid(),
  by_name text NOT NULL DEFAULT '',
  at timestamptz NOT NULL DEFAULT now(),
  -- One scope, never both and never neither. Both branches name IS NOT NULL: a CHECK passes on unknown.
  CONSTRAINT on_site_part_ties_scope_check CHECK (
    (development_id IS NOT NULL AND job_id IS NULL) OR (development_id IS NULL AND job_id IS NOT NULL)
  ),
  CONSTRAINT on_site_part_ties_verdict_check CHECK (verdict IN ('same', 'different')),
  CONSTRAINT on_site_part_ties_keys_check CHECK (
    a_key <> b_key AND a_key ~ '^(id|words):.+' AND b_key ~ '^(id|words):.+'
  ),
  CONSTRAINT on_site_part_ties_len_check CHECK (
    char_length(a_key) <= 300 AND char_length(b_key) <= 300
    AND char_length(a_name) <= 200 AND char_length(b_name) <= 200 AND char_length(by_name) <= 120
  )
);

COMMENT ON TABLE public.on_site_part_ties IS
  'A site''s materials (punch list #330): a person''s answer that two part names on one site are the same part or different. Scope is a development or one job on no site. a_key and b_key are the site screen''s row keys (id:<part id> or words:<same-words fold>). A reading of the finished lines only; the on-site ledger is never changed. Insert and delete, never update.';

-- One answer per pair per scope, whichever way round the pair was written.
CREATE UNIQUE INDEX IF NOT EXISTS on_site_part_ties_site_pair_uidx
  ON public.on_site_part_ties (development_id, LEAST(a_key, b_key), GREATEST(a_key, b_key))
  WHERE development_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS on_site_part_ties_job_pair_uidx
  ON public.on_site_part_ties (job_id, LEAST(a_key, b_key), GREATEST(a_key, b_key))
  WHERE job_id IS NOT NULL;

-- Who may read a scope's answers: the on-site gate, on the job itself or on any job of the
-- development the caller can see. SECURITY INVOKER on purpose, as on_site_can_touch_job is: the
-- caller's own jobs_ledger RLS decides which of a development's jobs count.
CREATE OR REPLACE FUNCTION public.on_site_can_read_ties(p_development_id uuid, p_job_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_job_id IS NOT NULL THEN COALESCE(public.on_site_can_touch_job(p_job_id), false)
    WHEN p_development_id IS NOT NULL THEN EXISTS (
      SELECT 1 FROM public.jobs_ledger j
      WHERE j.development_id = p_development_id AND public.on_site_can_touch_job(j.id)
    )
    ELSE false
  END
$$;

COMMENT ON FUNCTION public.on_site_can_read_ties(uuid, uuid) IS
  'Punch list #330: may the caller read the part-name answers of a development or a job. The on-site gate on the job, or on any job of the development the caller''s own RLS shows. SECURITY INVOKER.';

-- Who may answer: the roles that read the Materials desk with its money.
CREATE OR REPLACE FUNCTION public.on_site_can_tie_parts()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'primary'::public.user_role])
  )
$$;

COMMENT ON FUNCTION public.on_site_can_tie_parts() IS
  'Punch list #330: may the caller say two part names on a site are one part. The roles that read the Materials desk with its money: dev, master_technician, assistant, controller, primary. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.on_site_can_read_ties(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.on_site_can_tie_parts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.on_site_can_read_ties(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.on_site_can_tie_parts() TO authenticated, service_role;

ALTER TABLE public.on_site_part_ties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS on_site_part_ties_select ON public.on_site_part_ties;
CREATE POLICY on_site_part_ties_select ON public.on_site_part_ties
  FOR SELECT TO authenticated
  USING (public.on_site_can_read_ties(development_id, job_id));

DROP POLICY IF EXISTS on_site_part_ties_insert ON public.on_site_part_ties;
CREATE POLICY on_site_part_ties_insert ON public.on_site_part_ties
  FOR INSERT TO authenticated
  WITH CHECK (
    by_user_id = (SELECT auth.uid())
    AND public.on_site_can_tie_parts()
    AND public.on_site_can_read_ties(development_id, job_id)
  );

DROP POLICY IF EXISTS on_site_part_ties_delete ON public.on_site_part_ties;
CREATE POLICY on_site_part_ties_delete ON public.on_site_part_ties
  FOR DELETE TO authenticated
  USING (public.on_site_can_tie_parts() AND public.on_site_can_read_ties(development_id, job_id));

REVOKE ALL ON TABLE public.on_site_part_ties FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.on_site_part_ties TO authenticated;
GRANT ALL ON TABLE public.on_site_part_ties TO service_role;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
