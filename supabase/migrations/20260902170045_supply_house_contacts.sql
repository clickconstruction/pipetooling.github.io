SET lock_timeout = '3s';

-- RFQ Round 2, Rung D (v2.2648 — docs/RFQ_ROUND2_PLAN.md): per-house
-- contacts for price requests. IMPORTANT: public.supply_house_contacts
-- already exists (v2.1605, 20260812180000) as the jobs-side org-wide
-- "share with supply house" shortlist (label + email, house-agnostic).
-- Rather than a second contacts store, this EXTENDS that table:
--   - supply_house_id nullable — NULL rows stay the org-wide shortlist
--     (jobs flow untouched); linked rows power the RFQ desk.
--   - name / is_default / archived_at / updated_at for the rep picker.
--   - estimator joins the office write roles (they save contacts from
--     the RFQ compose; the jobs flow's office roles are unchanged).
-- Backfill seeds ONLY houses with no LINKED contacts, first from the
-- house's own single-contact fields, then from its newest request.

ALTER TABLE public.supply_house_contacts
  ADD COLUMN IF NOT EXISTS supply_house_id uuid REFERENCES public.supply_houses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS supply_house_contacts_house_idx
  ON public.supply_house_contacts (supply_house_id);

-- Widen the four office policies to include estimator (idempotent recreate).
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supply_house_contacts'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.supply_house_contacts', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY supply_house_contacts_select_office ON public.supply_house_contacts
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = ( SELECT auth.uid() )
      AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])
  ));

DO $$
DECLARE verb text;
BEGIN
  FOREACH verb IN ARRAY ARRAY['insert', 'update', 'delete'] LOOP
    EXECUTE format(
      $p$CREATE POLICY supply_house_contacts_%s_office ON public.supply_house_contacts FOR %s %s (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = ( SELECT auth.uid() )
            AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])
        )
      )$p$,
      verb, upper(verb), CASE WHEN verb = 'insert' THEN 'WITH CHECK' ELSE 'USING' END
    );
  END LOOP;
END $$;

-- The request rows remember exactly who was written to.
ALTER TABLE public.bid_rfqs
  ADD COLUMN IF NOT EXISTS sent_name text,
  ADD COLUMN IF NOT EXISTS sent_cc text[];

-- Backfill 1: each house's own single-contact fields.
INSERT INTO public.supply_house_contacts (supply_house_id, name, email, label, is_default)
SELECT sh.id,
       COALESCE(NULLIF(btrim(sh.contact_name), ''), split_part(btrim(sh.email), '@', 1)),
       btrim(sh.email),
       'primary',
       true
FROM public.supply_houses sh
WHERE sh.email IS NOT NULL AND btrim(sh.email) <> ''
  AND NOT EXISTS (SELECT 1 FROM public.supply_house_contacts c WHERE c.supply_house_id = sh.id);

-- Backfill 2: the newest historical request per still-contactless house.
INSERT INTO public.supply_house_contacts (supply_house_id, name, email, label, is_default)
SELECT DISTINCT ON (r.supply_house_id)
       r.supply_house_id,
       split_part(btrim(r.sent_email), '@', 1),
       btrim(r.sent_email),
       'from past requests',
       true
FROM public.bid_rfqs r
WHERE r.sent_email IS NOT NULL AND btrim(r.sent_email) <> '' AND r.supply_house_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.supply_house_contacts c WHERE c.supply_house_id = r.supply_house_id)
ORDER BY r.supply_house_id, r.created_at DESC;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
