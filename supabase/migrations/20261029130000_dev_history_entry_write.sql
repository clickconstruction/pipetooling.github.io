SET lock_timeout = '3s';

-- The dev seat's history verbs (punch list #208 PR 2m): a robot keeps a History entry on a
-- development through MCP, plan then apply, and reads a site's history whole.
--
-- dev_history_entry_write(p, p_dry_run): the dry-run wrapper the dev seat's plan_history_entry /
-- apply_history_entry POST. Devs only. Validates the site, the one piece, the time, the source and
-- the body; the dry run replies with the line as it will read; the real run inserts the row as the
-- dev with via = 'mcp' and the robot's name in agent_label. Kept lines never change.

CREATE OR REPLACE FUNCTION public.dev_history_entry_write(p jsonb, p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_dev_id uuid;
  v_dev_name text;
  v_job_id uuid := NULL;
  v_bid_id uuid := NULL;
  v_customer_id uuid := NULL;
  v_about text := 'the site';
  v_about_label text;
  v_happened timestamptz;
  v_source text := lower(btrim(COALESCE(p->>'source', '')));
  v_body text := btrim(COALESCE(p->>'body', ''));
  v_agent text := btrim(COALESCE(p->>'agent_label', ''));
  v_link text := NULLIF(btrim(COALESCE(p->>'link_url', '')), '');
  v_pieces integer := 0;
  v_id uuid;
  v_after jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_history_entry_write: devs only' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(p->>'development_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN
    RAISE EXCEPTION 'dev_history_entry_write: development_id is required (a developments.id; read_rows on developments by name)';
  END IF;
  SELECT id, name INTO v_dev_id, v_dev_name FROM public.developments WHERE id = (p->>'development_id')::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev_history_entry_write: development % not found', p->>'development_id'; END IF;

  IF COALESCE(p->>'job_id', '') <> '' THEN
    IF p->>'job_id' !~ '^[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'dev_history_entry_write: job_id must be a jobs_ledger.id'; END IF;
    SELECT id, COALESCE(NULLIF(click_number, ''), NULLIF(hcp_number, ''), 'the job') || ' ' || COALESCE(job_name, '') INTO v_job_id, v_about_label FROM public.jobs_ledger WHERE id = (p->>'job_id')::uuid;
    IF v_job_id IS NULL THEN RAISE EXCEPTION 'dev_history_entry_write: job % not found', p->>'job_id'; END IF;
    v_pieces := v_pieces + 1; v_about := 'job';
  END IF;
  IF COALESCE(p->>'bid_id', '') <> '' THEN
    IF p->>'bid_id' !~ '^[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'dev_history_entry_write: bid_id must be a bids.id'; END IF;
    SELECT id, COALESCE(NULLIF(bid_number, ''), 'the bid') || ' ' || COALESCE(project_name, '') INTO v_bid_id, v_about_label FROM public.bids WHERE id = (p->>'bid_id')::uuid;
    IF v_bid_id IS NULL THEN RAISE EXCEPTION 'dev_history_entry_write: bid % not found', p->>'bid_id'; END IF;
    v_pieces := v_pieces + 1; v_about := 'bid';
  END IF;
  IF COALESCE(p->>'customer_id', '') <> '' THEN
    IF p->>'customer_id' !~ '^[0-9a-fA-F-]{36}$' THEN RAISE EXCEPTION 'dev_history_entry_write: customer_id must be a customers.id'; END IF;
    SELECT id, name INTO v_customer_id, v_about_label FROM public.customers WHERE id = (p->>'customer_id')::uuid;
    IF v_customer_id IS NULL THEN RAISE EXCEPTION 'dev_history_entry_write: customer % not found', p->>'customer_id'; END IF;
    v_pieces := v_pieces + 1; v_about := 'customer';
  END IF;
  IF v_pieces > 1 THEN RAISE EXCEPTION 'dev_history_entry_write: an entry is about one piece — the site (none of job_id, bid_id, customer_id), or exactly one of them'; END IF;
  IF v_about = 'the site' THEN v_about_label := v_dev_name; END IF;

  BEGIN
    v_happened := (p->>'happened_at')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'dev_history_entry_write: happened_at is required — when it happened, as an ISO timestamp with its offset (the email''s time, not now)';
  END;
  IF v_happened IS NULL THEN RAISE EXCEPTION 'dev_history_entry_write: happened_at is required — when it happened, as an ISO timestamp with its offset'; END IF;
  IF v_happened > now() + interval '5 minutes' THEN RAISE EXCEPTION 'dev_history_entry_write: happened_at is in the future'; END IF;
  IF v_source NOT IN ('email', 'call', 'text', 'on_site', 'letter', 'note') THEN
    RAISE EXCEPTION 'dev_history_entry_write: source must be email, call, text, on_site, letter or note';
  END IF;
  IF v_body = '' THEN RAISE EXCEPTION 'dev_history_entry_write: body is required — what happened, in words, whole'; END IF;
  IF length(v_body) > 20000 THEN RAISE EXCEPTION 'dev_history_entry_write: keep the body under 20,000 characters'; END IF;
  IF v_agent = '' THEN RAISE EXCEPTION 'dev_history_entry_write: agent_label is required — the robot''s name as the line will show it (the inbox robot)'; END IF;
  IF length(v_agent) > 80 THEN RAISE EXCEPTION 'dev_history_entry_write: keep agent_label under 80 characters'; END IF;
  IF v_link IS NOT NULL AND length(v_link) > 2000 THEN RAISE EXCEPTION 'dev_history_entry_write: keep link_url under 2,000 characters'; END IF;

  v_after := jsonb_build_object(
    'development', v_dev_name,
    'about', v_about,
    'about_label', btrim(v_about_label),
    'happened_at', v_happened,
    'source', v_source,
    'body_head', left(v_body, 200),
    'body_chars', length(v_body),
    'by', v_agent,
    'via', 'mcp'
  );

  IF p_dry_run THEN
    RETURN jsonb_build_object('ok', true, 'dry_run', true, 'after', v_after);
  END IF;

  INSERT INTO public.development_history_entries (development_id, job_id, bid_id, customer_id, happened_at, source, body, author_user_id, via, agent_label, link_url)
  VALUES (v_dev_id, v_job_id, v_bid_id, v_customer_id, v_happened, v_source, v_body, auth.uid(), 'mcp', v_agent, v_link)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'dry_run', false, 'id', v_id, 'after', v_after);
