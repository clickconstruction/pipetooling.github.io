SET lock_timeout = '3s';

-- Estimator-twin pipeline: the agent conversation layer (RFI_LOOP_PLAN R3 + master plan
-- Wave 4.5). Two pieces:
--
-- 1. twin_questions — the INTERNAL question lane (twin ↔ owner/operator), distinct from
--    bids_rfis (the EXTERNAL lane to GCs). A stateless twin parks a question instead of
--    stalling; a human answers in the fleet console (or promotes it into an RFI draft —
--    the graduation path); the twin pulls answers next run via get_answers.
--    The bid link column is deliberately named about_bid_id, NOT bid_id: the twin
--    write-fence applier auto-detects bid_id columns and would then require an
--    own/assigned bid on every insert — but general questions ("is this a no-go?")
--    legitimately have no bid.
--
-- 2. twin_runs heartbeat columns — current bid/stage/state per run row, so "what are my
--    agents doing right now" is a query (the agent-dashboard groundwork).

CREATE TABLE IF NOT EXISTS public.twin_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  twin_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  about_bid_id uuid REFERENCES public.bids(id) ON DELETE SET NULL,
  mission text,
  question text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status = ANY (ARRAY['open'::text, 'answered'::text, 'promoted'::text, 'dismissed'::text])),
  answer text,
  answered_by uuid REFERENCES public.users(id),
  answered_at timestamptz,
  promoted_rfi_id uuid REFERENCES public.bids_rfis(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS twin_questions_twin_idx ON public.twin_questions (twin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS twin_questions_open_idx ON public.twin_questions (status) WHERE status = 'open';

ALTER TABLE public.twin_questions ENABLE ROW LEVEL SECURITY;

-- Staff read everything; estimator+ answer/promote/dismiss.
DROP POLICY IF EXISTS "Bid pricing users can read twin_questions" ON public.twin_questions;
CREATE POLICY "Bid pricing users can read twin_questions" ON public.twin_questions FOR SELECT
  USING (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role])));
DROP POLICY IF EXISTS "Bid pricing users can write twin_questions" ON public.twin_questions;
CREATE POLICY "Bid pricing users can write twin_questions" ON public.twin_questions FOR ALL
  USING (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])))
  WITH CHECK (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])));

-- Twins: ask-only, structurally. INSERT only as themselves, only status 'open', never
-- pre-filled answers; no UPDATE/DELETE (restrictive per-command; SELECT untouched — the
-- staff read policy already covers the twin's estimator role, and get_answers reads its own).
DROP POLICY IF EXISTS "Twins ask as themselves on twin_questions" ON public.twin_questions;
CREATE POLICY "Twins ask as themselves on twin_questions" ON public.twin_questions AS RESTRICTIVE FOR INSERT
  WITH CHECK (
    NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = ( SELECT auth.uid() ) AND u.is_digital_twin = true)
    OR (twin_user_id = ( SELECT auth.uid() ) AND status = 'open' AND answer IS NULL AND answered_by IS NULL)
  );
DROP POLICY IF EXISTS "Twins never update twin_questions" ON public.twin_questions;
CREATE POLICY "Twins never update twin_questions" ON public.twin_questions AS RESTRICTIVE FOR UPDATE
  USING (NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = ( SELECT auth.uid() ) AND u.is_digital_twin = true));
DROP POLICY IF EXISTS "Twins never delete twin_questions" ON public.twin_questions;
CREATE POLICY "Twins never delete twin_questions" ON public.twin_questions AS RESTRICTIVE FOR DELETE
  USING (NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = ( SELECT auth.uid() ) AND u.is_digital_twin = true));

-- Heartbeat columns on the runs ledger (additive; existing rows untouched).
ALTER TABLE public.twin_runs ADD COLUMN IF NOT EXISTS bid_id uuid REFERENCES public.bids(id) ON DELETE SET NULL;
ALTER TABLE public.twin_runs ADD COLUMN IF NOT EXISTS stage text;
ALTER TABLE public.twin_runs ADD COLUMN IF NOT EXISTS state text CHECK (state IS NULL OR state = ANY (ARRAY['working'::text, 'blocked'::text, 'done'::text]));

-- The fence applier's else-branch is deny-all for tables without bid_id, so twin_questions
-- needs its own allowance branch: a twin may INSERT as itself (ask), never modify. This
-- re-creates the applier verbatim from 20260828070000 plus the one new ELSIF.
CREATE OR REPLACE FUNCTION public.apply_digital_twin_write_blocks() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
  t record;
  created integer := 0;
  ins_allow text;
  mod_allow text;
  has_bid_id boolean;
BEGIN
  FOR t IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity
  LOOP
    -- Per-table allowance predicates (what a TWIN may still write).
    IF t.table_name = 'bids' THEN
      ins_allow := 'created_by = auth.uid()';
      mod_allow := '(created_by = auth.uid() OR estimator_id = auth.uid())';
    ELSIF t.table_name = 'price_book_entries' THEN
      ins_allow := 'EXISTS (SELECT 1 FROM public.price_book_versions v JOIN public.bids b ON b.id = v.bid_id WHERE v.id = version_id AND (b.created_by = auth.uid() OR b.estimator_id = auth.uid()))';
      mod_allow := ins_allow;
    ELSIF t.table_name = 'help_feedback' THEN
      ins_allow := 'true';
      mod_allow := 'false';
    ELSIF t.table_name = 'twin_runs' THEN
      ins_allow := 'false';
      mod_allow := 'false';
    ELSIF t.table_name = 'twin_questions' THEN
      -- The ask lane (R3): a twin parks questions as itself; humans answer/promote.
      ins_allow := 'twin_user_id = auth.uid()';
      mod_allow := 'false';
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = t.table_name AND column_name = 'bid_id'
      ) INTO has_bid_id;
      IF has_bid_id THEN
        ins_allow := 'EXISTS (SELECT 1 FROM public.bids b WHERE b.id = bid_id AND (b.created_by = auth.uid() OR b.estimator_id = auth.uid()))';
        mod_allow := ins_allow;
      ELSE
        ins_allow := 'false';
        mod_allow := 'false';
      END IF;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS digital_twin_write_fence_insert ON public.%I', t.table_name);
    EXECUTE format(
      'CREATE POLICY digital_twin_write_fence_insert ON public.%I AS RESTRICTIVE FOR INSERT WITH CHECK ((NOT public.is_digital_twin()) OR (%s))',
      t.table_name, ins_allow
    );
    EXECUTE format('DROP POLICY IF EXISTS digital_twin_write_fence_update ON public.%I', t.table_name);
    EXECUTE format(
      'CREATE POLICY digital_twin_write_fence_update ON public.%I AS RESTRICTIVE FOR UPDATE USING ((NOT public.is_digital_twin()) OR (%s))',
      t.table_name, mod_allow
    );
    EXECUTE format('DROP POLICY IF EXISTS digital_twin_write_fence_delete ON public.%I', t.table_name);
    EXECUTE format(
      'CREATE POLICY digital_twin_write_fence_delete ON public.%I AS RESTRICTIVE FOR DELETE USING ((NOT public.is_digital_twin()) OR (%s))',
      t.table_name, mod_allow
    );
    created := created + 3;
  END LOOP;

  RETURN created;
END;
$$;

-- House rules: read-only training mode + the digital-twin write fence cover every new table.
-- (twin_runs writes stay service-role-only via twin-login/twin-mcp.)
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
