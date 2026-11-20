SET lock_timeout = '3s';

-- Punch list #389, step 1: the Contract Book takes settings (to-dos/sub-nda-builder/README.md, "The design under any
-- look"; the kernel src/lib/contracts/paperSettings.ts). A Book entry may carry a settings list: each setting with its
-- choices from loosest to strictest, the blanks a clause may hold, and the named levels. A clause is then tied to one
-- choice of one setting, and may be one of several wordings of one place in the paper. The paper for a job is put
-- together from the job's picks.
--
--   1) contract_template_documents gains settings_def (null on every ordinary paper) and a read mark: the revision an
--      attorney read, the attorney's name and the day. A read belongs to a revision, so a new revision is unread.
--   2) contract_clauses and contract_clause_proposals gain slot and when_opts.
--   3) A guard: the settings list, the read mark and the revision are written by the functions here and by nobody
--      signed in directly. The table's own policies let the pay team write the row.
--   4) set_paper_settings and mark_paper_read: a dev or the controller, as a clause is approved.
--   5) edit_clause takes p_slot and p_when_opts. A new parameter is a new function, so the old one is dropped here.
--      A caller that passes the old seven names gets the defaults: a clause in every paper, a place of its own.
--   6) contract_paper_clauses takes p_settings and p_fields. The old three-name call gets the defaults. For a paper
--      built from settings it refuses, in words: no settings, a setting unpicked, a place with no wording or two for
--      the pick, a blank with no value. The words are the kernel's, and the bed runs one set of cases through both.
--   7) A copy of a paper built from settings is never made bare, and never signed bare (person_contract_documents).
--      The sign page signs a copy's body when its clause read fails, so the stop is here, in the database. A paper
--      with a copy out for signature takes no settings list. The gate's own row will carry a job's settings in a
--      later step, which loosens this for that row alone.
--
-- No clause wording is written here. No new table, so no closing calls. Idempotent, and additive apart from the two
-- functions replaced. See docs/migrations/20261120050000_paper_settings.md.

-- 1) The settings list and the read mark.
ALTER TABLE public.contract_template_documents ADD COLUMN IF NOT EXISTS settings_def jsonb;
ALTER TABLE public.contract_template_documents ADD COLUMN IF NOT EXISTS read_revision integer;
ALTER TABLE public.contract_template_documents ADD COLUMN IF NOT EXISTS read_by_name text;
ALTER TABLE public.contract_template_documents ADD COLUMN IF NOT EXISTS read_on date;
ALTER TABLE public.contract_template_documents ADD COLUMN IF NOT EXISTS read_marked_by uuid REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.contract_template_documents ADD COLUMN IF NOT EXISTS read_marked_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contract_template_documents_settings_def_object') THEN
    ALTER TABLE public.contract_template_documents ADD CONSTRAINT contract_template_documents_settings_def_object
      CHECK (settings_def IS NULL OR jsonb_typeof(settings_def) = 'object') NOT VALID;
    ALTER TABLE public.contract_template_documents VALIDATE CONSTRAINT contract_template_documents_settings_def_object;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contract_template_documents_read_mark_whole') THEN
    ALTER TABLE public.contract_template_documents ADD CONSTRAINT contract_template_documents_read_mark_whole
      CHECK ((read_revision IS NULL AND read_by_name IS NULL AND read_on IS NULL)
          OR (read_revision >= 1 AND length(btrim(read_by_name)) BETWEEN 1 AND 120 AND read_on IS NOT NULL)) NOT VALID;
    ALTER TABLE public.contract_template_documents VALIDATE CONSTRAINT contract_template_documents_read_mark_whole;
  END IF;
END $$;

COMMENT ON COLUMN public.contract_template_documents.settings_def IS
  'Punch list #389: the settings list of a paper built from settings ({settings: [{key, label, choices: [{key, label, says, out, fills}]}], fields: [{key, label}], levels: [{key, label, alignedWith, picks}]}), the loosest choice first. Null on every other paper. Written only by set_paper_settings. It holds no clause wording.';
COMMENT ON COLUMN public.contract_template_documents.read_revision IS
  'Punch list #389: the revision an attorney read, with read_by_name and read_on. The paper is read only while this equals revision, so a new revision is unread again. Written only by mark_paper_read.';

-- 2) A clause's place and what puts it in the paper.
ALTER TABLE public.contract_clauses ADD COLUMN IF NOT EXISTS slot text;
ALTER TABLE public.contract_clauses ADD COLUMN IF NOT EXISTS when_opts jsonb;
ALTER TABLE public.contract_clause_proposals ADD COLUMN IF NOT EXISTS slot text;
ALTER TABLE public.contract_clause_proposals ADD COLUMN IF NOT EXISTS when_opts jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contract_clauses_when_shape') THEN
    ALTER TABLE public.contract_clauses ADD CONSTRAINT contract_clauses_when_shape
      CHECK ((when_opts IS NULL OR (jsonb_typeof(when_opts) = 'object' AND when_opts <> '{}'::jsonb))
         AND (slot IS NULL OR (slot ~ '^[a-z][a-z0-9_]{0,39}$' AND when_opts IS NOT NULL))) NOT VALID;
    ALTER TABLE public.contract_clauses VALIDATE CONSTRAINT contract_clauses_when_shape;
  END IF;
