SET lock_timeout = '3s';

-- Messages, cut 4c: contracts from clauses (to-dos/gc-mode/messages/BUILD_PLAN.md on branch spike/gc-mode; the kernels
-- src/lib/contracts/assemble.ts and approval.ts, v2.5247). A contract paper in the Contract library is an ordered set of
-- clauses, each for everyone or for the trades named on it, each with its own version. Anyone in the office changes a
-- clause; a controller or a dev approves it (the owner, 2026-10-12). Every publish moves the paper's revision one up, and
-- a signed copy keeps the words, the revision and each clause's version it was signed with.
--
--   1) gc_clause_approve_team(): dev and controller, named once. The client's copy is GC_CLAUSE_APPROVE_TEAM in
--      src/lib/gc/access.ts. Editing is the office team's, gc_office_team() (GC_CLAUSE_EDIT_TEAM).
--   2) contract_template_documents gains revision (0 until a clause is published) and published_at.
--   3) contract_clauses: the clauses of a paper. Retired, never deleted.
--   4) contract_clause_proposals: every change to a clause. An office edit waits there as proposed; a dev's or a
--      controller's own edit is written there already approved, so the table is each clause's whole history.
--   5) edit_clause, approve_clause_proposal and decline_clause_proposal: the only writers. Each refuses in words before
--      any write, as the kernels do. The tables grant no writes, so nothing reaches them another way.
--   6) contract_paper_clauses(): the paper as one company signs it, the base then the exhibit for its trades, numbered
--      once (assemblePaper's server copy), for the sign paths to freeze.
--   7) person_contract_documents, gc_owner_contract_sends and gc_sows (the three signed copies) gain paper_revision and
--      clause_versions, which a trigger freezes once written.
-- The approvers' push and email, and the editor's text on a decision, are an edge function for later (messages-notify).
-- Idempotent and additive. See docs/migrations/20261012150000_contract_clauses.md.

-- 1) Who approves a clause.
CREATE OR REPLACE FUNCTION public.gc_clause_approve_team()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('dev', 'controller')
  );
$$;

COMMENT ON FUNCTION public.gc_clause_approve_team() IS
  'Messages, cut 4c: who approves a change to a contract clause, and whose own changes publish at once: dev and the controller (the owner, 2026-10-12). Change the audience here, never in a function body. The client''s copy is GC_CLAUSE_APPROVE_TEAM in src/lib/gc/access.ts; access.test.ts fails when they differ.';

REVOKE EXECUTE ON FUNCTION public.gc_clause_approve_team() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gc_clause_approve_team() TO authenticated;

-- A trade name as two spellings of it compare: trimmed, spaces collapsed, case-blind (tradeKey in assemble.ts).
CREATE OR REPLACE FUNCTION public.contract_trade_key(p_trade text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT lower(regexp_replace(btrim(coalesce(p_trade, '')), '\s+', ' ', 'g'));
$$;

-- A scope is {all} alone, or one to forty trade names, each said once and none of them blank or "all".
CREATE OR REPLACE FUNCTION public.contract_clause_scope_ok(p_scope text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT p_scope = ARRAY['all']::text[]
    OR (
      cardinality(p_scope) BETWEEN 1 AND 40
      AND NOT EXISTS (
        SELECT 1 FROM unnest(p_scope) AS t(name)
        WHERE t.name IS NULL OR public.contract_trade_key(t.name) IN ('', 'all') OR length(t.name) > 120
      )
      AND (SELECT count(DISTINCT public.contract_trade_key(t.name)) FROM unnest(p_scope) AS t(name)) = cardinality(p_scope)
    );
$$;

-- The scope as the editor picked it, cleaned: {all}, or each trade once, trimmed, in the order picked (cleanScope).
CREATE OR REPLACE FUNCTION public.contract_clause_scope_clean(p_scope text[])
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM unnest(coalesce(p_scope, '{}')) AS t(name) WHERE public.contract_trade_key(t.name) = 'all') THEN ARRAY['all']::text[]
    ELSE coalesce((
      SELECT array_agg(picked.name ORDER BY picked.at)
      FROM (
        SELECT DISTINCT ON (public.contract_trade_key(t.name)) regexp_replace(btrim(t.name), '\s+', ' ', 'g') AS name, t.at
        FROM unnest(coalesce(p_scope, '{}')) WITH ORDINALITY AS t(name, at)
        WHERE public.contract_trade_key(t.name) <> ''
        ORDER BY public.contract_trade_key(t.name), t.at
      ) AS picked
    ), '{}'::text[])
  END;
$$;

-- 2) The paper's revision: one up on every publish. 0 until its first clause is published.
ALTER TABLE public.contract_template_documents ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0;
ALTER TABLE public.contract_template_documents ADD COLUMN IF NOT EXISTS published_at timestamptz;

