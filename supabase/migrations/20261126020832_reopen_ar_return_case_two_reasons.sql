SET lock_timeout = '3s';

-- Presses nothing takes back (punch list #443, row 5): the database holds a replaced case closed, as the client does.
--
-- Reopen… under Closed cases in Accounts Receivable (v2.8566, wider for the office in v2.8588) undoes a close by hand,
-- *settled another way* or *not coming*. The two sibling functions, reopen_ar_stripe_case and
-- reopen_ar_unbanked_check_case, already reopen only such a case and refuse the rest with *This case cannot be opened
-- again.* reopen_ar_return_case, the returned check's, reopened ANY closed case and cleared its
-- replaced_by_mercury_transaction_id, so a case closed because a new deposit replaced it stood open again with the
-- deposit it named forgotten. Only the client's rule (arCaseReopenProblem, src/lib/jobs/arCaseReopen.ts) held it to
-- the two reasons; a call past the client did not. Read by `small-fixes` on 2026-11-25, briefed beside punch list
-- #398's database lane.
--
-- CREATE OR REPLACE with the same argument, the same answer, the same roles and the same grants: the generated types
-- do not change. No table is created, so no fence is owed. The refusal keeps the siblings' words, with why.

CREATE OR REPLACE FUNCTION public.reopen_ar_return_case(p_mercury_transaction_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reason text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'reopen_ar_return_case: not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant', 'controller')
  ) THEN
    RAISE EXCEPTION 'reopen_ar_return_case: not authorized';
  END IF;
  SELECT r.closed_reason INTO v_reason
  FROM public.mercury_transaction_ar_returned r
  WHERE r.mercury_transaction_id = p_mercury_transaction_id
    AND r.closed_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This check has no closed case to reopen.' USING ERRCODE = 'P0001';
  END IF;
  -- Only a close by hand is undone. A case a new deposit replaced keeps the deposit it names and stays closed.
  IF v_reason IS NULL OR v_reason NOT IN ('settled_other_way', 'not_coming') THEN
    RAISE EXCEPTION 'This case cannot be opened again. A new deposit replaced it, and that deposit stands.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.mercury_transaction_ar_returned
  SET closed_at = NULL, closed_by = NULL, closed_reason = NULL, closed_note = NULL, replaced_by_mercury_transaction_id = NULL,
      updated_at = now(), updated_by = auth.uid()
  WHERE mercury_transaction_id = p_mercury_transaction_id
    AND closed_at IS NOT NULL
    AND closed_reason IN ('settled_other_way', 'not_coming');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This check has no closed case to reopen.' USING ERRCODE = 'P0001';
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.reopen_ar_return_case(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_ar_return_case(uuid) TO authenticated;

COMMENT ON FUNCTION public.reopen_ar_return_case(uuid) IS 'Accounts Receivable, a returned check''s case: undoes a close by hand (settled another way, not coming) for a dev, a master, an assistant or a controller. A case a new deposit replaced stays closed (punch list #443, row 5). Refuses an open case.';
