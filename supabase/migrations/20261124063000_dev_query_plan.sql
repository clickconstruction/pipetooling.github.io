SET lock_timeout = '3s';

-- dev_query_plan: a dev reads the plan of one of a short list of fixed statements, as themself (punch list #430).
--
-- Why it exists: a view that joins a table with row policies is only as fast as the plan the CALLER gets, and nothing a
-- session may use could read that plan on prod. PostgREST hands back rows and no plan; the dashboard SQL editor and the
-- Supabase MCP run as postgres, which no policy binds, so their plan is not the one a person waits on.
--
-- What holds it:
--   * No free SQL. The caller names a statement by its key. Every statement is written out below, whole, and there is
--     no dynamic SQL in the body: nothing the caller sends is ever part of a statement. A new statement is a migration.
--   * The caller's own plan. SECURITY INVOKER, so the statement is planned and run as the dev under their row policies.
--   * Devs only, refused here in the database (is_dev()), whoever calls and through whatever door.
--   * Read only. Each statement is a SELECT, and the function turns the transaction read only before it runs one, so
--     the database refuses a write for the rest of the call whichever door it came through.
--   * The reply is the plan's lines, the key and whether it was analyzed. It is capped: past p_max_chars (400,000 at
--     most, the default) the head and the last lines are kept and the count left out is said. The cap is a number,
--     clamped; it is never part of a statement.
--
-- VOLATILE because Postgres refuses EXPLAIN inside a STABLE function ("EXPLAIN is not allowed in a non-volatile
-- function", tested on 17.6). PostgREST still calls it over GET, in a read-only transaction, which is how dev-mcp's
-- check_query_plan reads it. ANALYZE runs the statement; p_analyze => false asks for the plan alone, for a statement
-- that might not finish inside the caller's statement timeout.
--
-- No CREATE TABLE, so no fence appliers.

CREATE OR REPLACE FUNCTION public.dev_query_plan(p_key text, p_analyze boolean DEFAULT true, p_max_chars integer DEFAULT 400000)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = public, pg_catalog AS $$
DECLARE
  v_max_chars CONSTANT integer := LEAST(GREATEST(COALESCE(p_max_chars, 400000), 2000), 400000);
  v_tail CONSTANT integer := 12;
  v_analyze boolean := COALESCE(p_analyze, true);
  v_line text;
  v_lines text[] := '{}';
  v_total integer;
  v_chars integer := 0;
  v_head integer := 0;
BEGIN
  IF NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_query_plan: devs only' USING ERRCODE = '42501';
  END IF;

  -- From here to the end of the transaction the database refuses a write.
  PERFORM set_config('transaction_read_only', 'on', true);

  IF p_key = 'agreements_on_file' THEN
    IF v_analyze THEN
      FOR v_line IN EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.agreements_on_file LOOP
        v_lines := v_lines || v_line;
      END LOOP;
    ELSE
      FOR v_line IN EXPLAIN SELECT * FROM public.agreements_on_file LOOP
        v_lines := v_lines || v_line;
      END LOOP;
    END IF;
  ELSIF p_key = 'people_hours_recorded' THEN
    IF v_analyze THEN
      FOR v_line IN EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM public.people_hours_recorded WHERE work_date >= current_date - 14 LOOP
        v_lines := v_lines || v_line;
      END LOOP;
    ELSE
      FOR v_line IN EXPLAIN SELECT * FROM public.people_hours_recorded WHERE work_date >= current_date - 14 LOOP
        v_lines := v_lines || v_line;
      END LOOP;
    END IF;
  ELSE
    RAISE EXCEPTION 'dev_query_plan: no statement is named that'
      USING ERRCODE = '22023', HINT = 'The statements are: agreements_on_file, people_hours_recorded.';
  END IF;

  v_total := COALESCE(array_length(v_lines, 1), 0);

  -- The whole plan when it fits. Otherwise the head that fits, then the last lines, where the times are.
  FOR v_i IN 1..v_total LOOP
    v_chars := v_chars + length(v_lines[v_i]) + 1;
    EXIT WHEN v_chars > v_max_chars;
    v_head := v_i;
  END LOOP;

  IF v_head >= v_total THEN
    RETURN jsonb_build_object(
      'key', p_key, 'analyzed', v_analyze, 'line_count', v_total, 'cut', false,
      'lines', to_jsonb(v_lines));
  END IF;

  v_head := LEAST(v_head, GREATEST(v_total - v_tail, 0));
  RETURN jsonb_build_object(
    'key', p_key, 'analyzed', v_analyze, 'line_count', v_total, 'cut', true,
    'lines', to_jsonb(v_lines[1:v_head]),
    'left_out', v_total - v_head - LEAST(v_tail, v_total - v_head),
    'last_lines', to_jsonb(v_lines[GREATEST(v_total - v_tail + 1, v_head + 1):v_total]));
END;
$$;

COMMENT ON FUNCTION public.dev_query_plan(text, boolean, integer) IS
  'A dev reads the plan of one fixed statement, by its key, planned and run as themself under their row policies (punch list #430). No free SQL: the statements are written in the body. Devs only; read only.';

REVOKE EXECUTE ON FUNCTION public.dev_query_plan(text, boolean, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_query_plan(text, boolean, integer) TO authenticated;
