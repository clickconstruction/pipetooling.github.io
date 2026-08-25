SET lock_timeout = '3s';

-- Quick Estimate groundwork (v2.2292): field-authored change orders/estimates.
--
-- 1) estimates.sent_to_dispatch_at — stamped when the field author hands the
--    draft to Dispatch; drives the "With Dispatch" chip and the wizard's
--    already-sent state. Null for office-authored drafts.
-- 2) estimate_field_photos — metadata for photos captured in the wizard. Bytes
--    live in the private 'estimate-field-photos' bucket, created OUT-OF-BAND
--    like this project's other buckets (estimate-acceptor-signatures, hr-files);
--    the exact bucket + storage.objects policy SQL ships in
--    docs/recent-features/v2.2292.md.
-- 3) Subcontractors join the estimates role gates so a sub can author a Quick
--    Estimate draft. Only the OUTER role arrays change: the inner
--    broad-visibility arrays are untouched, so a sub still sees only what
--    user_can_access_estimate grants (rows they created / own as master),
--    never the whole ledger.
--
-- Idempotent and additive.

ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS sent_to_dispatch_at timestamptz;

COMMENT ON COLUMN public.estimates.sent_to_dispatch_at IS
  'Quick Estimate (v2.2292): when the field author sent this draft to Dispatch for finishing; null for office-authored drafts.';

CREATE TABLE IF NOT EXISTS public.estimate_field_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  -- object path inside the 'estimate-field-photos' bucket: <estimate_id>/<uuid>-<filename>
  storage_path text NOT NULL UNIQUE,
  filename text,
  mime_type text,
  size_bytes bigint,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.estimate_field_photos IS
  'Quick Estimate field photos (v2.2292): metadata for photos captured in the field wizard, attached to an estimate/change-order draft. Bytes live in the private estimate-field-photos bucket.';

CREATE INDEX IF NOT EXISTS idx_estimate_field_photos_estimate
  ON public.estimate_field_photos (estimate_id, created_at);

ALTER TABLE public.estimate_field_photos ENABLE ROW LEVEL SECURITY;

-- Visibility mirrors estimates_select: broad-visibility office roles see all,
-- everyone else through the estimate-access helpers.
DROP POLICY IF EXISTS estimate_field_photos_select ON public.estimate_field_photos;
CREATE POLICY estimate_field_photos_select ON public.estimate_field_photos
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.estimates e
    WHERE e.id = estimate_field_photos.estimate_id
      AND (
        public.user_can_access_estimate(e.*)
        OR public.superintendent_can_access_estimate(e.*)
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = (SELECT auth.uid())
            AND u.role = ANY (ARRAY['dev'::public.user_role, 'assistant'::public.user_role, 'estimator'::public.user_role, 'master_technician'::public.user_role, 'primary'::public.user_role])
        )
      )
  ));

DROP POLICY IF EXISTS estimate_field_photos_insert ON public.estimate_field_photos;
CREATE POLICY estimate_field_photos_insert ON public.estimate_field_photos
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.estimates e
      WHERE e.id = estimate_field_photos.estimate_id
        AND e.status = 'draft'::public.estimate_status
        AND (public.user_can_access_estimate(e.*) OR public.superintendent_can_access_estimate(e.*))
    )
  );

DROP POLICY IF EXISTS estimate_field_photos_delete ON public.estimate_field_photos;
CREATE POLICY estimate_field_photos_delete ON public.estimate_field_photos
  FOR DELETE TO authenticated
  USING (created_by = (SELECT auth.uid()) OR public.is_dev());

-- 3) Subcontractor joins the estimates role gates (outer arrays only).

DROP POLICY IF EXISTS estimates_insert ON public.estimates;
CREATE POLICY estimates_insert ON public.estimates FOR INSERT TO authenticated
  WITH CHECK (((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role, 'subcontractor'::public.user_role]))))) AND (created_by = ( SELECT auth.uid() AS uid)) AND (public.is_dev() OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'primary'::public.user_role)))) OR (master_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.master_assistants
  WHERE ((master_assistants.master_id = estimates.master_user_id) AND (master_assistants.assistant_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = 'estimator'::public.user_role)))) OR public.superintendent_can_access_estimate(estimates.*))));

DROP POLICY IF EXISTS estimates_select ON public.estimates;
CREATE POLICY estimates_select ON public.estimates FOR SELECT TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role, 'subcontractor'::public.user_role]))))) AND (public.user_can_access_estimate(estimates.*) OR public.superintendent_can_access_estimate(estimates.*) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'assistant'::public.user_role, 'estimator'::public.user_role, 'master_technician'::public.user_role, 'primary'::public.user_role]))))))));

DROP POLICY IF EXISTS estimates_update_draft ON public.estimates;
CREATE POLICY estimates_update_draft ON public.estimates FOR UPDATE TO authenticated
  USING (((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role, 'subcontractor'::public.user_role]))))) AND (status = 'draft'::public.estimate_status) AND (public.user_can_access_estimate(estimates.*) OR public.superintendent_can_access_estimate(estimates.*) OR (EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'assistant'::public.user_role, 'estimator'::public.user_role, 'master_technician'::public.user_role, 'primary'::public.user_role])))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = ( SELECT auth.uid() AS uid)) AND (users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role, 'subcontractor'::public.user_role]))))) AND (status = 'draft'::public.estimate_status)));

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