COMMENT ON COLUMN public.contract_template_documents.revision IS
  'Messages, cut 4c: the clause paper''s revision, one up on every published change to its clauses (contract_clause_proposals). 0 until a clause is published. The sign page shows it as Version N; a signed copy keeps it as paper_revision.';

-- 3) The clauses.
CREATE TABLE IF NOT EXISTS public.contract_clauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL REFERENCES public.contract_template_documents(id) ON DELETE CASCADE,
  -- Its place on the paper: the base clauses read in this order, then the exhibit in this order.
  sequence_order integer NOT NULL,
  text_en text NOT NULL
    CONSTRAINT contract_clauses_text_en_said CHECK (length(btrim(text_en)) BETWEEN 1 AND 4000),
  -- Empty until someone writes it; the Spanish page shows the English meanwhile.
  text_es text NOT NULL DEFAULT ''
    CONSTRAINT contract_clauses_text_es_size CHECK (length(text_es) <= 4000),
  scope text[] NOT NULL DEFAULT ARRAY['all']::text[]
    CONSTRAINT contract_clauses_scope_ok CHECK (public.contract_clause_scope_ok(scope)),
  version integer NOT NULL DEFAULT 1
    CONSTRAINT contract_clauses_version_from_1 CHECK (version >= 1),
  published_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  published_by_name text NOT NULL DEFAULT '',
  published_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  retired_at timestamptz,
  retired_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  retired_by_name text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

COMMENT ON TABLE public.contract_clauses IS
  'Messages, cut 4c: the clauses of a contract paper (contract_template_documents). scope is {all} or the trades the clause is for, matched trimmed and case-blind on whole names. version is the clause''s own, one up on each change. A retired clause leaves the next paper and stays on every signed copy. Written only by edit_clause and approve_clause_proposal; the office team reads.';

CREATE INDEX IF NOT EXISTS contract_clauses_paper_idx ON public.contract_clauses (paper_id, sequence_order);

-- 4) Every change to a clause: proposed by the office, or approved at once when a dev or a controller made it.
CREATE TABLE IF NOT EXISTS public.contract_clause_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL REFERENCES public.contract_template_documents(id) ON DELETE CASCADE,
  kind text NOT NULL
    CONSTRAINT contract_clause_proposals_kind_known CHECK (kind IN ('new', 'edit', 'retire')),
  -- The clause it changes. A new clause has none until it is approved.
  clause_id uuid REFERENCES public.contract_clauses(id) ON DELETE CASCADE,
  -- The clause's version when it was proposed: approving refuses once the clause has moved on. None for a new clause.
  base_v integer,
  -- The words and the trades it asks for. A retire keeps the clause's words as they stood.
  text_en text NOT NULL,
  text_es text NOT NULL DEFAULT '',
  scope text[] NOT NULL
    CONSTRAINT contract_clause_proposals_scope_ok CHECK (public.contract_clause_scope_ok(scope)),
  by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  by_name text NOT NULL DEFAULT '',
  why text NOT NULL DEFAULT ''
    CONSTRAINT contract_clause_proposals_why_size CHECK (length(why) <= 2000),
  state text NOT NULL DEFAULT 'proposed'
    CONSTRAINT contract_clause_proposals_state_known CHECK (state IN ('proposed', 'approved', 'declined')),
  decided_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  decided_by_name text,
  decided_at timestamptz,
  decline_why text
    CONSTRAINT contract_clause_proposals_decline_why_size CHECK (decline_why IS NULL OR length(decline_why) <= 2000),
  -- Once approved: the clause's version it made, and the paper's revision.
  result_v integer,
  paper_revision integer,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT contract_clause_proposals_names_its_clause CHECK (kind = 'new' OR clause_id IS NOT NULL),
  CONSTRAINT contract_clause_proposals_base_v CHECK ((kind = 'new') = (base_v IS NULL)),
  CONSTRAINT contract_clause_proposals_decided CHECK ((state = 'proposed') = (decided_at IS NULL)),
  CONSTRAINT contract_clause_proposals_declined_why CHECK (state <> 'declined' OR length(btrim(coalesce(decline_why, ''))) > 0),
  CONSTRAINT contract_clause_proposals_approved_result CHECK (state <> 'approved' OR (result_v IS NOT NULL AND paper_revision IS NOT NULL AND clause_id IS NOT NULL))
);