END $$;

COMMENT ON COLUMN public.contract_clauses.when_opts IS
  'Punch list #389: the choice that puts this clause in the paper, {setting: choice}. Null: in every paper. Kept when when_opts <@ the job''s settings.';
COMMENT ON COLUMN public.contract_clauses.slot IS
  'Punch list #389: the place this clause is a wording of. Clauses of one paper that share a slot are wordings of one place: exactly one is in the paper for a job''s settings, and it reads where the place''s first wording is. Null: a place of its own.';

-- 3) The guard. The settings list, the read mark and the revision are the functions' to write.
CREATE OR REPLACE FUNCTION public.contract_paper_settings_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.settings_def IS NOT NULL OR NEW.read_revision IS NOT NULL OR NEW.read_by_name IS NOT NULL OR NEW.read_on IS NOT NULL
       OR NEW.read_marked_by IS NOT NULL OR NEW.read_marked_at IS NOT NULL OR coalesce(NEW.revision, 0) <> 0 OR NEW.published_at IS NOT NULL THEN
      RAISE EXCEPTION 'A new paper starts with no settings list, no read mark and no revision.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.settings_def IS DISTINCT FROM OLD.settings_def OR NEW.read_revision IS DISTINCT FROM OLD.read_revision
     OR NEW.read_by_name IS DISTINCT FROM OLD.read_by_name OR NEW.read_on IS DISTINCT FROM OLD.read_on
     OR NEW.read_marked_by IS DISTINCT FROM OLD.read_marked_by OR NEW.read_marked_at IS DISTINCT FROM OLD.read_marked_at
     OR NEW.revision IS DISTINCT FROM OLD.revision OR NEW.published_at IS DISTINCT FROM OLD.published_at THEN
    RAISE EXCEPTION 'A paper''s settings list, its read mark and its revision are set from Contracts and clauses.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.contract_paper_settings_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS contract_paper_settings_guard ON public.contract_template_documents;
CREATE TRIGGER contract_paper_settings_guard
  BEFORE INSERT OR UPDATE ON public.contract_template_documents
  FOR EACH ROW EXECUTE FUNCTION public.contract_paper_settings_guard();

-- Whether a settings list reads at all. The screen names each gap in words before it saves (settingsDefProblems);
-- this is the database's own stop, in a few words.
CREATE OR REPLACE FUNCTION public.contract_paper_settings_def_problem(p_def jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_key CONSTANT text := '^[a-z][a-z0-9_]{0,39}$';
BEGIN
  IF p_def IS NULL THEN
    RETURN NULL;
  END IF;
  IF jsonb_typeof(p_def) <> 'object' OR jsonb_typeof(p_def -> 'settings') IS DISTINCT FROM 'array'
     OR coalesce(jsonb_typeof(p_def -> 'fields'), 'array') <> 'array' OR coalesce(jsonb_typeof(p_def -> 'levels'), 'array') <> 'array' THEN
    RETURN 'That settings list does not read.';
  END IF;
  IF length(p_def::text) > 200000 THEN
    RETURN 'A settings list holds at most 200,000 characters.';
  END IF;
  IF jsonb_array_length(p_def -> 'settings') < 1 THEN
    RETURN 'Add a setting.';
  END IF;
  IF jsonb_array_length(p_def -> 'settings') > 40 OR jsonb_array_length(coalesce(p_def -> 'fields', '[]'::jsonb)) > 40
     OR jsonb_array_length(coalesce(p_def -> 'levels', '[]'::jsonb)) > 12 THEN
    RETURN 'A settings list holds at most 40 settings, 40 blanks and 12 levels.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_def -> 'settings') AS s(v)
    WHERE jsonb_typeof(s.v) <> 'object' OR coalesce(s.v ->> 'key', '') !~ v_key OR btrim(coalesce(s.v ->> 'label', '')) = ''
       OR jsonb_typeof(s.v -> 'choices') IS DISTINCT FROM 'array'
       OR (CASE WHEN jsonb_typeof(s.v -> 'choices') = 'array' THEN jsonb_array_length(s.v -> 'choices') ELSE 0 END) NOT BETWEEN 2 AND 12
  ) THEN
    RETURN 'Every setting needs a key, a name and two to twelve choices.';
  END IF;
  IF (SELECT count(DISTINCT s.v ->> 'key') FROM jsonb_array_elements(p_def -> 'settings') AS s(v)) <> jsonb_array_length(p_def -> 'settings') THEN
    RETURN 'Two settings share a key.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_def -> 'settings') AS s(v), jsonb_array_elements(s.v -> 'choices') AS c(v)
    WHERE jsonb_typeof(c.v) <> 'object' OR coalesce(c.v ->> 'key', '') !~ v_key OR btrim(coalesce(c.v ->> 'label', '')) = ''
       OR coalesce(jsonb_typeof(c.v -> 'fills'), 'object') <> 'object' OR coalesce(jsonb_typeof(c.v -> 'fillsEs'), 'object') <> 'object'
  ) THEN
    RETURN 'Every choice needs a key and a name.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_def -> 'settings') AS s(v)
    WHERE (SELECT count(DISTINCT c.v ->> 'key') FROM jsonb_array_elements(s.v -> 'choices') AS c(v)) <> jsonb_array_length(s.v -> 'choices')
  ) THEN
    RETURN 'Two choices of one setting share a key.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(p_def -> 'fields', '[]'::jsonb)) AS f(v)
    WHERE jsonb_typeof(f.v) <> 'object' OR coalesce(f.v ->> 'key', '') !~ v_key OR f.v ->> 'key' IN ('company', 'job') OR btrim(coalesce(f.v ->> 'label', '')) = ''
  ) THEN
    RETURN 'Every blank needs a key and a name.';
  END IF;
  IF (SELECT count(DISTINCT f.v ->> 'key') FROM jsonb_array_elements(coalesce(p_def -> 'fields', '[]'::jsonb)) AS f(v)) <> jsonb_array_length(coalesce(p_def -> 'fields', '[]'::jsonb)) THEN
    RETURN 'Two blanks share a key.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(coalesce(p_def -> 'levels', '[]'::jsonb)) AS l(v)
    WHERE jsonb_typeof(l.v) <> 'object' OR coalesce(l.v ->> 'key', '') !~ v_key OR btrim(coalesce(l.v ->> 'label', '')) = ''
       OR jsonb_typeof(l.v -> 'picks') IS DISTINCT FROM 'object'
       OR public.contract_paper_picks_problem(p_def, CASE WHEN jsonb_typeof(l.v -> 'picks') = 'object' THEN l.v -> 'picks' ELSE NULL END) IS NOT NULL
  ) THEN
    RETURN 'Every level needs a key, a name and a pick for every setting.';
  END IF;
  IF (SELECT count(DISTINCT l.v ->> 'key') FROM jsonb_array_elements(coalesce(p_def -> 'levels', '[]'::jsonb)) AS l(v)) <> jsonb_array_length(coalesce(p_def -> 'levels', '[]'::jsonb)) THEN
    RETURN 'Two levels share a key.';
  END IF;
  RETURN NULL;
