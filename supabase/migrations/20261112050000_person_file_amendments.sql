SET lock_timeout = '3s';

-- Corrections as links (punch list #315, upgrade 1): a row that says "this entry corrects that one".
--
-- The HR file is append-only: a wrong entry is corrected by a NEW entry that says so in its words ("Correction to the
-- 2026-08-19 entry: ..."). Nothing but those words joined the two, so the older entry never read as corrected, a
-- search hit on it gave no sign a correction existed, and a document that rested on it was not flagged.
--
-- person_file_amendments is that join, kept beside the record and never on it:
--   * One row = one thing on a person's file (an HR entry or a piece of evidence) that corrects or completes another.
--     `from` is the newer thing, `to` the older. A correction may name several things; a thing may be corrected twice.
--   * No existing row changes. person_file_entries and person_file_evidence keep their columns and their
--     append-only policies. So the corrections already written in prose can be linked later by adding rows here.
--   * A link is what it was when made. It is never deleted or reworded; a wrong one is withdrawn with a reason
--     (withdrawn_at / withdrawn_by / withdrawn_why), the way a theme mark is removed.
--   * The trigger holds both ends to the one person, refuses a thing that amends itself, a link whose newer end was
--     written before its older end, and a link that would run back along a live one.
--   * Devs read, add and withdraw. The HR agent's key reads and adds. The dev seat is refused a link that touches a
--     counsel-only evidence record, as it is refused the record.
--
-- hr_agent_write learns three keys, so both doors (the hr_agent role's psql contract, and dev_hr_entry_write behind
-- the dev seat's plan_hr_entry, which hands its payload over whole) carry a link with no new verb:
--   entries[].corrects / entries[].completes   what a NEW entry amends: an entry id, { kind, id }, or a list of them
--   amendments[]                               a link between two things already on the file:
--                                              { from_id, to_id, how, from_kind?, to_kind? } (kinds: hr_entry)
--   withdraw_amendments[]                      { id, why }
-- Its body is the live one (the repo's 20260824141540 with 'report' among the sources, read from prod 2026-11-11)
-- with those additions; nothing it did before changes. dev_hr_entry_write's reply names each link in words that are
-- the same on every run, so a plan and its apply hash alike.

CREATE TABLE IF NOT EXISTS public.person_file_amendments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  from_kind text NOT NULL,
  from_id uuid NOT NULL,
  to_kind text NOT NULL,
  to_id uuid NOT NULL,
  how text NOT NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  author_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  withdrawn_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  withdrawn_why text,
  CONSTRAINT person_file_amendments_from_kind_check CHECK (from_kind IN ('hr_entry', 'hr_evidence')),
  CONSTRAINT person_file_amendments_to_kind_check CHECK (to_kind IN ('hr_entry', 'hr_evidence')),
  CONSTRAINT person_file_amendments_how_check CHECK (how IN ('corrects', 'completes')),
  CONSTRAINT person_file_amendments_not_itself CHECK (NOT (from_kind = to_kind AND from_id = to_id)),
  CONSTRAINT person_file_amendments_withdrawn_with_why CHECK (
    (withdrawn_at IS NULL AND withdrawn_why IS NULL)
    OR (withdrawn_at IS NOT NULL AND length(btrim(COALESCE(withdrawn_why, ''))) BETWEEN 1 AND 200))
);

COMMENT ON TABLE public.person_file_amendments IS
  'HR files (punch list #315): one row says a thing on a person''s file (from: an HR entry or a piece of evidence) corrects or completes an older one (to). The record itself stays append-only and untouched; a wrong link is withdrawn with a reason, never deleted. Dev-only.';
COMMENT ON COLUMN public.person_file_amendments.how IS 'corrects: the older thing is wrong where the newer one differs. completes: the older thing stands and the newer one adds to it.';
COMMENT ON COLUMN public.person_file_amendments.withdrawn_at IS 'When the link was withdrawn; null while it stands. Set once, with withdrawn_why (1 to 200 characters).';

CREATE UNIQUE INDEX IF NOT EXISTS person_file_amendments_live_once
  ON public.person_file_amendments (from_kind, from_id, to_kind, to_id) WHERE withdrawn_at IS NULL;
CREATE INDEX IF NOT EXISTS person_file_amendments_person_idx ON public.person_file_amendments (person_id);
CREATE INDEX IF NOT EXISTS person_file_amendments_to_idx ON public.person_file_amendments (to_kind, to_id);

-- A thing on a person's file, in the few words a plan names it by. Definer, and executable by nobody: only the
-- functions below call it, as their owner, so it is not a door of its own.
CREATE OR REPLACE FUNCTION public.person_file_thing(p_kind text, p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v jsonb;
BEGIN
  IF p_id IS NULL THEN RETURN NULL; END IF;
  IF p_kind = 'hr_entry' THEN
    SELECT jsonb_build_object('kind', 'hr_entry', 'id', e.id, 'person_id', e.person_id, 'day', e.entry_date, 'created_at', e.created_at,
                              'words', left(regexp_replace(e.content, '\s+', ' ', 'g'), 80))
      INTO v FROM public.person_file_entries e WHERE e.id = p_id;
  ELSIF p_kind = 'hr_evidence' THEN
    SELECT jsonb_build_object('kind', 'hr_evidence', 'id', r.id, 'person_id', r.person_id, 'day', r.dated_on, 'created_at', r.created_at,
                              'words', CASE WHEN r.counsel_only THEN 'a counsel-only record' ELSE left(regexp_replace(r.title, '\s+', ' ', 'g'), 80) END)
      INTO v FROM public.person_file_evidence r WHERE r.id = p_id;
  END IF;
  RETURN v;
END
$fn$;
REVOKE ALL ON FUNCTION public.person_file_thing(text, uuid) FROM PUBLIC, anon, authenticated;

-- The guard. Definer, so it reads both ends past the caller's RLS (the seat cannot read a counsel-only record, and
-- must still be told its link is on the wrong person).
CREATE OR REPLACE FUNCTION public.person_file_amendments_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_from_person uuid;
  v_from_at timestamptz;
  v_to_person uuid;
  v_to_at timestamptz;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.person_id <> OLD.person_id OR NEW.from_kind <> OLD.from_kind OR NEW.from_id <> OLD.from_id
       OR NEW.to_kind <> OLD.to_kind OR NEW.to_id <> OLD.to_id OR NEW.how <> OLD.how
       OR NEW.created_by IS DISTINCT FROM OLD.created_by OR NEW.author_label IS DISTINCT FROM OLD.author_label
       OR NEW.created_at <> OLD.created_at THEN
      RAISE EXCEPTION 'person_file_amendments: a link is what it was when made; withdraw it with a reason and link again' USING ERRCODE = '23514';
    END IF;
    IF OLD.withdrawn_at IS NOT NULL THEN
      RAISE EXCEPTION 'person_file_amendments: a withdrawn link stays withdrawn' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.from_kind = 'hr_entry' THEN
    SELECT e.person_id, e.created_at INTO v_from_person, v_from_at FROM public.person_file_entries e WHERE e.id = NEW.from_id;
  ELSE
    SELECT r.person_id, r.created_at INTO v_from_person, v_from_at FROM public.person_file_evidence r WHERE r.id = NEW.from_id;
  END IF;
  IF NEW.to_kind = 'hr_entry' THEN
    SELECT e.person_id, e.created_at INTO v_to_person, v_to_at FROM public.person_file_entries e WHERE e.id = NEW.to_id;
  ELSE
    SELECT r.person_id, r.created_at INTO v_to_person, v_to_at FROM public.person_file_evidence r WHERE r.id = NEW.to_id;
  END IF;
  IF v_from_person IS NULL THEN
    RAISE EXCEPTION 'person_file_amendments: the newer thing (% %) is not on any file', NEW.from_kind, NEW.from_id USING ERRCODE = '23503';
  END IF;
  IF v_to_person IS NULL THEN
    RAISE EXCEPTION 'person_file_amendments: the older thing (% %) is not on any file', NEW.to_kind, NEW.to_id USING ERRCODE = '23503';
  END IF;
  IF v_from_person <> NEW.person_id OR v_to_person <> NEW.person_id THEN
    RAISE EXCEPTION 'person_file_amendments: both ends of a link belong to the one person''s file' USING ERRCODE = '23514';
  END IF;
  IF v_from_at < v_to_at THEN
    RAISE EXCEPTION 'person_file_amendments: the newer thing was written before the older one; a link runs from what was written later' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.person_file_amendments a
    WHERE a.withdrawn_at IS NULL AND a.from_kind = NEW.from_kind AND a.from_id = NEW.from_id AND a.to_kind = NEW.to_kind AND a.to_id = NEW.to_id
  ) THEN
    RAISE EXCEPTION 'person_file_amendments: that link already stands' USING ERRCODE = '23505';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.person_file_amendments a
    WHERE a.withdrawn_at IS NULL AND a.from_kind = NEW.to_kind AND a.from_id = NEW.to_id AND a.to_kind = NEW.from_kind AND a.to_id = NEW.from_id
  ) THEN
    RAISE EXCEPTION 'person_file_amendments: a live link already runs the other way between these two' USING ERRCODE = '23514';
  END IF;
  NEW.withdrawn_at := NULL;
  NEW.withdrawn_by := NULL;
  NEW.withdrawn_why := NULL;
  RETURN NEW;
END
$fn$;
DROP TRIGGER IF EXISTS person_file_amendments_guard ON public.person_file_amendments;
CREATE TRIGGER person_file_amendments_guard BEFORE INSERT OR UPDATE ON public.person_file_amendments
  FOR EACH ROW EXECUTE FUNCTION public.person_file_amendments_guard();

ALTER TABLE public.person_file_amendments ENABLE ROW LEVEL SECURITY;

-- Devs: read, add, withdraw (the guard lets nothing else change). No delete policy exists.
DROP POLICY IF EXISTS person_file_amendments_dev_select ON public.person_file_amendments;
CREATE POLICY person_file_amendments_dev_select ON public.person_file_amendments FOR SELECT TO authenticated USING (public.is_dev());
DROP POLICY IF EXISTS person_file_amendments_dev_insert ON public.person_file_amendments;
CREATE POLICY person_file_amendments_dev_insert ON public.person_file_amendments FOR INSERT TO authenticated WITH CHECK (public.is_dev());
DROP POLICY IF EXISTS person_file_amendments_dev_update ON public.person_file_amendments;
CREATE POLICY person_file_amendments_dev_update ON public.person_file_amendments FOR UPDATE TO authenticated USING (public.is_dev()) WITH CHECK (public.is_dev());
GRANT SELECT, INSERT, UPDATE ON public.person_file_amendments TO authenticated;

-- The seat as deployed: a link that touches a counsel-only evidence record is refused to it, as the record is.
DROP POLICY IF EXISTS person_file_amendments_counsel_only_seat ON public.person_file_amendments;
CREATE POLICY person_file_amendments_counsel_only_seat ON public.person_file_amendments
  AS RESTRICTIVE FOR SELECT TO authenticated USING (NOT (
    public.request_is_dev_seat()
    AND ((from_kind = 'hr_evidence' AND public.evidence_is_counsel_only(from_id)) OR (to_kind = 'hr_evidence' AND public.evidence_is_counsel_only(to_id)))));

-- The HR agent's key: reads and adds, never withdraws; never a link that touches a counsel-only record.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hr_agent') THEN
    GRANT SELECT, INSERT ON public.person_file_amendments TO hr_agent;
    DROP POLICY IF EXISTS "hr_agent reads person file amendments" ON public.person_file_amendments;
    CREATE POLICY "hr_agent reads person file amendments" ON public.person_file_amendments FOR SELECT TO hr_agent
      USING (NOT ((from_kind = 'hr_evidence' AND public.evidence_is_counsel_only(from_id)) OR (to_kind = 'hr_evidence' AND public.evidence_is_counsel_only(to_id))));
    DROP POLICY IF EXISTS "hr_agent adds person file amendments" ON public.person_file_amendments;
    CREATE POLICY "hr_agent adds person file amendments" ON public.person_file_amendments FOR INSERT TO hr_agent WITH CHECK (true);
  END IF;
