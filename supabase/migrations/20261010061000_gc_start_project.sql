SET lock_timeout = '3s';

-- GC mode, the Board's B6-c-i (to-dos/gc-mode/mockups/board-b6c.md on spike/gc-mode): Start and Start anyway
-- (startProject). A won project goes to building on the company's day. Start anyway keeps who pressed it, why, and
-- what was still missing as the office's screen listed it: the database trusts that list (call A), since Start
-- signs nothing and moves no money. It sends nothing; the client tells the trades after it (gc-trade-email, kind
-- start), as gc_invite_companies leaves its sends to B4's window. The schedule keeps its own baseline at its first
-- change after Start (gc_schedule_keep_start, dated started_on), so Start owes it nothing. One function, no table.
CREATE OR REPLACE FUNCTION public.gc_start_project(p_project_id uuid, p_anyway jsonb DEFAULT NULL)
RETURNS date
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_job record;
  v_reason text := btrim(coalesce(p_anyway ->> 'reason', ''));
  v_missing text[] := '{}';
  v_today date := public.app_today();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  -- gc_projects' read-only blocks and the twin fence refuse the write too; this says it in words first.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot start a job.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot start a job.' USING ERRCODE = '42501';
  END IF;
  -- Who may Start (call B): a dev until award's door, the owner's call W. gc_projects is the office's (New
  -- project's door), so the refusal is said here, before any write, rather than left to its policy.
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'Only a dev starts a job while GC mode is built.' USING ERRCODE = 'P0001';
  END IF;

  SELECT g.stage, g.lost_on, g.started_on, p.name INTO v_job
  FROM public.gc_projects g
  JOIN public.projects p ON p.id = g.project_id
  WHERE g.project_id = p_project_id
  FOR UPDATE OF g;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That GC project is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v_job.lost_on IS NOT NULL THEN
    RAISE EXCEPTION '% is lost. Bring it back before you start it.', v_job.name USING ERRCODE = 'P0001';
  END IF;
  IF v_job.started_on IS NOT NULL OR v_job.stage IN ('building', 'closed') THEN
    RAISE EXCEPTION '% is already started.', v_job.name USING ERRCODE = 'P0001';
  END IF;
  IF v_job.stage <> 'buyout' THEN
    RAISE EXCEPTION '% is still bidding. Press We won this first.', v_job.name USING ERRCODE = 'P0001';
  END IF;

  -- Start anyway (the owner, 2026-10-04, question 7): what was missing, each line as the office's screen said it,
  -- in its order, blanks dropped. Anyway with nothing missing is a plain Start, as the prototype's reducer has it.
  IF p_anyway IS NOT NULL AND jsonb_typeof(p_anyway) <> 'null' THEN
    IF jsonb_typeof(p_anyway) <> 'object' OR coalesce(jsonb_typeof(p_anyway -> 'missing'), 'array') <> 'array' THEN
      RAISE EXCEPTION 'Start anyway needs why and what is missing.' USING ERRCODE = 'P0001';
    END IF;
    v_missing := ARRAY(
      SELECT btrim(e.line)
      FROM jsonb_array_elements_text(coalesce(p_anyway -> 'missing', '[]'::jsonb)) WITH ORDINALITY AS e(line, n)
      WHERE btrim(e.line) <> ''
      ORDER BY e.n);
    IF cardinality(v_missing) > 0 THEN
      IF v_reason = '' THEN
        RAISE EXCEPTION 'Say why it starts before everything is in.' USING ERRCODE = 'P0001';
      END IF;
      IF length(v_reason) > 500 THEN
        RAISE EXCEPTION 'Say why in 500 characters or fewer.' USING ERRCODE = 'P0001';
      END IF;
      IF cardinality(v_missing) > 60 OR EXISTS (SELECT 1 FROM unnest(v_missing) AS m(line) WHERE length(m.line) > 300) THEN
        RAISE EXCEPTION 'That list of what is missing is too long.' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  UPDATE public.gc_projects
  SET stage = 'building',
      started_on = v_today,
      started_anyway_by = CASE WHEN cardinality(v_missing) > 0 THEN v_uid END,
      started_anyway_reason = CASE WHEN cardinality(v_missing) > 0 THEN v_reason END,
      started_anyway_missing = CASE WHEN cardinality(v_missing) > 0 THEN v_missing END
  WHERE project_id = p_project_id;
  RETURN v_today;
END;
$$;

COMMENT ON FUNCTION public.gc_start_project(uuid, jsonb) IS
  'GC mode (B6-c-i): Start on Get started (startProject). A won project in buyout goes to building on app_today(); Start anyway, {reason, missing[]}, keeps who, why and what was missing, the office''s list as its screen said it. Sends nothing. A dev only until award''s door. SECURITY INVOKER.';

REVOKE ALL ON FUNCTION public.gc_start_project(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gc_start_project(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.gc_start_project(uuid, jsonb) TO authenticated;