END;
$$;

-- Why these picks cannot put a paper together, or null (picksProblem): every setting needs one of its own choices.
CREATE OR REPLACE FUNCTION public.contract_paper_picks_problem(p_def jsonb, p_picks jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_label text;
BEGIN
  IF p_picks IS NULL OR jsonb_typeof(p_picks) <> 'object' THEN
    RETURN 'This paper is built from settings. It goes with its settings.';
  END IF;
  SELECT s.v ->> 'label' INTO v_label
  FROM jsonb_array_elements(p_def -> 'settings') WITH ORDINALITY AS s(v, at)
  WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(s.v -> 'choices') AS c(v) WHERE c.v ->> 'key' = p_picks ->> (s.v ->> 'key'))
  ORDER BY s.at LIMIT 1;
  RETURN CASE WHEN v_label IS NULL THEN NULL ELSE 'Pick ' || v_label || '.' END;
END;
$$;

-- The blanks' values for these picks (resolvedFields): what each picked choice fills, then what was typed for the job
-- on top. In Spanish a choice's Spanish value where it has one. Only blanks on the list, never an empty value.
CREATE OR REPLACE FUNCTION public.contract_paper_fields(p_def jsonb, p_picks jsonb, p_typed jsonb, p_lang text)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_out jsonb := '{}'::jsonb;
  v_known text[];
  v_ws CONSTANT text := E' \t\n\r';
  r record;
  f record;
  v text;
BEGIN
  SELECT coalesce(array_agg(x.v ->> 'key'), '{}') INTO v_known FROM jsonb_array_elements(coalesce(p_def -> 'fields', '[]'::jsonb)) AS x(v);
  FOR r IN
    SELECT c.v AS choice
    FROM jsonb_array_elements(p_def -> 'settings') WITH ORDINALITY AS s(v, at)
    CROSS JOIN LATERAL jsonb_array_elements(s.v -> 'choices') AS c(v)
    WHERE c.v ->> 'key' = p_picks ->> (s.v ->> 'key')
    ORDER BY s.at
  LOOP
    FOR f IN SELECT e.key, e.value FROM jsonb_each_text(coalesce(r.choice -> 'fills', '{}'::jsonb)) AS e LOOP
      v := CASE WHEN p_lang = 'es' AND btrim(coalesce(r.choice -> 'fillsEs' ->> f.key, ''), v_ws) <> '' THEN r.choice -> 'fillsEs' ->> f.key ELSE f.value END;
      IF f.key = ANY (v_known) AND btrim(coalesce(v, ''), v_ws) <> '' THEN
        v_out := v_out || jsonb_build_object(f.key, btrim(v, v_ws));
      END IF;
    END LOOP;
  END LOOP;
  IF p_typed IS NOT NULL AND jsonb_typeof(p_typed) = 'object' THEN
    FOR f IN SELECT e.key, e.value FROM jsonb_each_text(p_typed) AS e LOOP
      IF f.key = ANY (v_known) AND btrim(coalesce(f.value, ''), v_ws) <> '' THEN
        v_out := v_out || jsonb_build_object(f.key, btrim(f.value, v_ws));
      END IF;
    END LOOP;
  END IF;
  RETURN v_out;