END $$;

-- What one of the three new keys names, as (kind, id) rows: a bare id is an entry; { kind, id } names either kind;
-- a list holds either form. A bad shape raises, in words.
CREATE OR REPLACE FUNCTION public.person_file_amendment_targets(p jsonb, p_label text)
RETURNS TABLE (kind text, id uuid) LANGUAGE plpgsql IMMUTABLE AS $fn$
DECLARE
  x jsonb;
  v_kind text;
  v_id text;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) = 'null' THEN RETURN; END IF;
  FOR x IN SELECT * FROM jsonb_array_elements(CASE WHEN jsonb_typeof(p) = 'array' THEN p ELSE jsonb_build_array(p) END) LOOP
    IF jsonb_typeof(x) = 'string' THEN
      v_kind := 'hr_entry'; v_id := x #>> '{}';
    ELSIF jsonb_typeof(x) = 'object' THEN
      v_kind := COALESCE(x->>'kind', 'hr_entry'); v_id := x->>'id';
    ELSE
      RAISE EXCEPTION 'hr_agent_write: % takes an entry id, { kind, id } or a list of them', p_label;
    END IF;
    IF v_kind NOT IN ('hr_entry', 'hr_evidence') THEN
      RAISE EXCEPTION 'hr_agent_write: % names an unknown kind "%" (hr_entry or hr_evidence)', p_label, v_kind;
    END IF;
    IF v_id IS NULL OR v_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
      RAISE EXCEPTION 'hr_agent_write: % needs the id of the thing it names', p_label;
    END IF;
    kind := v_kind; id := v_id::uuid;
    RETURN NEXT;
  END LOOP;
