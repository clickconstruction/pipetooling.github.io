SET lock_timeout = '3s';

-- Wendi audit loop v2 (owner decision 2026-08-30, docs/twins/FEEDBACK_LOOP.md): the
-- "Audits" tab on the Bids page. A twin finishing a bid opens an audit (pending) with
-- quick links (CT view link + PT bid) and seeds its questions; the human auditor leaves
-- sectioned notes + answers right there and hits Finish (done, which also flips the CT
-- project to reviewed via the bridge); the agent digests every note into doctrine /
-- robot books / code / bid-only, posts a receipt reply under each, and closes the
-- audit (digested). Receipts are the loop's proof: the auditor sees feedback landed.

CREATE TABLE IF NOT EXISTS public.bid_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL UNIQUE REFERENCES public.bids(id) ON DELETE CASCADE,
  ct_project_id uuid,
  ct_view_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status = ANY (ARRAY['pending'::text, 'done'::text, 'digested'::text])),
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  completed_by uuid REFERENCES public.users(id),
  digested_at timestamptz,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bid_audits_status_idx ON public.bid_audits (status, requested_at);

CREATE TABLE IF NOT EXISTS public.bid_audit_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  audit_id uuid NOT NULL REFERENCES public.bid_audits(id) ON DELETE CASCADE,
  section text NOT NULL DEFAULT 'general' CHECK (section = ANY (ARRAY['counts'::text, 'footage'::text, 'pricing'::text, 'scope'::text, 'general'::text])),
  kind text NOT NULL DEFAULT 'note' CHECK (kind = ANY (ARRAY['note'::text, 'question'::text, 'answer'::text, 'receipt'::text])),
  body text NOT NULL,
  parent_id uuid REFERENCES public.bid_audit_notes(id) ON DELETE CASCADE,
  author_id uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  digested_at timestamptz,
  digest_outcome text CHECK (digest_outcome IS NULL OR digest_outcome = ANY (ARRAY['doctrine'::text, 'books'::text, 'code'::text, 'bid_only'::text]))
);
CREATE INDEX IF NOT EXISTS bid_audit_notes_bid_idx ON public.bid_audit_notes (bid_id, created_at);
CREATE INDEX IF NOT EXISTS bid_audit_notes_audit_idx ON public.bid_audit_notes (audit_id, created_at);

ALTER TABLE public.bid_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bid_audit_notes ENABLE ROW LEVEL SECURITY;

-- Staff policies mirror the bids family (bids_rfis pattern).
DROP POLICY IF EXISTS "Bid pricing users can read bid_audits" ON public.bid_audits;
CREATE POLICY "Bid pricing users can read bid_audits" ON public.bid_audits FOR SELECT
  USING (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role])));
DROP POLICY IF EXISTS "Bid pricing users can write bid_audits" ON public.bid_audits;
CREATE POLICY "Bid pricing users can write bid_audits" ON public.bid_audits FOR ALL
  USING (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])))
  WITH CHECK (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])));

DROP POLICY IF EXISTS "Bid pricing users can read bid_audit_notes" ON public.bid_audit_notes;
CREATE POLICY "Bid pricing users can read bid_audit_notes" ON public.bid_audit_notes FOR SELECT
  USING (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role])));
DROP POLICY IF EXISTS "Bid pricing users can write bid_audit_notes" ON public.bid_audit_notes;
CREATE POLICY "Bid pricing users can write bid_audit_notes" ON public.bid_audit_notes FOR ALL
  USING (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])))
  WITH CHECK (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])));

-- Twin lanes, STRUCTURALLY (restrictive, so twin SELECT stays untouched):
--   * bid_audits — a twin opens audits (pending) and closes the loop (digested), but
--     can never mark one 'done': finishing an audit is the human auditor's act.
--   * bid_audit_notes — a twin seeds 'question's and posts 'receipt's; 'note' and
--     'answer' belong to humans.
DROP POLICY IF EXISTS "Twins never finish bid_audits" ON public.bid_audits;
CREATE POLICY "Twins never finish bid_audits" ON public.bid_audits AS RESTRICTIVE FOR INSERT
  WITH CHECK (
    NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = ( SELECT auth.uid() ) AND u.is_digital_twin = true)
    OR status <> 'done'
  );
DROP POLICY IF EXISTS "Twins never finish bid_audits update" ON public.bid_audits;
CREATE POLICY "Twins never finish bid_audits update" ON public.bid_audits AS RESTRICTIVE FOR UPDATE
  USING (true)
  WITH CHECK (
    NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = ( SELECT auth.uid() ) AND u.is_digital_twin = true)
    OR status <> 'done'
  );
DROP POLICY IF EXISTS "Twins write questions and receipts only on bid_audit_notes" ON public.bid_audit_notes;
CREATE POLICY "Twins write questions and receipts only on bid_audit_notes" ON public.bid_audit_notes AS RESTRICTIVE FOR INSERT
  WITH CHECK (
    NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = ( SELECT auth.uid() ) AND u.is_digital_twin = true)
    OR kind = ANY (ARRAY['question'::text, 'receipt'::text])
  );

-- House rules: read-only training mode + the digital-twin write fence cover every new
-- table (the fence auto-detects bid_id, confining twin writes to own/assigned bids).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
