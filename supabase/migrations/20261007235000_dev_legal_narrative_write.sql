SET lock_timeout = '3s';

-- The dev MCP's narrative verbs (v2.4814): plan_matter_narrative / apply_matter_narrative call this
-- dry-run wrapper over legal_set_narrative (v2.4812), the way plan_hr_entry wraps hr_agent_write. A
-- dev only. The dry run names the matter and what changes, and commits to the narrative's current
-- state (its length and when it was last saved), so an apply against a narrative someone edited
-- since the plan no longer matches and writes nothing. Additive; one function.

CREATE OR REPLACE FUNCTION public.dev_legal_narrative_write(p jsonb, p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_matter public.legal_matters%ROWTYPE;
  v_md text := btrim(COALESCE(p->>'markdown', ''));
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_legal_narrative_write: devs only' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(p->>'matter_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN
    RAISE EXCEPTION 'dev_legal_narrative_write: matter_id is required (a legal_matters.id)';
  END IF;
  SELECT * INTO v_matter FROM public.legal_matters WHERE id = (p->>'matter_id')::uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'dev_legal_narrative_write: matter % not found', p->>'matter_id';
  END IF;
  IF length(v_md) > 40000 THEN
    RAISE EXCEPTION 'dev_legal_narrative_write: the narrative is longer than 40,000 characters';
  END IF;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'matter', jsonb_build_object('id', v_matter.id, 'payer_name', v_matter.payer_name, 'stage', v_matter.stage),
      'before', jsonb_build_object('chars', length(COALESCE(v_matter.narrative_md, '')), 'saved_at', v_matter.narrative_updated_at),
      'after', jsonb_build_object('chars', length(v_md)),
      -- The portal's own stage set (LEGAL_PORTAL_STAGES in _shared/legalStages.ts).
      'firm_reads_it', v_matter.stage IN ('referred', 'demand', 'suit', 'judgment', 'post_judgment', 'payment_plan', 'settled', 'uncollectible', 'dismissed') AND v_matter.closed_at IS NULL AND v_matter.firm_id IS NOT NULL
    );
  END IF;

  v_result := public.legal_set_narrative(v_matter.id, v_md);
  IF v_result ? 'error' THEN
    RAISE EXCEPTION 'dev_legal_narrative_write: %', v_result->>'error';
  END IF;
  RETURN jsonb_build_object('ok', true, 'matter_id', v_matter.id, 'chars', length(v_md));
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.dev_legal_narrative_write(jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_legal_narrative_write(jsonb, boolean) TO authenticated;