END;
$$;

-- Why a clause cannot be tied this way, or null (whenProblem).
CREATE OR REPLACE FUNCTION public.contract_clause_when_problem(p_def jsonb, p_when jsonb, p_slot text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  r record;
  v_setting jsonb;
BEGIN
  IF p_when IS NULL THEN
    RETURN CASE WHEN p_slot IS NOT NULL THEN 'A wording of a place needs its Only when.' ELSE NULL END;
  END IF;
  IF p_def IS NULL THEN
    RETURN 'This paper has no settings list. A clause is tied to a choice only on a paper that has one.';
  END IF;
  IF jsonb_typeof(p_when) <> 'object' THEN
    RETURN 'That Only when does not read.';
  END IF;
  FOR r IN SELECT e.key, e.value FROM jsonb_each(p_when) AS e LOOP
    SELECT s.v INTO v_setting FROM jsonb_array_elements(p_def -> 'settings') AS s(v) WHERE s.v ->> 'key' = r.key;
    IF v_setting IS NULL THEN
      RETURN r.key || ' is not on this paper''s settings list.';
    END IF;
    IF jsonb_typeof(r.value) <> 'string' OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_setting -> 'choices') AS c(v) WHERE c.v ->> 'key' = r.value #>> '{}') THEN
      RETURN (v_setting ->> 'label') || ' has no choice ' || coalesce(r.value #>> '{}', '') || '.';
    END IF;
  END LOOP;
  IF p_slot IS NOT NULL AND p_slot !~ '^[a-z][a-z0-9_]{0,39}$' THEN
    RETURN 'That place does not read. Pick it again.';
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.contract_paper_settings_def_problem(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.contract_paper_picks_problem(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.contract_paper_fields(jsonb, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.contract_clause_when_problem(jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;

-- Who the two writers below answer: a dev or the controller, signed in, never a twin, an archived account or training.
CREATE OR REPLACE FUNCTION public.contract_paper_settings_caller(p_act text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to %.', p_act USING ERRCODE = '42501';
  END IF;
  IF public.caller_is_archived() THEN
    RAISE EXCEPTION 'This account is archived.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot %.', p_act USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_clause_approve_team() THEN
    RAISE EXCEPTION 'Only a controller or a dev can %.', p_act USING ERRCODE = '42501';
  END IF;
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'Training mode is read-only. Nothing was changed.' USING ERRCODE = '42501';
  END IF;
  RETURN v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.contract_paper_settings_caller(text) FROM PUBLIC, anon, authenticated;

-- 4) A dev or the controller sets a paper's settings list, or takes it away with null. The revision moves one up, so
-- a read mark made before it no longer names the paper. Refused while a live clause is tied to something the new list
-- drops.
CREATE OR REPLACE FUNCTION public.set_paper_settings(p_paper_id uuid, p_def jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old jsonb;
  v_problem text;
  v_rev integer;
  v_def jsonb := CASE WHEN p_def IS NULL OR jsonb_typeof(p_def) = 'null' THEN NULL ELSE p_def END;
BEGIN
  PERFORM public.contract_paper_settings_caller('set a paper''s settings list');
  SELECT d.settings_def INTO v_old FROM public.contract_template_documents d WHERE d.id = p_paper_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That paper is not in the Contract library.' USING ERRCODE = 'P0001';
  END IF;
  v_problem := public.contract_paper_settings_def_problem(v_def);
  IF v_problem IS NOT NULL THEN
    RAISE EXCEPTION '%', v_problem USING ERRCODE = 'P0001';
  END IF;
  IF v_def IS NOT DISTINCT FROM v_old THEN
    RAISE EXCEPTION 'Nothing changed.' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.contract_clauses c
    WHERE c.paper_id = p_paper_id AND c.retired_at IS NULL AND c.when_opts IS NOT NULL
      AND public.contract_clause_when_problem(v_def, c.when_opts, c.slot) IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'A live clause is tied to a setting or a choice this list drops. Change that clause first.' USING ERRCODE = 'P0001';
  END IF;
  -- A paper takes its first settings list before it goes to anyone: a copy already out would have nothing to sign.
  IF v_old IS NULL AND v_def IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.person_contract_documents p
    WHERE p.applied_contract_template_document_id = p_paper_id AND p.status IN ('unsent', 'sent')
  ) THEN
    RAISE EXCEPTION 'A copy of this paper is waiting to be signed. Take it back first. A paper takes its settings list before it goes to anyone.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.contract_template_documents SET settings_def = v_def, revision = revision + 1, published_at = clock_timestamp()
    WHERE id = p_paper_id RETURNING revision INTO v_rev;
  RETURN jsonb_build_object('state', 'saved', 'revision', v_rev);
END;
$$;

-- A dev or the controller marks the paper's revision as read by an attorney, by name and day.
CREATE OR REPLACE FUNCTION public.mark_paper_read(p_paper_id uuid, p_name text, p_on date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_rev integer;
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
BEGIN
  v_uid := public.contract_paper_settings_caller('mark a paper as read');
  SELECT d.revision INTO v_rev FROM public.contract_template_documents d WHERE d.id = p_paper_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That paper is not in the Contract library.' USING ERRCODE = 'P0001';
  END IF;
  IF v_rev < 1 THEN
    RAISE EXCEPTION 'Publish a clause first. A read belongs to a revision.' USING ERRCODE = 'P0001';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'Name the attorney who read it.' USING ERRCODE = 'P0001';
  END IF;
  IF length(v_name) > 120 THEN
    RAISE EXCEPTION 'A name holds at most 120 characters.' USING ERRCODE = 'P0001';
  END IF;
  IF p_on IS NULL OR p_on > (clock_timestamp() AT TIME ZONE 'America/Chicago')::date + 1 THEN
    RAISE EXCEPTION 'Pick the day it was read. It cannot be a day to come.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.contract_template_documents
    SET read_revision = v_rev, read_by_name = v_name, read_on = p_on, read_marked_by = v_uid, read_marked_at = clock_timestamp()
    WHERE id = p_paper_id;
  RETURN jsonb_build_object('state', 'read', 'revision', v_rev, 'by', v_name, 'on', p_on);
END;
$$;

REVOKE ALL ON FUNCTION public.set_paper_settings(uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.mark_paper_read(uuid, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_paper_settings(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_paper_read(uuid, text, date) TO authenticated;

-- 5) The writers carry the place and the Only when. contract_clause_apply keeps its signature.
CREATE OR REPLACE FUNCTION public.contract_clause_apply(p_proposal_id uuid, p_by uuid, p_by_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p public.contract_clause_proposals%ROWTYPE;
  v_rev integer;
  v_clause uuid;
  v_v integer;
  v_now timestamptz := clock_timestamp();
BEGIN
  SELECT * INTO v_p FROM public.contract_clause_proposals WHERE id = p_proposal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That change is not on file.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.contract_template_documents SET revision = revision + 1, published_at = v_now
    WHERE id = v_p.paper_id RETURNING revision INTO v_rev;
  IF v_p.kind = 'new' THEN
    INSERT INTO public.contract_clauses (paper_id, sequence_order, text_en, text_es, scope, slot, when_opts, version, published_by, published_by_name, published_at)
    VALUES (
      v_p.paper_id,
      coalesce((SELECT max(c.sequence_order) FROM public.contract_clauses c WHERE c.paper_id = v_p.paper_id), 0) + 1,
      v_p.text_en, v_p.text_es, v_p.scope, v_p.slot, v_p.when_opts, 1, p_by, p_by_name, v_now
    )
    RETURNING id, version INTO v_clause, v_v;
  ELSIF v_p.kind = 'edit' THEN
    UPDATE public.contract_clauses
      SET text_en = v_p.text_en, text_es = v_p.text_es, scope = v_p.scope, slot = v_p.slot, when_opts = v_p.when_opts, version = version + 1,
          published_by = p_by, published_by_name = p_by_name, published_at = v_now
      WHERE id = v_p.clause_id
      RETURNING id, version INTO v_clause, v_v;
  ELSE
    UPDATE public.contract_clauses
      SET retired_at = v_now, retired_by = p_by, retired_by_name = p_by_name
      WHERE id = v_p.clause_id
      RETURNING id, version INTO v_clause, v_v;
  END IF;
  UPDATE public.contract_clause_proposals
    SET state = 'approved', decided_by = p_by, decided_by_name = p_by_name, decided_at = v_now,
        clause_id = v_clause, result_v = v_v, paper_revision = v_rev
    WHERE id = p_proposal_id;
  RETURN jsonb_build_object('state', 'published', 'proposal_id', p_proposal_id, 'clause_id', v_clause, 'version', v_v, 'revision', v_rev);
END;
$$;

REVOKE ALL ON FUNCTION public.contract_clause_apply(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.edit_clause(uuid, text, uuid, text, text, text[], text);

CREATE OR REPLACE FUNCTION public.edit_clause(
  p_paper_id uuid,
  p_kind text,
  p_clause_id uuid DEFAULT NULL,
  p_text_en text DEFAULT '',
  p_text_es text DEFAULT '',
  p_scope text[] DEFAULT ARRAY['all']::text[],
  p_why text DEFAULT '',
  p_slot text DEFAULT NULL,
  p_when_opts jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_clause public.contract_clauses%ROWTYPE;
  v_en text := btrim(coalesce(p_text_en, ''));
  v_es text := btrim(coalesce(p_text_es, ''));
  v_scope text[];
  v_slot text := nullif(btrim(coalesce(p_slot, '')), '');
  v_when jsonb := CASE WHEN p_when_opts IS NULL OR jsonb_typeof(p_when_opts) = 'null' OR p_when_opts = '{}'::jsonb THEN NULL ELSE p_when_opts END;
  v_def jsonb;
  v_problem text;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to change a clause.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_office_team() THEN
    RAISE EXCEPTION 'Only the office changes a clause.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot change a clause.' USING ERRCODE = '42501';
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('new', 'edit', 'retire') THEN
    RAISE EXCEPTION 'That is not a change to a clause.' USING ERRCODE = 'P0001';
  END IF;
  -- The paper's row is the lock: two changes to one paper publish one after the other.
  SELECT d.settings_def INTO v_def FROM public.contract_template_documents d WHERE d.id = p_paper_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That paper is not in the Contract library.' USING ERRCODE = 'P0001';
  END IF;
  IF p_kind <> 'retire' THEN
    IF v_en = '' THEN
      RAISE EXCEPTION 'Write the clause.' USING ERRCODE = 'P0001';
    END IF;
    IF length(v_en) > 4000 OR length(v_es) > 4000 THEN
      RAISE EXCEPTION 'A clause holds at most 4,000 characters.' USING ERRCODE = 'P0001';
    END IF;
    v_scope := public.contract_clause_scope_clean(p_scope);
    IF cardinality(v_scope) = 0 THEN
      RAISE EXCEPTION 'Pick who it applies to.' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public.contract_clause_scope_ok(v_scope) THEN
      RAISE EXCEPTION 'A clause names at most forty trades.' USING ERRCODE = 'P0001';
    END IF;
    v_problem := public.contract_clause_when_problem(v_def, v_when, v_slot);
    IF v_problem IS NOT NULL THEN
      RAISE EXCEPTION '%', v_problem USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF p_kind <> 'new' THEN
    SELECT * INTO v_clause FROM public.contract_clauses WHERE id = p_clause_id AND paper_id = p_paper_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'That clause is not on this paper.' USING ERRCODE = 'P0001';
    END IF;
    IF v_clause.retired_at IS NOT NULL THEN
      RAISE EXCEPTION 'That clause is retired already.' USING ERRCODE = 'P0001';
    END IF;
    IF p_kind = 'edit'
       AND v_clause.text_en = v_en AND v_clause.text_es = v_es
       AND v_clause.slot IS NOT DISTINCT FROM v_slot AND v_clause.when_opts IS NOT DISTINCT FROM v_when
       AND (SELECT array_agg(public.contract_trade_key(t.name) ORDER BY public.contract_trade_key(t.name)) FROM unnest(v_clause.scope) AS t(name))
         = (SELECT array_agg(public.contract_trade_key(t.name) ORDER BY public.contract_trade_key(t.name)) FROM unnest(v_scope) AS t(name)) THEN
      RAISE EXCEPTION 'Nothing changed.' USING ERRCODE = 'P0001';
    END IF;
    IF p_kind = 'retire' THEN
      v_en := v_clause.text_en;
      v_es := v_clause.text_es;
      v_scope := v_clause.scope;
      v_slot := v_clause.slot;
      v_when := v_clause.when_opts;
    END IF;
  END IF;
  SELECT coalesce(nullif(btrim(u.name), ''), u.email, '') INTO v_name FROM public.users u WHERE u.id = v_uid;
  INSERT INTO public.contract_clause_proposals (paper_id, kind, clause_id, base_v, text_en, text_es, scope, slot, when_opts, by_user_id, by_name, why)
  VALUES (p_paper_id, p_kind, CASE WHEN p_kind = 'new' THEN NULL ELSE p_clause_id END, CASE WHEN p_kind = 'new' THEN NULL ELSE v_clause.version END,
          v_en, v_es, v_scope, v_slot, v_when, v_uid, coalesce(v_name, ''), btrim(coalesce(p_why, '')))
  RETURNING id INTO v_id;
  IF public.gc_clause_approve_team() THEN
    RETURN public.contract_clause_apply(v_id, v_uid, coalesce(v_name, ''));
  END IF;
  RETURN jsonb_build_object('state', 'proposed', 'proposal_id', v_id, 'clause_id', CASE WHEN p_kind = 'new' THEN NULL ELSE p_clause_id END);
END;
$$;

REVOKE ALL ON FUNCTION public.edit_clause(uuid, text, uuid, text, text, text[], text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_clause(uuid, text, uuid, text, text, text[], text, text, jsonb) TO authenticated;

-- 6) The paper as one company signs it (assemblePaper), now for a job's picks too. Each clause reads where its place's
-- first wording is. A clause tied to a choice is kept when when_opts <@ the picks. A paper built from settings is
-- refused in words when it cannot go, so a caller that passes no settings never signs it bare.
DROP FUNCTION IF EXISTS public.contract_paper_clauses(uuid, text[], text);

CREATE OR REPLACE FUNCTION public.contract_paper_clauses(
  p_paper_id uuid,
  p_trades text[],
  p_lang text DEFAULT 'en',
  p_settings jsonb DEFAULT NULL,
  p_fields jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_def jsonb;
  v_rev integer;
  v_lang text := CASE WHEN p_lang = 'es' THEN 'es' ELSE 'en' END;
  v_picks jsonb := coalesce(p_settings, '{}'::jsonb);
  v_fields jsonb := '{}'::jsonb;
  v_problem text;
  v_cand jsonb;
  v_base jsonb := '[]'::jsonb;
  v_ex jsonb := '[]'::jsonb;
  v_named text[] := '{}';
  v_for jsonb;
  v_n integer := 0;
  v_text text;
  v_skey text;
  v_slabel text;
  v_clabel text;
  r record;
  f record;
BEGIN
  SELECT d.settings_def, d.revision INTO v_def, v_rev FROM public.contract_template_documents d WHERE d.id = p_paper_id;
  IF v_def IS NOT NULL THEN
    v_problem := public.contract_paper_picks_problem(v_def, p_settings);
    IF v_problem IS NOT NULL THEN
      RAISE EXCEPTION '%', v_problem USING ERRCODE = 'P0001';
    END IF;
    v_fields := public.contract_paper_fields(v_def, p_settings, p_fields, v_lang);
  END IF;

  -- The live clauses this company's paper can carry: the ones for everyone, and the exhibit for its trades.
  WITH wanted AS (
    SELECT DISTINCT public.contract_trade_key(t.name) AS k FROM unnest(coalesce(p_trades, '{}')) AS t(name)
    WHERE public.contract_trade_key(t.name) <> ''
  ), live AS (
    SELECT c.id, c.version, c.sequence_order, c.scope, c.slot, c.when_opts, c.scope = ARRAY['all']::text[] AS for_everyone,
           CASE WHEN c.slot IS NULL THEN c.sequence_order ELSE min(c.sequence_order) OVER (PARTITION BY c.slot) END AS place,
           CASE WHEN v_lang = 'es' AND btrim(c.text_es) <> '' THEN btrim(c.text_es) ELSE btrim(c.text_en) END AS words
    FROM public.contract_clauses c
    WHERE c.paper_id = p_paper_id AND c.retired_at IS NULL
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'id', l.id, 'version', l.version, 'sequence_order', l.sequence_order, 'place', l.place, 'for_everyone', l.for_everyone,
           'slot', l.slot, 'when_opts', l.when_opts, 'words', l.words, 'scope', to_jsonb(l.scope))), '[]'::jsonb)
    INTO v_cand
  FROM live l
  WHERE l.for_everyone OR EXISTS (SELECT 1 FROM unnest(l.scope) AS s(name) WHERE public.contract_trade_key(s.name) IN (SELECT k FROM wanted));

  -- A place with no wording for the pick, or with two, stops the paper. The places are read in the paper's order.
  IF v_def IS NOT NULL THEN
    FOR r IN
      SELECT x.slot, min(x.sequence_order) AS first_at,
             count(*) FILTER (WHERE x.when_opts IS NULL OR x.when_opts <@ v_picks) AS kept,
             (SELECT coalesce(array_agg(DISTINCT k.key), '{}')
                FROM jsonb_to_recordset(v_cand) AS y(slot text, when_opts jsonb)
                CROSS JOIN LATERAL jsonb_object_keys(coalesce(y.when_opts, '{}'::jsonb)) AS k(key)
               WHERE y.slot = x.slot) AS keys
      FROM jsonb_to_recordset(v_cand) AS x(slot text, sequence_order integer, when_opts jsonb)
      WHERE x.slot IS NOT NULL
      GROUP BY x.slot
      ORDER BY 2, 1
    LOOP
      CONTINUE WHEN r.kept = 1;
      SELECT s.v ->> 'key', s.v ->> 'label' INTO v_skey, v_slabel
      FROM jsonb_array_elements(v_def -> 'settings') WITH ORDINALITY AS s(v, at)
      WHERE s.v ->> 'key' = ANY (r.keys) ORDER BY s.at LIMIT 1;
      CONTINUE WHEN NOT FOUND;
      SELECT c.v ->> 'label' INTO v_clabel
      FROM jsonb_array_elements(v_def -> 'settings') AS s(v), jsonb_array_elements(s.v -> 'choices') AS c(v)
      WHERE s.v ->> 'key' = v_skey AND c.v ->> 'key' = v_picks ->> v_skey;
      CONTINUE WHEN NOT FOUND;
      IF r.kept > 1 THEN
        RAISE EXCEPTION '% has two wordings for %.', v_slabel, v_clabel USING ERRCODE = 'P0001';
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM unnest(r.keys) AS k(key), jsonb_array_elements(v_def -> 'settings') AS s(v), jsonb_array_elements(s.v -> 'choices') AS c(v)
        WHERE s.v ->> 'key' = k.key AND c.v ->> 'key' = v_picks ->> k.key AND c.v -> 'out' = 'true'::jsonb
      ) THEN
        RAISE EXCEPTION '% has no wording for %.', v_slabel, v_clabel USING ERRCODE = 'P0001';
      END IF;
    END LOOP;
  END IF;

  -- The clauses kept, numbered once: the base from 1, then the exhibit. Blanks filled in the list's own order.
  FOR r IN
    SELECT x.id, x.version, x.for_everyone, x.words, x.scope
    FROM jsonb_to_recordset(v_cand) AS x(id uuid, version integer, sequence_order integer, place integer, for_everyone boolean, when_opts jsonb, words text, scope jsonb)
    WHERE x.when_opts IS NULL OR x.when_opts <@ v_picks
    ORDER BY x.for_everyone DESC, x.place, x.sequence_order, x.id
  LOOP
    v_n := v_n + 1;
    v_text := r.words;
    IF v_def IS NOT NULL THEN
      FOR f IN
        SELECT e.v ->> 'key' AS key, e.v ->> 'label' AS label
        FROM jsonb_array_elements(coalesce(v_def -> 'fields', '[]'::jsonb)) WITH ORDINALITY AS e(v, at) ORDER BY e.at
      LOOP
        IF position('{' || f.key || '}' IN r.words) > 0 AND NOT (v_fields ? f.key) THEN
          RAISE EXCEPTION 'Clause % has a blank with no value: %.', v_n, f.label USING ERRCODE = 'P0001';
        END IF;
        IF v_fields ? f.key THEN
          v_text := replace(v_text, '{' || f.key || '}', v_fields ->> f.key);
        END IF;
      END LOOP;
    END IF;
    IF r.for_everyone THEN
      v_base := v_base || jsonb_build_object('id', r.id, 'v', r.version, 'n', v_n, 'text', v_text);
    ELSE
      v_ex := v_ex || jsonb_build_object('id', r.id, 'v', r.version, 'n', v_n, 'text', v_text);
      v_named := v_named || ARRAY(SELECT public.contract_trade_key(s.name) FROM jsonb_array_elements_text(r.scope) AS s(name));
    END IF;
  END LOOP;

  -- The company's trades the exhibit carries, in the company's own order and spelling.
  SELECT coalesce(jsonb_agg(c.name ORDER BY c.at), '[]'::jsonb) INTO v_for
  FROM (
    SELECT DISTINCT ON (public.contract_trade_key(t.name)) btrim(t.name) AS name, t.at
    FROM unnest(coalesce(p_trades, '{}')) WITH ORDINALITY AS t(name, at)
    WHERE public.contract_trade_key(t.name) = ANY (v_named)
    ORDER BY public.contract_trade_key(t.name), t.at
  ) AS c;

  RETURN jsonb_build_object(
    'paperId', p_paper_id,
    'revision', v_rev,
    'lang', v_lang,
    'clauses', v_base,
    'exhibit', v_ex,
    'exhibitFor', v_for
  ) || CASE WHEN v_def IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('settings', p_settings, 'fields', v_fields) END;
END;
$$;

REVOKE ALL ON FUNCTION public.contract_paper_clauses(uuid, text[], text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.contract_paper_clauses(uuid, text[], text, jsonb, jsonb) IS
  'Punch list #389 (was Messages, cut 4c): the paper as one company signs it, the base then the exhibit for its trades, numbered once, in the paper''s language. For a paper built from settings (settings_def) it takes the job''s picks and typed blanks, keeps a clause when when_opts <@ the picks, fills the blanks, and refuses in words when the paper cannot go. assemblePaper in src/lib/contracts/assemble.ts is its twin; supabase/tests/paper_settings runs one set of cases through both.';

-- 7) A copy of a paper built from settings is never made bare, and a copy is never signed onto one. Until a job's row
-- carries its settings, such a paper goes to nobody. The sign page signs a copy's body when its clause read fails, so
-- this is the stop that holds whatever the functions do.
CREATE OR REPLACE FUNCTION public.contract_copy_refuses_bare_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.applied_contract_template_document_id IS NOT NULL
     AND (TG_OP = 'INSERT'
          OR NEW.applied_contract_template_document_id IS DISTINCT FROM OLD.applied_contract_template_document_id
          OR (NEW.status = 'signed' AND OLD.status IS DISTINCT FROM 'signed'))
     AND EXISTS (SELECT 1 FROM public.contract_template_documents d WHERE d.id = NEW.applied_contract_template_document_id AND d.settings_def IS NOT NULL) THEN
    RAISE EXCEPTION 'This paper is built from settings. It goes from a job, with its settings.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.contract_copy_refuses_bare_settings() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS contract_copy_refuses_bare_settings ON public.person_contract_documents;
CREATE TRIGGER contract_copy_refuses_bare_settings
  BEFORE INSERT OR UPDATE OF applied_contract_template_document_id, status ON public.person_contract_documents
  FOR EACH ROW EXECUTE FUNCTION public.contract_copy_refuses_bare_settings();
