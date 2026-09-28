SET lock_timeout = '3s';

-- GC Review for one operator, step 7 (punch list #49): ask by link.
--
-- The assistant phones the account man for his read of each GC, and the call
-- is a cost. She sends him a link instead: no sign-in, his GCs, what each owes
-- and what was last said. He answers from his phone; his answers wait for her.
--
-- Two tables, and neither is a mark:
--   gc_word_asks         - one live link per (week, account man): the GCs it
--                          names, the token, when it runs out, whether it was
--                          emailed / opened / answered / revoked.
--   gc_word_ask_answers  - what he said per GC, pending until the office reads
--                          it. Accepting one is the office writing the mark
--                          itself (gc_statement_round_marks, acted_by = her,
--                          word_from = him, word_heard_via = 'link').
--
-- The link is the capability. The edge function gc-word-ask resolves it under
-- the service role; the client never inserts into either table. The office
-- reads both and decides answers (accepted / dismissed).

CREATE TABLE IF NOT EXISTS public.gc_word_asks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  owner_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  owner_name text NOT NULL DEFAULT '',
  gc_ids uuid[] NOT NULL DEFAULT '{}',
  token text,
  token_hash text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  emailed_at timestamptz,
  emailed_to text,
  opened_at timestamptz,
  answered_at timestamptz,
  revoked_at timestamptz
);

COMMENT ON TABLE public.gc_word_asks IS
  'Ask by link (v2.3985, punch list #49): a no-login link the office sends an account man so he can say where his GCs stand. One live link per (week, account man). The raw token is the capability; it runs out at expires_at and revoked_at turns it off. Rows are written by mint_gc_word_ask() and the gc-word-ask edge function only.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_gc_word_asks_live ON public.gc_word_asks (week_start, owner_user_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_gc_word_asks_token ON public.gc_word_asks (token) WHERE token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gc_word_asks_token_hash ON public.gc_word_asks (token_hash);

CREATE TABLE IF NOT EXISTS public.gc_word_ask_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ask_id uuid NOT NULL REFERENCES public.gc_word_asks(id) ON DELETE CASCADE,
  gc_customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  temperature text,
  note text NOT NULL DEFAULT '',
  expected_pay_by date,
  no_change boolean NOT NULL DEFAULT false,
  answered_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  decided_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  decided_by_name text,
  decided_at timestamptz,
  UNIQUE (ask_id, gc_customer_id)
);

ALTER TABLE public.gc_word_ask_answers DROP CONSTRAINT IF EXISTS gc_word_ask_answers_temperature_check;
ALTER TABLE public.gc_word_ask_answers ADD CONSTRAINT gc_word_ask_answers_temperature_check
  CHECK (temperature IS NULL OR temperature IN ('hot', 'warm', 'cool', 'cold'));
ALTER TABLE public.gc_word_ask_answers DROP CONSTRAINT IF EXISTS gc_word_ask_answers_status_check;
ALTER TABLE public.gc_word_ask_answers ADD CONSTRAINT gc_word_ask_answers_status_check
  CHECK (status IN ('pending', 'accepted', 'dismissed'));
-- An answer is a read with its sentence, or "no change" - never an empty row.
ALTER TABLE public.gc_word_ask_answers DROP CONSTRAINT IF EXISTS gc_word_ask_answers_shape_check;
ALTER TABLE public.gc_word_ask_answers ADD CONSTRAINT gc_word_ask_answers_shape_check
  CHECK (no_change OR (temperature IS NOT NULL AND length(trim(note)) >= 8));

COMMENT ON TABLE public.gc_word_ask_answers IS
  'What an account man answered on his link, one row per GC per ask (v2.3985). pending until the office reads it; accepted = the office saved it as the week''s word (the mark is a separate row in gc_statement_round_marks, written under the office user''s own sign-in); dismissed = the office set it aside.';

CREATE INDEX IF NOT EXISTS idx_gc_word_ask_answers_ask ON public.gc_word_ask_answers (ask_id);

ALTER TABLE public.gc_word_asks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gc_word_ask_answers ENABLE ROW LEVEL SECURITY;

-- The GC Review cohort reads; nobody inserts or deletes from the client.
DROP POLICY IF EXISTS gc_word_asks_select ON public.gc_word_asks;
CREATE POLICY gc_word_asks_select ON public.gc_word_asks FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role = ANY (ARRAY['dev','master_technician','assistant','controller','primary']::public.user_role[])
  )
);

DROP POLICY IF EXISTS gc_word_ask_answers_select ON public.gc_word_ask_answers;
CREATE POLICY gc_word_ask_answers_select ON public.gc_word_ask_answers FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role = ANY (ARRAY['dev','master_technician','assistant','controller','primary']::public.user_role[])
  )
);

-- Deciding an answer: the office roles that write marks, and only as themselves.
DROP POLICY IF EXISTS gc_word_ask_answers_decide ON public.gc_word_ask_answers;
CREATE POLICY gc_word_ask_answers_decide ON public.gc_word_ask_answers FOR UPDATE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role = ANY (ARRAY['dev','master_technician','assistant','controller']::public.user_role[])
  )
) WITH CHECK (
  decided_by = (SELECT auth.uid())
);