END;
$fn$;

REVOKE ALL ON FUNCTION public.dev_history_entry_write(jsonb, boolean) FROM anon;
REVOKE ALL ON FUNCTION public.dev_history_entry_write(jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dev_history_entry_write(jsonb, boolean) TO authenticated;

COMMENT ON FUNCTION public.dev_history_entry_write(jsonb, boolean) IS 'The dev seat''s History entry write (v2.6044): plan (dry run) then apply, devs only; inserts development_history_entries with via = mcp and the robot''s agent_label. Kept lines never change.';

-- dev_history_read: a site's history as people wrote it, every body whole — the entries, the job's
-- and the bid's thread notes — newest first, with the writers' names. Runs as the caller (RLS
-- applies), so it is call_read's and get_history's one door to the words.
CREATE OR REPLACE FUNCTION public.dev_history_read(p_development_id uuid, p_job_id uuid DEFAULT NULL, p_bid_id uuid DEFAULT NULL, p_since timestamptz DEFAULT NULL, p_limit integer DEFAULT 200)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $fn$
  WITH lines AS (
    SELECT h.happened_at AS at, 'entry'::text AS kind, h.source AS source, h.body AS body,
           COALESCE(u.name, h.agent_label) AS by, h.via AS via, h.agent_label AS agent,
           h.job_id, h.bid_id, h.customer_id, h.id
    FROM public.development_history_entries h
    LEFT JOIN public.users u ON u.id = h.author_user_id
    WHERE h.development_id = p_development_id
      AND (p_job_id IS NULL OR h.job_id = p_job_id)
      AND (p_bid_id IS NULL OR h.bid_id = p_bid_id)
    UNION ALL
    SELECT n.created_at, 'job_note', 'note', n.body, u.name, 'app', NULL, n.job_id, NULL, NULL, n.id
    FROM public.jobs_ledger_thread_notes n
    JOIN public.jobs_ledger j ON j.id = n.job_id AND j.development_id = p_development_id
    LEFT JOIN public.users u ON u.id = n.author_user_id
    WHERE p_bid_id IS NULL AND (p_job_id IS NULL OR n.job_id = p_job_id)
    UNION ALL
    SELECT n.created_at, 'bid_note', 'note', n.body, u.name, 'app', NULL, NULL, n.estimate_id, NULL, n.id
    FROM public.estimates_thread_notes n
    JOIN public.bids b ON b.id = n.estimate_id AND b.development_id = p_development_id
    LEFT JOIN public.users u ON u.id = n.author_user_id
    WHERE p_job_id IS NULL AND (p_bid_id IS NULL OR n.estimate_id = p_bid_id)
  )
  SELECT jsonb_build_object(
    'development_id', p_development_id,
    'count', (SELECT count(*) FROM lines WHERE p_since IS NULL OR at >= p_since),
    'lines', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('at', at, 'kind', kind, 'source', source, 'body', body, 'by', by, 'via', via, 'agent', agent, 'job_id', job_id, 'bid_id', bid_id, 'customer_id', customer_id, 'id', id) ORDER BY at DESC)
      FROM (SELECT * FROM lines WHERE p_since IS NULL OR at >= p_since ORDER BY at DESC LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 200), 500))) l
    ), '[]'::jsonb)
  );
$fn$;

REVOKE ALL ON FUNCTION public.dev_history_read(uuid, uuid, uuid, timestamptz, integer) FROM anon;
REVOKE ALL ON FUNCTION public.dev_history_read(uuid, uuid, uuid, timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dev_history_read(uuid, uuid, uuid, timestamptz, integer) TO authenticated;

COMMENT ON FUNCTION public.dev_history_read(uuid, uuid, uuid, timestamptz, integer) IS 'A site''s history as people wrote it, every body whole (v2.6044): the entries and the job''s and bid''s thread notes, newest first, as the caller (RLS applies). The dev seat''s get_history and call_read read it.';
