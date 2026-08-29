SET lock_timeout = '3s';

-- RFI loop Phase R1 (docs/RFI_LOOP_PLAN.md; estimator-twin pipeline Wave 2.1): the RFI
-- spine. An RFI is born wherever plans underdetermine the work (CountTooling RFI: note
-- flags, the substrate's reconciliation conflicts, or a human composing directly), lives
-- as a draft on the bid, is approved and sent by a human (estimator+; per-RFI GC pick,
-- default all bidding GCs — locked owner decisions 2026-08-28), and its answer re-enters
-- the pipeline. The record is the system of record; the transport (email / PlanHub Q&A /
-- phone) can vary. RFIs are NON-BLOCKING: every open RFI must surface as an assumption or
-- exclusion at the letter (Phase R5 wires the chip).

CREATE TABLE IF NOT EXISTS public.bids_rfis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id uuid NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  rfi_number integer NOT NULL,
  question text NOT NULL,
  sheet_ref text,
  source text NOT NULL DEFAULT 'manual' CHECK (source = ANY (ARRAY['manual'::text, 'ct_note'::text, 'substrate'::text])),
  status text NOT NULL DEFAULT 'draft' CHECK (status = ANY (ARRAY['draft'::text, 'approved'::text, 'sent'::text, 'answered'::text, 'withdrawn'::text])),
  sent_at timestamptz,
  sent_via text CHECK (sent_via IS NULL OR sent_via = ANY (ARRAY['email'::text, 'planhub'::text, 'phone'::text, 'other'::text])),
  sent_to jsonb NOT NULL DEFAULT '[]'::jsonb,
  answer text,
  answered_at timestamptz,
  answer_ref text,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bid_id, rfi_number)
);
CREATE INDEX IF NOT EXISTS bids_rfis_bid_idx ON public.bids_rfis (bid_id, rfi_number);

-- Per-bid numbering assigned on create: trigger takes max+1 under the unique constraint
-- (a raced duplicate fails the insert and the client retries — never a silent renumber).
CREATE OR REPLACE FUNCTION public.bids_rfis_assign_number() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.rfi_number IS NULL OR NEW.rfi_number <= 0 THEN
    SELECT COALESCE(MAX(rfi_number), 0) + 1 INTO NEW.rfi_number FROM public.bids_rfis WHERE bid_id = NEW.bid_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS bids_rfis_assign_number ON public.bids_rfis;
CREATE TRIGGER bids_rfis_assign_number BEFORE INSERT ON public.bids_rfis
  FOR EACH ROW EXECUTE FUNCTION public.bids_rfis_assign_number();

ALTER TABLE public.bids_rfis ENABLE ROW LEVEL SECURITY;

-- Staff policies mirror the bids family (bid_proposal_rooms pattern).
DROP POLICY IF EXISTS "Bid pricing users can read bids_rfis" ON public.bids_rfis;
CREATE POLICY "Bid pricing users can read bids_rfis" ON public.bids_rfis FOR SELECT
  USING (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role])));
DROP POLICY IF EXISTS "Bid pricing users can write bids_rfis" ON public.bids_rfis;
CREATE POLICY "Bid pricing users can write bids_rfis" ON public.bids_rfis FOR ALL
  USING (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])))
  WITH CHECK (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])));

-- Twin draft-only, STRUCTURALLY (locked decision): twins create and edit drafts on their
-- own/assigned bids but can never move an RFI past draft — approval and sending are human.
-- Restrictive per-command policies so twin SELECT stays untouched.
DROP POLICY IF EXISTS "Twins insert drafts only on bids_rfis" ON public.bids_rfis;
CREATE POLICY "Twins insert drafts only on bids_rfis" ON public.bids_rfis AS RESTRICTIVE FOR INSERT
  WITH CHECK (
    NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = ( SELECT auth.uid() ) AND u.is_digital_twin = true)
    OR status = 'draft'
  );
DROP POLICY IF EXISTS "Twins update drafts only on bids_rfis" ON public.bids_rfis;
CREATE POLICY "Twins update drafts only on bids_rfis" ON public.bids_rfis AS RESTRICTIVE FOR UPDATE
  USING (
    NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = ( SELECT auth.uid() ) AND u.is_digital_twin = true)
    OR status = 'draft'
  )
  WITH CHECK (
    NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = ( SELECT auth.uid() ) AND u.is_digital_twin = true)
    OR status = 'draft'
  );
DROP POLICY IF EXISTS "Twins delete drafts only on bids_rfis" ON public.bids_rfis;
CREATE POLICY "Twins delete drafts only on bids_rfis" ON public.bids_rfis AS RESTRICTIVE FOR DELETE
  USING (
    NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = ( SELECT auth.uid() ) AND u.is_digital_twin = true)
    OR status = 'draft'
  );

-- House rules: read-only training mode + the digital-twin write fence cover every new table
-- (the fence auto-detects bid_id, so twin writes are additionally confined to own/assigned bids).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
