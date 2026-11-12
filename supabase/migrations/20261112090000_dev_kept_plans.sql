SET lock_timeout = '3s';

-- One approvals list (punch list #315, upgrade 3): a plan made through the dev seat for a person's HR file can be
-- kept on the server, listed for the owner on People → HR, and applied or dropped from there.
--
-- A seat plan lived only in the session that made it. On a busy day the owner said "Apply it" in six sessions, and a
-- session that ended took its plans with it. A kept plan is the same plan, held here:
--   * dev_kept_plans: the person, the plan verb, the function its apply runs, the payload that function takes, the
--     plan's hash, the dry run's reply as the session read it, and a paragraph of words for the owner. Its state is
--     waiting, applied, dropped or stale; a decided row never changes again.
--   * The hash rule does not move. The hash is still computed by the seat's own code over the payload and the dry
--     run's reply; this table only stores it. Whoever applies (the seat, or People → HR with the same code) runs the
--     dry run again first and compares; a plan that no longer matches is marked stale and the agent plans again.
--   * dev_kept_plan_apply(id) runs the stored function with the stored payload, as the dev who pressed, and marks
--     the row applied in the same transaction, under a row lock, so two presses write once. It runs only the
--     functions named in dev_kept_plan_rpcs(): the dev-gated dry-run doors of the HR file. A plan that carries a
--     file's bytes is never kept, since the bytes are not; it stays in its session.
--   * Devs read the table. Nobody writes it but the four functions here.
--
-- Dev-only, as the HR file is, and it ends with the four fence calls.

CREATE TABLE IF NOT EXISTS public.dev_kept_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  verb text NOT NULL,
  rpc text NOT NULL,
  args jsonb NOT NULL,
  p jsonb NOT NULL,
  plan_hash text NOT NULL,
  reads jsonb,
  words text NOT NULL,
  kept_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  author_label text,
  session_label text,
  kept_at timestamptz NOT NULL DEFAULT now(),
  state text NOT NULL DEFAULT 'waiting',
  decided_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decided_why text,
  result jsonb,
  CONSTRAINT dev_kept_plans_verb_check CHECK (verb ~ '^plan_[a-z_]{2,60}$'),
  CONSTRAINT dev_kept_plans_hash_check CHECK (plan_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT dev_kept_plans_words_length CHECK (length(btrim(words)) BETWEEN 1 AND 2000),
  CONSTRAINT dev_kept_plans_state_check CHECK (state IN ('waiting', 'applied', 'dropped', 'stale')),
  CONSTRAINT dev_kept_plans_size CHECK (length(p::text) <= 400000 AND length(args::text) <= 400000 AND (reads IS NULL OR length(reads::text) <= 200000)),
  CONSTRAINT dev_kept_plans_decided_whole CHECK (
    (state = 'waiting' AND decided_at IS NULL)
    OR (state = 'applied' AND decided_at IS NOT NULL)
    OR (state IN ('dropped', 'stale') AND decided_at IS NOT NULL AND length(btrim(COALESCE(decided_why, ''))) BETWEEN 1 AND 500))
);
COMMENT ON TABLE public.dev_kept_plans IS
  'HR files (punch list #315): a dev seat plan for a person''s file, kept on the server so the owner applies or drops it on People → HR: the plan verb, the function and payload its apply runs, the plan hash, the dry run as read, a paragraph of words, and where it stands (waiting · applied · dropped · stale). Read by devs; written only by the dev_kept_plan_* functions.';
CREATE UNIQUE INDEX IF NOT EXISTS dev_kept_plans_waiting_once ON public.dev_kept_plans (plan_hash) WHERE state = 'waiting';
CREATE INDEX IF NOT EXISTS dev_kept_plans_person_idx ON public.dev_kept_plans (person_id, kept_at DESC);
CREATE INDEX IF NOT EXISTS dev_kept_plans_waiting_idx ON public.dev_kept_plans (kept_at) WHERE state = 'waiting';

ALTER TABLE public.dev_kept_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS dev_kept_plans_dev_select ON public.dev_kept_plans;
CREATE POLICY dev_kept_plans_dev_select ON public.dev_kept_plans FOR SELECT TO authenticated USING (public.is_dev());
REVOKE ALL ON public.dev_kept_plans FROM anon, authenticated;
GRANT SELECT ON public.dev_kept_plans TO authenticated;

-- The functions a kept plan may run: the HR file's dev-gated doors that take (payload, dry_run) and nothing else.
CREATE OR REPLACE FUNCTION public.dev_kept_plan_rpcs()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['dev_hr_entry_write', 'dev_person_doc_write', 'dev_theme_marks_write', 'dev_theme_review_write', 'dev_case_write']
$$;

-- Keep a plan. p: { person_id, verb, rpc, args, p, plan_hash, words, reads?, session? }. The same plan kept twice
-- answers the row that already waits.
CREATE OR REPLACE FUNCTION public.dev_kept_plan_keep(p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_dev_name text;
  v_dev_email text;
  v_label text;
  v_person uuid;
  v_person_name text;
  v_verb text := COALESCE(p->>'verb', '');
  v_rpc text := COALESCE(p->>'rpc', '');
  v_hash text := COALESCE(p->>'plan_hash', '');
  v_words text := btrim(COALESCE(p->>'words', ''));
  v_id uuid;
  v_already boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_kept_plan_keep: devs only' USING ERRCODE = '42501';
  END IF;
  SELECT u.name, u.email INTO v_dev_name, v_dev_email FROM public.users u WHERE u.id = auth.uid();
  v_label := COALESCE(NULLIF(btrim(v_dev_name), ''), v_dev_email);
  IF COALESCE(p->>'person_id', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    RAISE EXCEPTION 'dev_kept_plan_keep: a kept plan is for a person''s file — person_id is required';
  END IF;
  v_person := (p->>'person_id')::uuid;
  SELECT pe.name INTO v_person_name FROM public.people pe WHERE pe.id = v_person;
  IF v_person_name IS NULL THEN
    RAISE EXCEPTION 'dev_kept_plan_keep: person % not found', v_person;
  END IF;
  IF v_verb !~ '^plan_[a-z_]{2,60}$' THEN
    RAISE EXCEPTION 'dev_kept_plan_keep: verb is the plan verb that made the plan';
  END IF;
  IF NOT (v_rpc = ANY (public.dev_kept_plan_rpcs())) THEN
    RAISE EXCEPTION 'dev_kept_plan_keep: a plan of % cannot be kept — it stays in its session', v_verb;
  END IF;
  IF v_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'dev_kept_plan_keep: plan_hash is the hash the plan answered with';
  END IF;
  IF jsonb_typeof(p->'p') <> 'object' OR jsonb_typeof(p->'args') <> 'object' THEN
    RAISE EXCEPTION 'dev_kept_plan_keep: args and p are the plan''s input and the payload its function takes';
  END IF;
  IF length(v_words) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'dev_kept_plan_keep: words says what the plan would do, in 1 to 2,000 characters';
  END IF;

  SELECT k.id INTO v_id FROM public.dev_kept_plans k WHERE k.plan_hash = v_hash AND k.state = 'waiting';
  IF v_id IS NOT NULL THEN
    v_already := true;
  ELSE
    INSERT INTO public.dev_kept_plans (person_id, verb, rpc, args, p, plan_hash, reads, words, kept_by, author_label, session_label)
    VALUES (v_person, v_verb, v_rpc, p->'args', p->'p', v_hash, p->'reads', v_words, auth.uid(), v_label, NULLIF(left(btrim(COALESCE(p->>'session', '')), 120), ''))
    RETURNING id INTO v_id;
  END IF;
  RETURN jsonb_build_object('id', v_id, 'already', v_already, 'person', jsonb_build_object('id', v_person, 'name', v_person_name),
    'waiting_on_this_file', (SELECT count(*) FROM public.dev_kept_plans k WHERE k.person_id = v_person AND k.state = 'waiting'));
END
$fn$;

-- Drop a waiting plan, or mark it stale, each with its reason. A decided plan never changes again.
CREATE OR REPLACE FUNCTION public.dev_kept_plan_decide(p_id uuid, p_state text, p_why text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_row public.dev_kept_plans%ROWTYPE;
  v_why text := btrim(COALESCE(p_why, ''));
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_kept_plan_decide: devs only' USING ERRCODE = '42501';
  END IF;
  IF p_state NOT IN ('dropped', 'stale') THEN
    RAISE EXCEPTION 'dev_kept_plan_decide: a plan is dropped or marked stale here; dev_kept_plan_apply applies one';
  END IF;
  IF length(v_why) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'dev_kept_plan_decide: say why, in 1 to 500 characters';
  END IF;
  SELECT * INTO v_row FROM public.dev_kept_plans k WHERE k.id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'dev_kept_plan_decide: no kept plan %', p_id;
  END IF;
  IF v_row.state <> 'waiting' THEN
    RAISE EXCEPTION 'dev_kept_plan_decide: that plan is already %', v_row.state;
  END IF;
  UPDATE public.dev_kept_plans SET state = p_state, decided_by = auth.uid(), decided_at = now(), decided_why = v_why WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id, 'state', p_state);
END
$fn$;

-- Apply a waiting plan: run its function with its payload as the caller, and mark it applied, in one transaction
-- under the row's lock. The caller has just re-run the dry run and compared the hash; a refusal by the function
-- unwinds everything and the plan still waits.
CREATE OR REPLACE FUNCTION public.dev_kept_plan_apply(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_row public.dev_kept_plans%ROWTYPE;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_kept_plan_apply: devs only' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_row FROM public.dev_kept_plans k WHERE k.id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'dev_kept_plan_apply: no kept plan %', p_id;
  END IF;
  IF v_row.state <> 'waiting' THEN
    RAISE EXCEPTION 'dev_kept_plan_apply: that plan is already %', v_row.state;
  END IF;
  IF NOT (v_row.rpc = ANY (public.dev_kept_plan_rpcs())) THEN
    RAISE EXCEPTION 'dev_kept_plan_apply: % is not a function a kept plan may run', v_row.rpc;
  END IF;
  EXECUTE format('SELECT public.%I($1, false)', v_row.rpc) INTO v_result USING v_row.p;
  UPDATE public.dev_kept_plans SET state = 'applied', decided_by = auth.uid(), decided_at = now(), result = v_result WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id, 'state', 'applied', 'result', v_result);
END
$fn$;

-- The seat applied a plan itself (the session had the owner's word): the kept copy, if one waits, is marked
-- applied. Never raises on a hash nobody kept, so the seat's apply is not held up by it.
CREATE OR REPLACE FUNCTION public.dev_kept_plan_mark_applied(p_plan_hash text, p_result jsonb DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_dev() THEN
    RAISE EXCEPTION 'dev_kept_plan_mark_applied: devs only' USING ERRCODE = '42501';
  END IF;
  UPDATE public.dev_kept_plans SET state = 'applied', decided_by = auth.uid(), decided_at = now(), result = p_result
   WHERE plan_hash = p_plan_hash AND state = 'waiting' RETURNING id INTO v_id;
  RETURN jsonb_build_object('marked', v_id IS NOT NULL, 'id', v_id);
END
$fn$;

COMMENT ON FUNCTION public.dev_kept_plan_keep(jsonb) IS 'HR files (punch list #315): keep a dev seat plan for a person''s file so the owner applies or drops it on People → HR. Devs only.';
COMMENT ON FUNCTION public.dev_kept_plan_decide(uuid, text, text) IS 'HR files (punch list #315): drop a waiting kept plan, or mark it stale, with the reason. Devs only.';
COMMENT ON FUNCTION public.dev_kept_plan_apply(uuid) IS 'HR files (punch list #315): apply a waiting kept plan — run its function with its payload as the caller and mark it applied, in one transaction. The caller re-runs the dry run and compares the hash first. Devs only.';
COMMENT ON FUNCTION public.dev_kept_plan_mark_applied(text, jsonb) IS 'HR files (punch list #315): the dev seat applied a plan itself; mark its kept copy applied, if one waits. Devs only.';

REVOKE ALL ON FUNCTION public.dev_kept_plan_keep(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dev_kept_plan_decide(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dev_kept_plan_apply(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.dev_kept_plan_mark_applied(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_kept_plan_keep(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dev_kept_plan_decide(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dev_kept_plan_apply(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dev_kept_plan_mark_applied(text, jsonb) TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