COMMENT ON TABLE public.contract_clause_proposals IS
  'Messages, cut 4c: every change to a contract clause, new, edit or retire. An office edit waits as proposed on the approvers'' Needs you; a dev''s or a controller''s own change is written already approved, so the approved rows are each clause''s history. base_v is the clause''s version it was made against. Written only by the three clause RPCs; the office team reads.';

CREATE INDEX IF NOT EXISTS contract_clause_proposals_waiting_idx ON public.contract_clause_proposals (paper_id, created_at) WHERE state = 'proposed';
CREATE INDEX IF NOT EXISTS contract_clause_proposals_clause_idx ON public.contract_clause_proposals (clause_id, created_at);

-- Who reads: the office team, as everything on the Board. Nobody writes but the RPCs below.
ALTER TABLE public.contract_clauses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_clause_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contract_clauses_office_reads ON public.contract_clauses;
CREATE POLICY contract_clauses_office_reads ON public.contract_clauses FOR SELECT TO authenticated
  USING ((SELECT public.gc_office_team()));
DROP POLICY IF EXISTS contract_clause_proposals_office_reads ON public.contract_clause_proposals;
CREATE POLICY contract_clause_proposals_office_reads ON public.contract_clause_proposals FOR SELECT TO authenticated
  USING ((SELECT public.gc_office_team()));

REVOKE ALL ON TABLE public.contract_clauses FROM anon;
REVOKE ALL ON TABLE public.contract_clause_proposals FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.contract_clauses FROM authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLE public.contract_clause_proposals FROM authenticated;
GRANT SELECT ON TABLE public.contract_clauses TO authenticated;
GRANT SELECT ON TABLE public.contract_clause_proposals TO authenticated;

-- 5) The writers. contract_clause_apply publishes one change: the paper's revision one up, then the clause new (version
-- 1, after the last clause), changed (its version one up) or retired, then the change marked approved with what it
-- made. Only the two RPCs below call it, after their checks.
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
    INSERT INTO public.contract_clauses (paper_id, sequence_order, text_en, text_es, scope, version, published_by, published_by_name, published_at)
    VALUES (
      v_p.paper_id,
      coalesce((SELECT max(c.sequence_order) FROM public.contract_clauses c WHERE c.paper_id = v_p.paper_id), 0) + 1,
      v_p.text_en, v_p.text_es, v_p.scope, 1, p_by, p_by_name, v_now
    )
    RETURNING id, version INTO v_clause, v_v;
  ELSIF v_p.kind = 'edit' THEN
    UPDATE public.contract_clauses
      SET text_en = v_p.text_en, text_es = v_p.text_es, scope = v_p.scope, version = version + 1,
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

