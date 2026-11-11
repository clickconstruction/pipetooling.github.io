SET lock_timeout = '3s';

-- Punch list #303, PR 4 (v2.6864): the Bridge's call reaches its people.
--
-- A call names the week's moves and a person on each. Until now the person was a word in a box:
-- `bridge_calls.moves` is jsonb, each move `{ key, title, who, then }`, and the table is read by the
-- owner and the devs alone (`is_master_or_dev()`, v2.6763), so the office person named on a move
-- never saw it. From this version the Bridge writes the person's account on the move as `whoId`,
-- and two functions let that person, whoever they are, read their own moves and say one is done.
--
-- Nobody gains a read of the table. Each function is SECURITY DEFINER and answers only about the
-- moves whose `whoId` is the caller. Additive and idempotent: no table is created, so no fence
-- call is owed, and training mode is stopped by the table's own statement trigger.

-- 1) The caller's own open moves on the standing call: the newest call, while its pay week still
--    runs and Friday's question has no answer. One row per move, in the call's order.
CREATE OR REPLACE FUNCTION public.bridge_my_moves()
RETURNS TABLE (call_id uuid, week_start date, called_on date, called_by_name text, link text, idx integer, move_key text, title text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.week_start, c.called_on, c.called_by_name, c.link,
         (m.ord - 1)::integer,
         COALESCE(m.move->>'key', 'other'),
         COALESCE(m.move->>'title', '')
  FROM public.bridge_calls c
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(c.moves) = 'array' THEN c.moves ELSE '[]'::jsonb END) WITH ORDINALITY AS m(move, ord)
  WHERE auth.uid() IS NOT NULL
    AND NOT public.caller_is_archived()
    AND c.id = (SELECT c2.id FROM public.bridge_calls c2 ORDER BY c2.week_start DESC, c2.created_at DESC LIMIT 1)
    AND c.outcome IS NULL
    AND c.week_start >= ((now() AT TIME ZONE 'America/Chicago')::date - 6)
    AND m.move->>'whoId' = auth.uid()::text
    AND COALESCE(m.move->>'doneAt', '') = ''
  ORDER BY m.ord
$$;

COMMENT ON FUNCTION public.bridge_my_moves() IS
  'The caller''s own open moves on the Bridge''s standing call (the newest call, its pay week still running, Friday unanswered): the moves whose whoId is the caller and that carry no doneAt. Read by the Needs you card for anyone signed in; it opens no read of bridge_calls. Punch list #303 PR 4, v2.6864.';

REVOKE ALL ON FUNCTION public.bridge_my_moves() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bridge_my_moves() TO authenticated, service_role;

-- 2) The caller says one of their moves is done. It stamps `doneAt` and `doneBy` on that move and
--    touches nothing else. A move that is not the caller's is refused, and a second press changes
--    nothing. The Bridge's card reads the stamp beside what the numbers say.
CREATE OR REPLACE FUNCTION public.bridge_mark_my_move_done(p_call_id uuid, p_idx integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_moves jsonb;
  v_move jsonb;
  v_name text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not signed in.'); END IF;
  IF public.caller_is_archived() THEN RETURN jsonb_build_object('error', 'This account is archived.'); END IF;
  SELECT c.moves INTO v_moves FROM public.bridge_calls c WHERE c.id = p_call_id FOR UPDATE;
  IF v_moves IS NULL OR jsonb_typeof(v_moves) <> 'array' OR p_idx IS NULL OR p_idx < 0 OR p_idx >= jsonb_array_length(v_moves) THEN
    RETURN jsonb_build_object('error', 'That move is not on the call.');
  END IF;
  v_move := v_moves -> p_idx;
  IF v_move->>'whoId' IS DISTINCT FROM auth.uid()::text THEN
    RETURN jsonb_build_object('error', 'That move is not yours.');
  END IF;
  IF COALESCE(v_move->>'doneAt', '') <> '' THEN RETURN jsonb_build_object('ok', true); END IF;
  SELECT COALESCE(NULLIF(btrim(u.name), ''), '') INTO v_name FROM public.users u WHERE u.id = auth.uid();
  UPDATE public.bridge_calls
    SET moves = jsonb_set(moves, ARRAY[p_idx::text], v_move || jsonb_build_object('doneAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'doneBy', COALESCE(v_name, '')))
    WHERE id = p_call_id;
  RETURN jsonb_build_object('ok', true);
END $$;

COMMENT ON FUNCTION public.bridge_mark_my_move_done(uuid, integer) IS
  'The caller marks one of their own moves on a Bridge call done: stamps doneAt and doneBy on bridge_calls.moves[p_idx] when that move''s whoId is the caller, and nothing else. Returns { ok } or { error }. Punch list #303 PR 4, v2.6864.';

REVOKE ALL ON FUNCTION public.bridge_mark_my_move_done(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bridge_mark_my_move_done(uuid, integer) TO authenticated, service_role;