END
$fn$;

REVOKE ALL ON FUNCTION public.person_file_amendment_targets(jsonb, text) FROM PUBLIC, anon, authenticated;

-- hr_agent_write: the live body, plus the links.
CREATE OR REPLACE FUNCTION public.hr_agent_write(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_person uuid;
  v_label text;
  v_covered timestamptz;
  v_summary text;
  v_narr text;
  v_narr_append text;
  e jsonb;
  a jsonb;
  t record;
  v_entry_id uuid;
  v_how text;
  v_why text;
  v_hit integer;
  n_entries integer := 0;
  n_links integer := 0;
  n_withdrawn integer := 0;
  allowed_sources constant text[] :=
    ARRAY['conversation','payroll_event','incident','review','milestone','job_event','report'];
BEGIN
  v_person := (p->>'person_id')::uuid;
  IF v_person IS NULL THEN
    RAISE EXCEPTION 'hr_agent_write: person_id is required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.people WHERE id = v_person) THEN
    RAISE EXCEPTION 'hr_agent_write: person % not found', v_person;
  END IF;

  v_label := COALESCE(NULLIF(btrim(p->>'author_label'), ''), 'HR agent');
  v_covered := COALESCE((p->>'covered_through')::timestamptz, now());
  v_summary := p->>'summary';
  v_narr := p->>'narrative';
  v_narr_append := p->>'narrative_append';
  IF v_narr IS NOT NULL AND v_narr_append IS NOT NULL THEN
    RAISE EXCEPTION 'hr_agent_write: narrative and narrative_append are mutually exclusive';
  END IF;

  FOR e IN SELECT * FROM jsonb_array_elements(COALESCE(p->'entries', '[]'::jsonb)) LOOP
    IF NULLIF(btrim(COALESCE(e->>'content', '')), '') IS NULL THEN
      RAISE EXCEPTION 'hr_agent_write: entry content is required';
    END IF;
    IF e->>'entry_date' IS NULL THEN
      RAISE EXCEPTION 'hr_agent_write: entry_date is required';
    END IF;
    IF NOT (COALESCE(e->>'source', 'conversation') = ANY (allowed_sources)) THEN
      RAISE EXCEPTION 'hr_agent_write: unknown source "%"', e->>'source';
    END IF;
    INSERT INTO public.person_file_entries (person_id, entry_date, content, source, author_label)
    VALUES (v_person, (e->>'entry_date')::date, e->>'content',
            COALESCE(e->>'source', 'conversation'), v_label)
    RETURNING id INTO v_entry_id;
    n_entries := n_entries + 1;

    -- What this new entry corrects or completes: one link a thing named.
    FOREACH v_how IN ARRAY ARRAY['corrects', 'completes'] LOOP
      FOR t IN SELECT * FROM public.person_file_amendment_targets(e->v_how, 'entries[].' || v_how) LOOP
        INSERT INTO public.person_file_amendments (person_id, from_kind, from_id, to_kind, to_id, how, created_by, author_label)
        VALUES (v_person, 'hr_entry', v_entry_id, t.kind, t.id, v_how, auth.uid(), v_label);
        n_links := n_links + 1;
      END LOOP;
    END LOOP;
  END LOOP;

  -- A link between two things already on the file.
  FOR a IN SELECT * FROM jsonb_array_elements(COALESCE(p->'amendments', '[]'::jsonb)) LOOP
    IF COALESCE(a->>'how', '') NOT IN ('corrects', 'completes') THEN
      RAISE EXCEPTION 'hr_agent_write: amendments[].how is corrects or completes';
    END IF;
    IF COALESCE(a->>'from_id', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' OR COALESCE(a->>'to_id', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
      RAISE EXCEPTION 'hr_agent_write: amendments[] needs from_id (the newer thing) and to_id (the older one), each an id';
    END IF;
    IF COALESCE(a->>'from_kind', 'hr_entry') NOT IN ('hr_entry', 'hr_evidence') OR COALESCE(a->>'to_kind', 'hr_entry') NOT IN ('hr_entry', 'hr_evidence') THEN
      RAISE EXCEPTION 'hr_agent_write: amendments[] kinds are hr_entry or hr_evidence';
    END IF;
    INSERT INTO public.person_file_amendments (person_id, from_kind, from_id, to_kind, to_id, how, created_by, author_label)
    VALUES (v_person, COALESCE(a->>'from_kind', 'hr_entry'), (a->>'from_id')::uuid, COALESCE(a->>'to_kind', 'hr_entry'), (a->>'to_id')::uuid,
            a->>'how', auth.uid(), v_label);
    n_links := n_links + 1;
  END LOOP;

  -- A link withdrawn, with its reason. The row stays.
  FOR a IN SELECT * FROM jsonb_array_elements(COALESCE(p->'withdraw_amendments', '[]'::jsonb)) LOOP
    v_why := btrim(COALESCE(a->>'why', ''));
    IF COALESCE(a->>'id', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' OR length(v_why) NOT BETWEEN 1 AND 200 THEN
      RAISE EXCEPTION 'hr_agent_write: withdraw_amendments[] needs id and why (1 to 200 characters)';
    END IF;
    UPDATE public.person_file_amendments
       SET withdrawn_at = now(), withdrawn_by = auth.uid(), withdrawn_why = v_why
     WHERE id = (a->>'id')::uuid AND person_id = v_person AND withdrawn_at IS NULL;
    GET DIAGNOSTICS v_hit = ROW_COUNT;
    IF v_hit = 0 THEN
      RAISE EXCEPTION 'hr_agent_write: no live link % on this person''s file', a->>'id';
    END IF;
    n_withdrawn := n_withdrawn + 1;
  END LOOP;

  IF v_summary IS NOT NULL THEN
    INSERT INTO public.person_files (person_id, kind, content, author_label, covered_through, updated_at)
    VALUES (v_person, 'summary', v_summary, v_label, v_covered, now())
    ON CONFLICT (person_id, kind) DO UPDATE
      SET content = EXCLUDED.content,
          author_label = EXCLUDED.author_label,
          covered_through = EXCLUDED.covered_through,
          updated_at = now();
  END IF;

  IF v_narr IS NOT NULL THEN
    INSERT INTO public.person_files (person_id, kind, content, author_label, covered_through, updated_at)
    VALUES (v_person, 'narrative', v_narr, v_label, v_covered, now())
    ON CONFLICT (person_id, kind) DO UPDATE
      SET content = EXCLUDED.content,
          author_label = EXCLUDED.author_label,
          covered_through = EXCLUDED.covered_through,
          updated_at = now();
  ELSIF v_narr_append IS NOT NULL THEN
    INSERT INTO public.person_files (person_id, kind, content, author_label, covered_through, updated_at)
    VALUES (v_person, 'narrative', v_narr_append, v_label, v_covered, now())
    ON CONFLICT (person_id, kind) DO UPDATE
      SET content = public.person_files.content || E'\n' || EXCLUDED.content,
          author_label = EXCLUDED.author_label,
          covered_through = EXCLUDED.covered_through,
          updated_at = now();
  END IF;

  RETURN jsonb_build_object(
    'entries_inserted', n_entries,
    'summary_written', v_summary IS NOT NULL,
    'narrative_written', (v_narr IS NOT NULL OR v_narr_append IS NOT NULL))
    || CASE WHEN n_links > 0 OR n_withdrawn > 0
         THEN jsonb_build_object('amendments_inserted', n_links, 'amendments_withdrawn', n_withdrawn)
         ELSE '{}'::jsonb END;
END
$fn$;

-- dev_hr_entry_write: the same wrapper, its reply naming each link by its two ends. The words come from the payload
-- and from rows that stood before the call, never from an id this run made, so a plan and its apply hash alike.
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
  v_links jsonb;
  v_withdrawn jsonb;
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

  -- The links, in words, read before the write: each new entry's by its place in the list, then the ones between
  -- things already on the file, then the ones withdrawn (as they stand now).
  SELECT COALESCE(jsonb_agg(x.link ORDER BY x.seq, x.sub), '[]'::jsonb) INTO v_links FROM (
    SELECT (en.ord * 2 + CASE h.how WHEN 'corrects' THEN 0 ELSE 1 END) AS seq, tg.ord AS sub,
           jsonb_build_object(
             'how', h.how,
             'from', jsonb_build_object('new_entry', en.ord, 'day', en.e->>'entry_date'),
             'to', COALESCE(public.person_file_thing(tg.kind, tg.id) - 'person_id' - 'created_at', jsonb_build_object('kind', tg.kind, 'id', tg.id, 'missing', true))) AS link
    FROM jsonb_array_elements(COALESCE(p->'entries', '[]'::jsonb)) WITH ORDINALITY AS en(e, ord)
    CROSS JOIN (VALUES ('corrects'), ('completes')) AS h(how)
    CROSS JOIN LATERAL (SELECT kind, id, row_number() OVER () AS ord FROM public.person_file_amendment_targets(en.e->h.how, 'entries[].' || h.how)) AS tg
    UNION ALL
    SELECT 1000000 + am.ord, 0,
           jsonb_build_object(
             'how', am.a->>'how',
             'from', COALESCE(public.person_file_thing(COALESCE(am.a->>'from_kind', 'hr_entry'), CASE WHEN am.a->>'from_id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (am.a->>'from_id')::uuid END) - 'person_id' - 'created_at', jsonb_build_object('missing', true)),
             'to', COALESCE(public.person_file_thing(COALESCE(am.a->>'to_kind', 'hr_entry'), CASE WHEN am.a->>'to_id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (am.a->>'to_id')::uuid END) - 'person_id' - 'created_at', jsonb_build_object('missing', true)))
    FROM jsonb_array_elements(COALESCE(p->'amendments', '[]'::jsonb)) WITH ORDINALITY AS am(a, ord)
  ) x;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'id', w.a->>'id', 'why', btrim(COALESCE(w.a->>'why', '')),
           'how', am.how,
           'from', public.person_file_thing(am.from_kind, am.from_id) - 'person_id' - 'created_at',
           'to', public.person_file_thing(am.to_kind, am.to_id) - 'person_id' - 'created_at') ORDER BY w.ord), '[]'::jsonb)
    INTO v_withdrawn
    FROM jsonb_array_elements(COALESCE(p->'withdraw_amendments', '[]'::jsonb)) WITH ORDINALITY AS w(a, ord)
    LEFT JOIN public.person_file_amendments am ON am.id = CASE WHEN w.a->>'id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN (w.a->>'id')::uuid END;

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
    -- Only a call that names a link carries the two keys, so every plan made before this migration hashes as it did.
    IF jsonb_array_length(v_links) > 0 THEN v_out := v_out || jsonb_build_object('amendments', v_links); END IF;
    IF jsonb_array_length(v_withdrawn) > 0 THEN v_out := v_out || jsonb_build_object('withdrawn', v_withdrawn); END IF;
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
  'dev-mcp (v2.3722; links since punch list #315): a signed-in dev files an HR entry through the live hr_agent_write with the dev named as author, and with it what the entry corrects or completes, a link between two things already on the file, or a link withdrawn; p_dry_run = true (default) performs and unwinds the write, returning what would be filed. Devs only (is_dev()).';

REVOKE ALL ON FUNCTION public.hr_agent_write(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.hr_agent_write(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.hr_agent_write(jsonb) FROM authenticated;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hr_agent') THEN GRANT EXECUTE ON FUNCTION public.hr_agent_write(jsonb) TO hr_agent; END IF; END $$;
REVOKE ALL ON FUNCTION public.dev_hr_entry_write(jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.dev_hr_entry_write(jsonb, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.dev_hr_entry_write(jsonb, boolean) TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
