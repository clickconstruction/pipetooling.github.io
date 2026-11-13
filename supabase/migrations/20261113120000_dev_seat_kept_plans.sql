SET lock_timeout = '3s';

-- One approvals list (punch list #315, upgrade 3a): a plan an agent made on a person's HR file, kept for a yes.
--
-- The dev seat writes under plan → apply: a plan is a dry run with a hash, and the apply quotes the hash. The plan
-- itself was stored nowhere. It lived in the session that made it, so with ten sessions on one file the owner said
-- "Apply it" in each of them, and a plan was lost when its session ended.
--
-- dev_seat_kept_plans holds a plan for that yes:
--   * One row = one plan: the person, the plan verb, its arguments whole, the plan hash, the dry run's reply as the
--     session was shown it, one paragraph of words, who kept it and from which session.
--   * Nothing about plan → apply changes. A kept plan is the same arguments and the same hash, held on the server
--     and not in a transcript. Whoever applies it runs the dry run again and writes only when the hash still matches.
--   * It is decided once: applied, dropped (with a reason) or stale (the dry run no longer matches, with the
--     mismatch in words). A decided plan stays on the table. Nothing is deleted.
--   * Only a plan about a person's HR file may be kept, from a short list of verbs. A plan that carries a file's
--     bytes is never kept (the bytes are not stored), and neither is a plan for counsel-only material: its words
--     stay in the session that made them.
--   * Devs read. Nobody writes the table directly: dev_kept_plan_keep and dev_kept_plan_decide are the two doors.
--     The HR agent's key has no grant, and the row is never filed to Drive.
--
-- This migration builds no way to apply a plan from the app. Who may press Apply there (any dev, or the owner
-- alone) is the owner's call; until he makes it a plan is applied in a session on his word, as today.

CREATE TABLE IF NOT EXISTS public.dev_seat_kept_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  verb text NOT NULL,
  args jsonb NOT NULL,
  plan_hash text NOT NULL,
  reply jsonb NOT NULL DEFAULT '{}'::jsonb,
  words text NOT NULL,
  kept_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  author_label text,
  session_label text,
  kept_at timestamptz NOT NULL DEFAULT now(),
  state text NOT NULL DEFAULT 'waiting',
  decided_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  decided_label text,
  decided_at timestamptz,
  decided_why text,
  CONSTRAINT dev_seat_kept_plans_verb_check CHECK (verb ~ '^plan_[a-z_]{1,60}$'),
  CONSTRAINT dev_seat_kept_plans_args_object CHECK (jsonb_typeof(args) = 'object'),
  CONSTRAINT dev_seat_kept_plans_args_size CHECK (pg_column_size(args) <= 400000),
  CONSTRAINT dev_seat_kept_plans_reply_size CHECK (pg_column_size(reply) <= 60000),
  CONSTRAINT dev_seat_kept_plans_hash_check CHECK (plan_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT dev_seat_kept_plans_words_length CHECK (length(btrim(words)) BETWEEN 1 AND 1200),
  CONSTRAINT dev_seat_kept_plans_session_length CHECK (session_label IS NULL OR length(session_label) <= 120),
  CONSTRAINT dev_seat_kept_plans_state_check CHECK (state IN ('waiting', 'applied', 'dropped', 'stale')),
  CONSTRAINT dev_seat_kept_plans_decided_whole CHECK (
    (state = 'waiting' AND decided_at IS NULL AND decided_why IS NULL)
    OR (state = 'applied' AND decided_at IS NOT NULL AND (decided_why IS NULL OR length(decided_why) <= 500))
    OR (state IN ('dropped', 'stale') AND decided_at IS NOT NULL AND decided_why IS NOT NULL AND length(btrim(decided_why)) BETWEEN 1 AND 500))
);

COMMENT ON TABLE public.dev_seat_kept_plans IS
  'HR files (punch list #315): a plan the dev seat made on a person''s HR file, kept for a yes: the verb, its arguments, the plan hash, the dry run''s reply as shown and one paragraph of words. Decided once (applied, dropped with a reason, or stale when the dry run no longer matches) and never deleted. Dev-only; written only by dev_kept_plan_keep and dev_kept_plan_decide. Never holds a file''s bytes or counsel-only material.';
COMMENT ON COLUMN public.dev_seat_kept_plans.args IS 'The plan verb''s arguments, whole, as the session sent them. An apply sends these again with plan_hash.';
COMMENT ON COLUMN public.dev_seat_kept_plans.reply IS 'The dry run''s reply as the session was shown it, capped by the seat. For reading; an apply runs the dry run again and trusts only that.';
COMMENT ON COLUMN public.dev_seat_kept_plans.state IS 'waiting until decided once: applied, dropped (decided_why says why) or stale (the dry run no longer matched; decided_why holds the mismatch in words).';

-- The same plan is kept once while it waits.
CREATE UNIQUE INDEX IF NOT EXISTS dev_seat_kept_plans_waiting_once
  ON public.dev_seat_kept_plans (person_id, verb, plan_hash) WHERE state = 'waiting';
CREATE INDEX IF NOT EXISTS dev_seat_kept_plans_waiting_idx ON public.dev_seat_kept_plans (kept_at) WHERE state = 'waiting';
CREATE INDEX IF NOT EXISTS dev_seat_kept_plans_person_idx ON public.dev_seat_kept_plans (person_id, kept_at DESC);

-- The guard. A kept plan is what it was when kept: only its decision may be set, and only once.
CREATE OR REPLACE FUNCTION public.dev_seat_kept_plans_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
BEGIN
  IF NEW.person_id <> OLD.person_id OR NEW.verb <> OLD.verb OR NEW.args <> OLD.args OR NEW.plan_hash <> OLD.plan_hash
     OR NEW.reply <> OLD.reply OR NEW.words <> OLD.words OR NEW.kept_by IS DISTINCT FROM OLD.kept_by
     OR NEW.author_label IS DISTINCT FROM OLD.author_label OR NEW.session_label IS DISTINCT FROM OLD.session_label
     OR NEW.kept_at <> OLD.kept_at THEN
    RAISE EXCEPTION 'dev_seat_kept_plans: a kept plan is what it was when kept; drop it and keep the new plan' USING ERRCODE = '23514';
  END IF;
  IF OLD.state <> 'waiting' THEN
    RAISE EXCEPTION 'dev_seat_kept_plans: this plan was already decided (%)', OLD.state USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$fn$;
DROP TRIGGER IF EXISTS dev_seat_kept_plans_guard ON public.dev_seat_kept_plans;
CREATE TRIGGER dev_seat_kept_plans_guard BEFORE UPDATE ON public.dev_seat_kept_plans
  FOR EACH ROW EXECUTE FUNCTION public.dev_seat_kept_plans_guard();

ALTER TABLE public.dev_seat_kept_plans ENABLE ROW LEVEL SECURITY;

-- Devs read. No insert, update or delete policy exists and no such grant is made: the two doors below write.
DROP POLICY IF EXISTS dev_seat_kept_plans_dev_select ON public.dev_seat_kept_plans;
CREATE POLICY dev_seat_kept_plans_dev_select ON public.dev_seat_kept_plans FOR SELECT TO authenticated USING (public.is_dev());
REVOKE ALL ON public.dev_seat_kept_plans FROM anon, authenticated;
GRANT SELECT ON public.dev_seat_kept_plans TO authenticated;

-- The plan verbs a kept plan may carry: the ones about a person's HR file whose arguments are words alone.
-- plan_person_evidence is left out on purpose (its files ride as bytes); a later migration adds a verb by replacing
-- this function.
CREATE OR REPLACE FUNCTION public.dev_kept_plan_verbs()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['plan_hr_entry', 'plan_person_doc', 'plan_person_report']
$$;
REVOKE ALL ON FUNCTION public.dev_kept_plan_verbs() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_kept_plan_verbs() TO authenticated;

-- ── keep ─────────────────────────────────────────────────────────────────────────────────────────
-- p: { person_id, verb, args, plan_hash, reply?, words, session? }
-- The person named must be the person the arguments write to. Refused: a verb off the list, arguments that carry a
-- file's bytes, arguments marked counsel-only anywhere, a change to a counsel-only document, and the same plan
-- already waiting. Returns { kept_id, person, verb, state, waiting } with waiting the person's plans now waiting.
CREATE OR REPLACE FUNCTION public.dev_kept_plan_keep(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_dev_name text;
  v_dev_email text;
  v_label text;
  v_person uuid;
  v_person_name text;
  v_verb text;
  v_args jsonb;
  v_hash text;
  v_words text;
  v_inner jsonb;
  v_target text;
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_kept_plan_keep: devs only' USING ERRCODE = '42501';
  END IF;
  SELECT u.name, u.email INTO v_dev_name, v_dev_email FROM public.users u WHERE u.id = auth.uid();
  v_label := COALESCE(NULLIF(btrim(v_dev_name), ''), v_dev_email);
  IF v_label IS NULL THEN
    RAISE EXCEPTION 'dev_kept_plan_keep: no users row for the caller';
  END IF;
  IF COALESCE(p->>'person_id', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    RAISE EXCEPTION 'dev_kept_plan_keep: person_id is required';
  END IF;
  v_person := (p->>'person_id')::uuid;
  SELECT pe.name INTO v_person_name FROM public.people pe WHERE pe.id = v_person;
  IF v_person_name IS NULL THEN
    RAISE EXCEPTION 'dev_kept_plan_keep: person % not found', v_person;
  END IF;

  v_verb := COALESCE(p->>'verb', '');
  IF NOT (v_verb = ANY (public.dev_kept_plan_verbs())) THEN
    RAISE EXCEPTION 'dev_kept_plan_keep: % is not a plan that can be kept; the list is %', COALESCE(NULLIF(v_verb, ''), 'that'), array_to_string(public.dev_kept_plan_verbs(), ', ');
  END IF;
  v_args := p->'args';
  IF v_args IS NULL OR jsonb_typeof(v_args) <> 'object' THEN
    RAISE EXCEPTION 'dev_kept_plan_keep: args is the plan verb''s arguments, an object';
  END IF;
  v_hash := lower(COALESCE(p->>'plan_hash', ''));
  IF v_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'dev_kept_plan_keep: plan_hash is the hash the plan answered with';
  END IF;
  v_words := btrim(COALESCE(p->>'words', ''));
  IF length(v_words) NOT BETWEEN 1 AND 1200 THEN
    RAISE EXCEPTION 'dev_kept_plan_keep: words is one paragraph on what the plan does (1 to 1,200 characters)';
  END IF;
  IF length(COALESCE(p->>'session', '')) > 120 THEN
    RAISE EXCEPTION 'dev_kept_plan_keep: session is at most 120 characters';
  END IF;

  -- Never a file's bytes, and never counsel-only material: both stay in the session that made the plan.
  IF jsonb_path_exists(v_args, '$.**.content_base64') THEN
    RAISE EXCEPTION 'dev_kept_plan_keep: a plan that carries a file''s bytes is not kept; apply it in its session';
  END IF;
  IF jsonb_path_exists(v_args, '$.**.counsel_only ? (@ == true)') THEN
    RAISE EXCEPTION 'dev_kept_plan_keep: a counsel-only plan is not kept; its words stay in the session that made it';
  END IF;

  -- The person named is the person the arguments write to.
  IF v_verb = 'plan_hr_entry' THEN
    v_inner := v_args->'entry';
    v_target := v_inner->>'person_id';
  ELSIF v_verb = 'plan_person_doc' THEN
    v_inner := v_args->'doc';
    v_target := v_inner->>'person_id';
    IF COALESCE(v_inner->>'doc_id', '') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       AND EXISTS (SELECT 1 FROM public.documents d WHERE d.id = (v_inner->>'doc_id')::uuid AND d.counsel_only) THEN
      RAISE EXCEPTION 'dev_kept_plan_keep: a change to a counsel-only document is not kept; its words stay in the session that made it';
    END IF;
  ELSE
    v_inner := v_args->'report';
    IF COALESCE(v_inner->>'report_id', '') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
      SELECT r.subject_person_id::text INTO v_target FROM public.person_reports r WHERE r.id = (v_inner->>'report_id')::uuid;
    END IF;
  END IF;
  IF v_inner IS NULL OR jsonb_typeof(v_inner) <> 'object' OR v_target IS NULL OR lower(v_target) <> v_person::text THEN
    RAISE EXCEPTION 'dev_kept_plan_keep: the plan''s arguments do not write to this person''s file';
  END IF;

  IF EXISTS (SELECT 1 FROM public.dev_seat_kept_plans k WHERE k.person_id = v_person AND k.verb = v_verb AND k.plan_hash = v_hash AND k.state = 'waiting') THEN
    RAISE EXCEPTION 'dev_kept_plan_keep: this plan is already kept and waiting' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.dev_seat_kept_plans (person_id, verb, args, plan_hash, reply, words, kept_by, author_label, session_label)
  VALUES (v_person, v_verb, v_args, v_hash, COALESCE(p->'reply', '{}'::jsonb), v_words, auth.uid(), v_label, NULLIF(btrim(COALESCE(p->>'session', '')), ''))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'kept_id', v_id,
    'person', jsonb_build_object('id', v_person, 'name', v_person_name),
    'verb', v_verb,
    'state', 'waiting',
    'waiting', (SELECT count(*) FROM public.dev_seat_kept_plans k WHERE k.person_id = v_person AND k.state = 'waiting'));
END
$fn$;
COMMENT ON FUNCTION public.dev_kept_plan_keep(jsonb) IS
  'HR files (punch list #315): keep a plan the dev seat made on a person''s HR file for a yes, as the dev. Only the verbs dev_kept_plan_verbs() lists; never a file''s bytes, never counsel-only material; the person named must be the one the arguments write to. Devs only.';
REVOKE ALL ON FUNCTION public.dev_kept_plan_keep(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_kept_plan_keep(jsonb) TO authenticated;

-- ── decide ───────────────────────────────────────────────────────────────────────────────────────
-- A waiting plan is decided once: applied (after the apply went through), dropped (why is required) or stale (the
-- dry run no longer matched; why holds the mismatch in words). This records the decision. It applies nothing.
CREATE OR REPLACE FUNCTION public.dev_kept_plan_decide(p_id uuid, p_state text, p_why text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_dev_name text;
  v_dev_email text;
  v_label text;
  v_row public.dev_seat_kept_plans%ROWTYPE;
  v_why text := NULLIF(btrim(COALESCE(p_why, '')), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_kept_plan_decide: devs only' USING ERRCODE = '42501';
  END IF;
  SELECT u.name, u.email INTO v_dev_name, v_dev_email FROM public.users u WHERE u.id = auth.uid();
  v_label := COALESCE(NULLIF(btrim(v_dev_name), ''), v_dev_email);
  IF p_state IS NULL OR p_state NOT IN ('applied', 'dropped', 'stale') THEN
    RAISE EXCEPTION 'dev_kept_plan_decide: state is applied, dropped or stale';
  END IF;
  IF p_state IN ('dropped', 'stale') AND v_why IS NULL THEN
    RAISE EXCEPTION 'dev_kept_plan_decide: say why (1 to 500 characters)';
  END IF;
  IF length(COALESCE(v_why, '')) > 500 THEN
    RAISE EXCEPTION 'dev_kept_plan_decide: why is at most 500 characters';
  END IF;
  SELECT * INTO v_row FROM public.dev_seat_kept_plans k WHERE k.id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'dev_kept_plan_decide: no such kept plan';
  END IF;
  IF v_row.state <> 'waiting' THEN
    RAISE EXCEPTION 'dev_kept_plan_decide: this plan was already decided (%)', v_row.state;
  END IF;
  UPDATE public.dev_seat_kept_plans k
     SET state = p_state, decided_by = auth.uid(), decided_label = v_label, decided_at = now(), decided_why = v_why
   WHERE k.id = p_id;
  RETURN jsonb_build_object('kept_id', p_id, 'state', p_state, 'person_id', v_row.person_id, 'verb', v_row.verb,
    'waiting', (SELECT count(*) FROM public.dev_seat_kept_plans k WHERE k.person_id = v_row.person_id AND k.state = 'waiting'));
END
$fn$;
COMMENT ON FUNCTION public.dev_kept_plan_decide(uuid, text, text) IS
  'HR files (punch list #315): record the one decision on a kept plan, as the dev: applied, dropped (why required) or stale (why holds the mismatch). It applies nothing; the apply is the plan verb''s own. Devs only.';
REVOKE ALL ON FUNCTION public.dev_kept_plan_decide(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_kept_plan_decide(uuid, text, text) TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