-- Someone in the office changes a clause: p_kind new, edit or retire. A dev's or a controller's change publishes at
-- once; anyone else's in the office waits as proposed. Returns {state: published | proposed, ...}.
CREATE OR REPLACE FUNCTION public.edit_clause(
  p_paper_id uuid,
  p_kind text,
  p_clause_id uuid DEFAULT NULL,
  p_text_en text DEFAULT '',
  p_text_es text DEFAULT '',
  p_scope text[] DEFAULT ARRAY['all']::text[],
  p_why text DEFAULT ''
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
  PERFORM 1 FROM public.contract_template_documents WHERE id = p_paper_id FOR UPDATE;
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
       AND (SELECT array_agg(public.contract_trade_key(t.name) ORDER BY public.contract_trade_key(t.name)) FROM unnest(v_clause.scope) AS t(name))
         = (SELECT array_agg(public.contract_trade_key(t.name) ORDER BY public.contract_trade_key(t.name)) FROM unnest(v_scope) AS t(name)) THEN
      RAISE EXCEPTION 'Nothing changed.' USING ERRCODE = 'P0001';
    END IF;
    IF p_kind = 'retire' THEN
      v_en := v_clause.text_en;
      v_es := v_clause.text_es;
      v_scope := v_clause.scope;
    END IF;
  END IF;
  SELECT coalesce(nullif(btrim(u.name), ''), u.email, '') INTO v_name FROM public.users u WHERE u.id = v_uid;
  INSERT INTO public.contract_clause_proposals (paper_id, kind, clause_id, base_v, text_en, text_es, scope, by_user_id, by_name, why)
  VALUES (p_paper_id, p_kind, CASE WHEN p_kind = 'new' THEN NULL ELSE p_clause_id END, CASE WHEN p_kind = 'new' THEN NULL ELSE v_clause.version END,
          v_en, v_es, v_scope, v_uid, coalesce(v_name, ''), btrim(coalesce(p_why, '')))
  RETURNING id INTO v_id;
  IF public.gc_clause_approve_team() THEN
    RETURN public.contract_clause_apply(v_id, v_uid, coalesce(v_name, ''));
  END IF;
  RETURN jsonb_build_object('state', 'proposed', 'proposal_id', v_id, 'clause_id', CASE WHEN p_kind = 'new' THEN NULL ELSE p_clause_id END);
END;
$$;

-- A controller or a dev approves a waiting change: it is published as the proposer wrote it. Refused once the clause has
-- moved on or been retired since, so a newer publish is never overwritten.
CREATE OR REPLACE FUNCTION public.approve_clause_proposal(p_proposal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_p public.contract_clause_proposals%ROWTYPE;
  v_clause public.contract_clauses%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to approve a clause.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_clause_approve_team() THEN
    RAISE EXCEPTION 'Only a controller or a dev approves a clause.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot approve a clause.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_p FROM public.contract_clause_proposals WHERE id = p_proposal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That change is not on file.' USING ERRCODE = 'P0001';
  END IF;
  -- The paper first, as edit_clause locks it, then the change.
  PERFORM 1 FROM public.contract_template_documents WHERE id = v_p.paper_id FOR UPDATE;
  SELECT * INTO v_p FROM public.contract_clause_proposals WHERE id = p_proposal_id FOR UPDATE;
  IF v_p.state <> 'proposed' THEN
    RAISE EXCEPTION 'This change is decided already.' USING ERRCODE = 'P0001';
  END IF;
  IF v_p.kind <> 'new' THEN
    SELECT * INTO v_clause FROM public.contract_clauses WHERE id = v_p.clause_id FOR UPDATE;
    IF NOT FOUND OR v_clause.retired_at IS NOT NULL THEN
      RAISE EXCEPTION 'That clause is retired since % proposed this. Decline it with a why.', v_p.by_name USING ERRCODE = 'P0001';
    END IF;
    IF v_clause.version <> v_p.base_v THEN
      RAISE EXCEPTION 'That clause changed since % proposed this. Decline it and ask % to propose it again.', v_p.by_name, v_p.by_name USING ERRCODE = 'P0001';
    END IF;
  END IF;
  SELECT coalesce(nullif(btrim(u.name), ''), u.email, '') INTO v_name FROM public.users u WHERE u.id = v_uid;
  RETURN public.contract_clause_apply(p_proposal_id, v_uid, coalesce(v_name, ''));
END;
$$;

-- A controller or a dev declines a waiting change, with a why the proposer gets.
CREATE OR REPLACE FUNCTION public.decline_clause_proposal(p_proposal_id uuid, p_why text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_p public.contract_clause_proposals%ROWTYPE;
  v_why text := btrim(coalesce(p_why, ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to decline a clause.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.gc_clause_approve_team() THEN
    RAISE EXCEPTION 'Only a controller or a dev approves a clause.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot decline a clause.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_p FROM public.contract_clause_proposals WHERE id = p_proposal_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That change is not on file.' USING ERRCODE = 'P0001';
  END IF;
  IF v_p.state <> 'proposed' THEN
    RAISE EXCEPTION 'This change is decided already.' USING ERRCODE = 'P0001';
  END IF;
  IF v_why = '' THEN
    RAISE EXCEPTION 'Say why, for %.', v_p.by_name USING ERRCODE = 'P0001';
  END IF;
  IF length(v_why) > 2000 THEN
    RAISE EXCEPTION 'A why holds at most 2,000 characters.' USING ERRCODE = 'P0001';
  END IF;
  SELECT coalesce(nullif(btrim(u.name), ''), u.email, '') INTO v_name FROM public.users u WHERE u.id = v_uid;
  UPDATE public.contract_clause_proposals
    SET state = 'declined', decided_by = v_uid, decided_by_name = coalesce(v_name, ''), decided_at = clock_timestamp(), decline_why = v_why
    WHERE id = p_proposal_id;
  RETURN jsonb_build_object('state', 'declined', 'proposal_id', p_proposal_id);
END;
$$;

REVOKE ALL ON FUNCTION public.edit_clause(uuid, text, uuid, text, text, text[], text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_clause_proposal(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decline_clause_proposal(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.edit_clause(uuid, text, uuid, text, text, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_clause_proposal(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_clause_proposal(uuid, text) TO authenticated;

-- 6) The paper as one company signs it (assemblePaper in src/lib/contracts/assemble.ts): the live clauses for everyone
-- numbered from 1, then the exhibit, each clause naming any of the company's trades once, numbered on from the base, in
-- the paper's language with the English where the Spanish is empty. The sign paths freeze it on the signed copy as
-- clause_versions, with the revision as paper_revision. Not granted to the API: the sign paths run as the service role
-- or inside their own functions.
CREATE OR REPLACE FUNCTION public.contract_paper_clauses(p_paper_id uuid, p_trades text[], p_lang text DEFAULT 'en')
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH wanted AS (
    SELECT DISTINCT public.contract_trade_key(t.name) AS k FROM unnest(coalesce(p_trades, '{}')) AS t(name)
    WHERE public.contract_trade_key(t.name) <> ''
  ), live AS (
    SELECT c.id, c.version, c.sequence_order, c.scope, c.scope = ARRAY['all']::text[] AS for_everyone,
           CASE WHEN p_lang = 'es' AND btrim(c.text_es) <> '' THEN btrim(c.text_es) ELSE btrim(c.text_en) END AS words
    FROM public.contract_clauses c
    WHERE c.paper_id = p_paper_id AND c.retired_at IS NULL
  ), base AS (
    SELECT l.id, l.version, l.words, row_number() OVER (ORDER BY l.sequence_order, l.id) AS n FROM live l WHERE l.for_everyone
  ), ex AS (
    SELECT l.id, l.version, l.words, l.scope,
           (SELECT count(*) FROM base) + row_number() OVER (ORDER BY l.sequence_order, l.id) AS n
    FROM live l
    WHERE NOT l.for_everyone AND EXISTS (SELECT 1 FROM unnest(l.scope) AS s(name) WHERE public.contract_trade_key(s.name) IN (SELECT k FROM wanted))
  ), carried AS (
    SELECT DISTINCT ON (public.contract_trade_key(t.name)) btrim(t.name) AS name, t.at
    FROM unnest(coalesce(p_trades, '{}')) WITH ORDINALITY AS t(name, at)
    WHERE public.contract_trade_key(t.name) IN (SELECT public.contract_trade_key(s.name) FROM ex, unnest(ex.scope) AS s(name))
    ORDER BY public.contract_trade_key(t.name), t.at
  )
  SELECT jsonb_build_object(
    'paperId', p_paper_id,
    'revision', (SELECT d.revision FROM public.contract_template_documents d WHERE d.id = p_paper_id),
    'lang', CASE WHEN p_lang = 'es' THEN 'es' ELSE 'en' END,
    'clauses', coalesce((SELECT jsonb_agg(jsonb_build_object('id', b.id, 'v', b.version, 'n', b.n, 'text', b.words) ORDER BY b.n) FROM base b), '[]'::jsonb),
    'exhibit', coalesce((SELECT jsonb_agg(jsonb_build_object('id', e.id, 'v', e.version, 'n', e.n, 'text', e.words) ORDER BY e.n) FROM ex e), '[]'::jsonb),
    'exhibitFor', coalesce((SELECT jsonb_agg(c.name ORDER BY c.at) FROM carried c), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.contract_paper_clauses(uuid, text[], text) FROM PUBLIC, anon, authenticated;

-- 7) The signed copies: the paper's revision and the clauses as they read when it was signed, frozen once written.
ALTER TABLE public.person_contract_documents ADD COLUMN IF NOT EXISTS paper_revision integer;
ALTER TABLE public.person_contract_documents ADD COLUMN IF NOT EXISTS clause_versions jsonb;
ALTER TABLE public.gc_owner_contract_sends ADD COLUMN IF NOT EXISTS paper_revision integer;
ALTER TABLE public.gc_owner_contract_sends ADD COLUMN IF NOT EXISTS clause_versions jsonb;
ALTER TABLE public.gc_sows ADD COLUMN IF NOT EXISTS paper_revision integer;
ALTER TABLE public.gc_sows ADD COLUMN IF NOT EXISTS clause_versions jsonb;

COMMENT ON COLUMN public.person_contract_documents.clause_versions IS
  'Messages, cut 4c: the clause paper as it read when signed, contract_paper_clauses() frozen ({paperId, revision, lang, clauses, exhibit, exhibitFor}, each clause {id, v, n, text}). Never changed once written (contract_signed_clauses_frozen). Null on a paper signed before clauses, or not built from them.';
COMMENT ON COLUMN public.gc_owner_contract_sends.clause_versions IS
  'Messages, cut 4c: our contract''s clauses as they read when the customer signed, as person_contract_documents.clause_versions. Never changed once written.';
COMMENT ON COLUMN public.gc_sows.clause_versions IS
  'Messages, cut 4c: the statement of work''s clauses (the job''s, then this trade''s) as they read when signed, as person_contract_documents.clause_versions. Never changed once written.';

CREATE OR REPLACE FUNCTION public.contract_signed_clauses_frozen()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'A signed copy keeps the words it was signed with.' USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE TRIGGER contract_signed_clauses_frozen
  BEFORE UPDATE OF clause_versions, paper_revision ON public.person_contract_documents
  FOR EACH ROW
  WHEN (OLD.clause_versions IS NOT NULL AND (NEW.clause_versions IS DISTINCT FROM OLD.clause_versions OR NEW.paper_revision IS DISTINCT FROM OLD.paper_revision))
  EXECUTE FUNCTION public.contract_signed_clauses_frozen();
CREATE OR REPLACE TRIGGER contract_signed_clauses_frozen
  BEFORE UPDATE OF clause_versions, paper_revision ON public.gc_owner_contract_sends
  FOR EACH ROW
  WHEN (OLD.clause_versions IS NOT NULL AND (NEW.clause_versions IS DISTINCT FROM OLD.clause_versions OR NEW.paper_revision IS DISTINCT FROM OLD.paper_revision))
  EXECUTE FUNCTION public.contract_signed_clauses_frozen();
CREATE OR REPLACE TRIGGER contract_signed_clauses_frozen
  BEFORE UPDATE OF clause_versions, paper_revision ON public.gc_sows
  FOR EACH ROW
  WHEN (OLD.clause_versions IS NOT NULL AND (NEW.clause_versions IS DISTINCT FROM OLD.clause_versions OR NEW.paper_revision IS DISTINCT FROM OLD.paper_revision))
  EXECUTE FUNCTION public.contract_signed_clauses_frozen();

-- House rules: read-only training mode and the twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