GRANT SELECT ON TABLE public.gc_word_asks TO authenticated;
GRANT SELECT ON TABLE public.gc_word_ask_answers TO authenticated;
-- Only the decision is the client's to write; what he said stays as he said it.
REVOKE UPDATE ON TABLE public.gc_word_ask_answers FROM authenticated;
GRANT UPDATE (status, decided_by, decided_by_name, decided_at) ON TABLE public.gc_word_ask_answers TO authenticated;

-- Mint: the week's live link for one account man. An existing live, unexpired
-- link is returned as it is, with the GCs it names brought up to date;
-- p_rotate revokes it and mints a new one.
CREATE OR REPLACE FUNCTION public.mint_gc_word_ask(p_owner_user_id uuid, p_gc_ids uuid[], p_rotate boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_me record;
  v_owner record;
  v_today date := (now() AT TIME ZONE 'America/Chicago')::date;
  v_monday date;
  v_row record;
  v_raw text;
  v_ids uuid[];
  v_id uuid;
  v_expires timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  SELECT u.id, u.name, u.role INTO v_me FROM public.users u WHERE u.id = auth.uid();
  IF v_me.id IS NULL OR v_me.role::text NOT IN ('dev', 'master_technician', 'assistant', 'controller') THEN
    RETURN jsonb_build_object('error', 'Not authorized to ask for the word');
  END IF;
  SELECT u.id, u.name INTO v_owner FROM public.users u WHERE u.id = p_owner_user_id;
  IF v_owner.id IS NULL THEN RETURN jsonb_build_object('error', 'That person was not found'); END IF;

  SELECT COALESCE(array_agg(DISTINCT c.id), '{}') INTO v_ids
  FROM public.customers c WHERE c.id = ANY (COALESCE(p_gc_ids, '{}'));
  IF COALESCE(array_length(v_ids, 1), 0) = 0 THEN RETURN jsonb_build_object('error', 'Pick at least one GC to ask about'); END IF;
  IF array_length(v_ids, 1) > 60 THEN RETURN jsonb_build_object('error', 'Too many GCs for one link'); END IF;

  v_monday := (v_today - (EXTRACT(ISODOW FROM v_today)::int - 1))::date;

  SELECT a.id, a.token, a.expires_at, a.created_at INTO v_row
  FROM public.gc_word_asks a
  WHERE a.week_start = v_monday AND a.owner_user_id = p_owner_user_id AND a.revoked_at IS NULL;

  IF v_row.id IS NOT NULL AND v_row.token IS NOT NULL AND v_row.expires_at > now() AND NOT p_rotate THEN
    UPDATE public.gc_word_asks SET gc_ids = v_ids WHERE id = v_row.id;
    RETURN jsonb_build_object('askId', v_row.id, 'token', v_row.token, 'expiresAt', v_row.expires_at, 'createdAt', v_row.created_at, 'reused', true);
  END IF;

  UPDATE public.gc_word_asks SET revoked_at = now()
  WHERE week_start = v_monday AND owner_user_id = p_owner_user_id AND revoked_at IS NULL;

  v_raw := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_expires := now() + interval '8 days';
  INSERT INTO public.gc_word_asks (week_start, owner_user_id, owner_name, gc_ids, token, token_hash, created_by, created_by_name, expires_at)
  VALUES (v_monday, p_owner_user_id, COALESCE(v_owner.name, ''), v_ids, v_raw, encode(digest(v_raw, 'sha256'), 'hex'), auth.uid(), COALESCE(v_me.name, ''), v_expires)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('askId', v_id, 'token', v_raw, 'expiresAt', v_expires, 'createdAt', now(), 'reused', false);
END;
$$;

COMMENT ON FUNCTION public.mint_gc_word_ask(uuid, uuid[], boolean) IS
  'The week''s ask-by-link for one account man (v2.3985): returns the live link''s token, minting one when there is none, it has run out, or p_rotate is set. Office roles only (dev / master_technician / assistant / controller).';

REVOKE EXECUTE ON FUNCTION public.mint_gc_word_ask(uuid, uuid[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mint_gc_word_ask(uuid, uuid[], boolean) TO authenticated;

-- Turn a link off without replacing it.
CREATE OR REPLACE FUNCTION public.revoke_gc_word_ask(p_ask_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_n int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('error', 'Not authenticated'); END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role::text IN ('dev', 'master_technician', 'assistant', 'controller')
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized to turn the link off');
  END IF;
  UPDATE public.gc_word_asks SET revoked_at = now() WHERE id = p_ask_id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('revoked', v_n > 0);
END;
$$;

COMMENT ON FUNCTION public.revoke_gc_word_ask(uuid) IS
  'Turns an ask-by-link off (v2.3985). Answers already given stay for the office to read.';

REVOKE EXECUTE ON FUNCTION public.revoke_gc_word_ask(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_gc_word_ask(uuid) TO authenticated;

-- A word heard through the link says so.
ALTER TABLE public.gc_statement_round_marks
  DROP CONSTRAINT IF EXISTS gc_statement_round_marks_word_heard_via_check;
ALTER TABLE public.gc_statement_round_marks
  ADD CONSTRAINT gc_statement_round_marks_word_heard_via_check
  CHECK (word_heard_via IS NULL OR word_heard_via IN ('call', 'text', 'in_person', 'email', 'other', 'link'));

COMMENT ON COLUMN public.gc_statement_round_marks.word_heard_via IS
  'How the person entering the word heard it from its source: call | text | in_person | email | other | link (the ask-by-link page, v2.3985). NULL when the source entered it themselves.';

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
