SET lock_timeout = '3s';

-- dev_hr_entry_write (v2.3722, to-dos/mcp-servers.md PR 6): the dev's door to the HR file,
-- with a dry run. hr_agent_write(jsonb) has EXECUTE revoked from authenticated and granted only
-- to the hr_agent database role (20260824141540), and it has no dry run — so a signed-in dev's
-- agent (dev-mcp's plan_hr_entry / apply_hr_entry) could not file an entry at all, and could not
-- preview one. This wrapper is a SECURITY DEFINER function gated is_dev() inside that calls the
-- live hr_agent_write unchanged (house rule: never rebuild an RPC body from a repo baseline),
-- names the DEV in author_label whatever the payload says, and with p_dry_run = true (the
-- default) performs the write and unwinds it, returning what would have been filed. The
-- hr_agent psql contract in docs/HR_FILES.md is untouched: this is a second door, not a
-- replacement. Read-only (training) mode still blocks the write: the statement blocks fire on
-- the HR tables inside the definer.
--
-- Payload: hr_agent_write's ({ person_id, entries?, summary?, narrative? | narrative_append?,
-- covered_through? }); author_label is overwritten with the dev's name.
-- Reply: hr_agent_write's ({ entries_inserted, summary_written, narrative_written }) plus
-- dry_run, person { id, name }, author_label, entries [{ entry_date, source, chars }],
-- summary_chars, narrative_chars.

CREATE OR REPLACE FUNCTION public.dev_hr_entry_write(p jsonb, p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_dev_name text;
  v_dev_email text;
  v_label text;
  v_person_id uuid;
  v_person_name text;
  v_payload jsonb;
  v_result jsonb;
  v_out jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_hr_entry_write: devs only' USING ERRCODE = '42501';
  END IF;

  SELECT u.name, u.email INTO v_dev_name, v_dev_email FROM public.users u WHERE u.id = auth.uid();
  v_label := COALESCE(NULLIF(btrim(v_dev_name), ''), v_dev_email);
  IF v_label IS NULL THEN
    RAISE EXCEPTION 'dev_hr_entry_write: no users row for the caller';
  END IF;

  v_person_id := (p->>'person_id')::uuid;
  IF v_person_id IS NULL THEN
    RAISE EXCEPTION 'dev_hr_entry_write: person_id is required';
  END IF;
  SELECT pe.name INTO v_person_name FROM public.people pe WHERE pe.id = v_person_id;
  IF v_person_name IS NULL THEN
    RAISE EXCEPTION 'dev_hr_entry_write: person % not found', v_person_id;
  END IF;

  -- The audit row names the dev, whatever the payload says.
  v_payload := (p - 'author_label') || jsonb_build_object('author_label', v_label);

  BEGIN
    v_result := public.hr_agent_write(v_payload);
    v_out := v_result || jsonb_build_object(
      'dry_run', p_dry_run,
      'person', jsonb_build_object('id', v_person_id, 'name', v_person_name),
      'author_label', v_label,
      'entries', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'entry_date', e->>'entry_date',
          'source', COALESCE(e->>'source', 'conversation'),
          'chars', length(COALESCE(e->>'content', '')))), '[]'::jsonb)
        FROM jsonb_array_elements(COALESCE(p->'entries', '[]'::jsonb)) AS e),
      'summary_chars', length(p->>'summary'),
      'narrative_chars', length(COALESCE(p->>'narrative', p->>'narrative_append')));
    IF p_dry_run THEN
      -- unwind every write above; v_out survives the exception
      RAISE EXCEPTION USING ERRCODE = 'P0DRY', MESSAGE = 'dry run';
    END IF;
    RETURN v_out;
  EXCEPTION
    WHEN SQLSTATE 'P0DRY' THEN
      RETURN v_out;
  END;
END
$fn$;

COMMENT ON FUNCTION public.dev_hr_entry_write(jsonb, boolean) IS
  'dev-mcp (v2.3722): a signed-in dev files an HR entry through the live hr_agent_write with the dev named as author; p_dry_run = true (default) performs and unwinds the write, returning what would be filed. Devs only (is_dev()).';

REVOKE ALL ON FUNCTION public.dev_hr_entry_write(jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dev_hr_entry_write(jsonb, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.dev_hr_entry_write(jsonb, boolean) TO authenticated;
