SET lock_timeout = '3s';
-- dev_person_license_write (punch list #255): the dev MCP's dry-run wrapper for a teammate's license
-- (plan_license → apply_license). The owner asked that dev-mcp can update users' licenses and their
-- expirations: the six stale dates fixed on 2026-11-03 were each a registry lookup and a hand edit.
--
-- A license is a person_licenses row keyed by the person's name (as the Licenses tab keeps it). The
-- wrapper adds one or changes one; it never deletes, so a lapsed license gets its new date and the
-- Licenses tab keeps Delete. The words come from dev-mcp already written one way (licenseTypeText), so
-- the logbook reads them back as the same trade, level and number. The dry run names the person,
-- the license before and after, and every license the person holds; apply writes the row AS THE DEV
-- and asks notify_dispatch_license_expiry_if_needed, as the Licenses tab's Save does, answering the
-- dispatch request's id for dev-mcp to send.
--
-- p = { action: add | update, license_id? (update), person_name (add; on update it must match the
-- row), license_type, date_of_expiry (YYYY-MM-DD), note? (on update, absent keeps the note) }.
--
-- Additive and idempotent; no table is created, so no read-only fence is owed.

CREATE OR REPLACE FUNCTION public.dev_person_license_write(p jsonb, p_dry_run boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_action text := lower(btrim(COALESCE(p->>'action', 'add')));
  v_person text := btrim(COALESCE(p->>'person_name', ''));
  v_type text := btrim(COALESCE(p->>'license_type', ''));
  v_note_given boolean := p ? 'note';
  v_note text := NULLIF(btrim(COALESCE(p->>'note', '')), '');
  v_expiry date;
  v_existing public.person_licenses%ROWTYPE;
  v_dup uuid;
  v_before jsonb := NULL;
  v_after jsonb;
  v_held jsonb;
  v_id uuid;
  v_dispatch uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_person_license_write: devs only' USING ERRCODE = '42501';
  END IF;
  IF v_action NOT IN ('add', 'update') THEN
    RAISE EXCEPTION 'dev_person_license_write: action must be add or update (a license is never deleted here; the Licenses tab keeps Delete)';
  END IF;
  IF v_type = '' OR length(v_type) > 120 THEN
    RAISE EXCEPTION 'dev_person_license_write: license_type is required, under 120 characters, as "Plumber Apprentice #191717"';
  END IF;
  IF COALESCE(p->>'date_of_expiry', '') !~ '^\d{4}-\d{2}-\d{2}$' THEN
    RAISE EXCEPTION 'dev_person_license_write: date_of_expiry is required as YYYY-MM-DD';
  END IF;
  v_expiry := (p->>'date_of_expiry')::date;
  IF v_note IS NOT NULL AND length(v_note) > 500 THEN
    RAISE EXCEPTION 'dev_person_license_write: keep the note under 500 characters';
  END IF;

  IF v_action = 'update' THEN
    IF COALESCE(p->>'license_id', '') !~ '^[0-9a-fA-F-]{36}$' THEN
      RAISE EXCEPTION 'dev_person_license_write: license_id is required to update (a person_licenses.id: read_rows on person_licenses by person_name)';
    END IF;
    SELECT * INTO v_existing FROM public.person_licenses WHERE id = (p->>'license_id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'dev_person_license_write: license % not found', p->>'license_id'; END IF;
    IF v_person = '' THEN
      v_person := v_existing.person_name;
    ELSIF v_person <> v_existing.person_name THEN
      RAISE EXCEPTION 'dev_person_license_write: license % belongs to %, not %; a license never moves to another person', v_existing.id, v_existing.person_name, v_person;
    END IF;
    IF NOT v_note_given THEN v_note := v_existing.note; END IF;
    SELECT id INTO v_dup FROM public.person_licenses
      WHERE person_name = v_person AND lower(license_type) = lower(v_type) AND id <> v_existing.id LIMIT 1;
    IF v_dup IS NOT NULL THEN
      RAISE EXCEPTION 'dev_person_license_write: % already holds % on another row (license_id %)', v_person, v_type, v_dup;
    END IF;
    v_before := jsonb_build_object('license_id', v_existing.id, 'license_type', v_existing.license_type, 'date_of_expiry', v_existing.date_of_expiry, 'note', v_existing.note);
  ELSE
    IF v_person = '' THEN
      RAISE EXCEPTION 'dev_person_license_write: person_name is required, exactly as People names them (find_person)';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.people WHERE name = v_person) AND NOT EXISTS (SELECT 1 FROM public.users WHERE name = v_person) THEN
      RAISE EXCEPTION 'dev_person_license_write: nobody on People or with an account is named exactly "%"; find_person first', v_person;
    END IF;
    SELECT id INTO v_dup FROM public.person_licenses WHERE person_name = v_person AND lower(license_type) = lower(v_type) LIMIT 1;
    IF v_dup IS NOT NULL THEN
      RAISE EXCEPTION 'dev_person_license_write: % already holds % (license_id %); plan an update instead', v_person, v_type, v_dup;
    END IF;
  END IF;

  v_after := jsonb_build_object('license_type', v_type, 'date_of_expiry', v_expiry, 'note', v_note);
  SELECT COALESCE(jsonb_agg(jsonb_build_object('license_id', l.id, 'license_type', l.license_type, 'date_of_expiry', l.date_of_expiry) ORDER BY l.license_type), '[]'::jsonb)
    INTO v_held FROM public.person_licenses l WHERE l.person_name = v_person;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'action', v_action,
      'person_name', v_person,
      'before', v_before,
      'after', v_after,
      'expired', v_expiry < (now() AT TIME ZONE 'America/Chicago')::date,
      'licenses_held', v_held
    );
  END IF;

  IF v_action = 'update' THEN
    -- A renewal (a later date) arms the expiry notice again for the new date.
    UPDATE public.person_licenses
      SET license_type = v_type, date_of_expiry = v_expiry, note = v_note,
          expiry_dispatch_notified_at = CASE WHEN v_expiry > v_existing.date_of_expiry THEN NULL ELSE expiry_dispatch_notified_at END
      WHERE id = v_existing.id;
    v_id := v_existing.id;
  ELSE
    INSERT INTO public.person_licenses (person_name, license_type, date_of_expiry, note) VALUES (v_person, v_type, v_expiry, v_note) RETURNING id INTO v_id;
  END IF;
  -- Dispatch hears of a license expiring within 30 days, as the Licenses tab's Save asks.
  v_dispatch := public.notify_dispatch_license_expiry_if_needed(v_id, 'https://clicktooling.com/people?tab=licenses');
  RETURN jsonb_build_object('ok', true, 'action', v_action, 'license_id', v_id, 'person_name', v_person, 'dispatch_request_id', v_dispatch);
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.dev_person_license_write(jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_person_license_write(jsonb, boolean) TO authenticated;
COMMENT ON FUNCTION public.dev_person_license_write(jsonb, boolean) IS
  'The dev MCP''s license verbs (punch list #255): a dry-run wrapper that adds or updates a person_licenses row, devs only. p = { action (add | update), license_id? (update), person_name, license_type, date_of_expiry (YYYY-MM-DD), note? }. p_dry_run true names the person, the license before and after, whether it is expired and every license the person holds; false writes the row as the caller and asks notify_dispatch_license_expiry_if_needed, answering dispatch_request_id. Never deletes.';
