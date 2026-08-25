SET lock_timeout = '3s';

-- Field photo → Google Drive handover (v2.2298). Long-term all customer photos
-- live in Google Drive; Quick Estimate field photos land in Supabase Storage
-- first (the master can't do Drive from the field). This table records the
-- handover: the office downloads the photos, moves them to Drive, and replaces
-- them with the folder link. One row per estimate.
--
-- Lives in its own table (not a column on estimates) because estimates are
-- only office-editable while status='draft' — the handover often happens after
-- the CO is sent, and this table's own policies allow that.
--
-- Idempotent and additive.

CREATE TABLE IF NOT EXISTS public.estimate_photo_handover (
  estimate_id uuid PRIMARY KEY REFERENCES public.estimates(id) ON DELETE CASCADE,
  drive_link text NOT NULL,
  moved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  moved_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.estimate_photo_handover IS
  'Quick Estimate photo handover (v2.2298): the Google Drive link that replaced an estimate''s field photos after the office moved them out of the estimate-field-photos bucket. One row per estimate; doubles as the audit of who moved them.';

ALTER TABLE public.estimate_photo_handover ENABLE ROW LEVEL SECURITY;

-- Select mirrors estimate_field_photos_select (access helpers + broad office roles).
DROP POLICY IF EXISTS estimate_photo_handover_select ON public.estimate_photo_handover;
CREATE POLICY estimate_photo_handover_select ON public.estimate_photo_handover
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.estimates e
    WHERE e.id = estimate_photo_handover.estimate_id
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

-- Office roles record/correct the handover (works on sent estimates too).
DROP POLICY IF EXISTS estimate_photo_handover_insert ON public.estimate_photo_handover;
CREATE POLICY estimate_photo_handover_insert ON public.estimate_photo_handover
  FOR INSERT TO authenticated
  WITH CHECK (
    moved_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
        AND u.role = ANY (ARRAY['dev'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'master_technician'::public.user_role, 'primary'::public.user_role])
    )
  );

DROP POLICY IF EXISTS estimate_photo_handover_update ON public.estimate_photo_handover;
CREATE POLICY estimate_photo_handover_update ON public.estimate_photo_handover
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role = ANY (ARRAY['dev'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'master_technician'::public.user_role, 'primary'::public.user_role])
  ))
  WITH CHECK (moved_by = (SELECT auth.uid()));

-- The handover deletes the moved photos' metadata rows, which the office
-- (not just the field author) must be able to do.
DROP POLICY IF EXISTS estimate_field_photos_delete ON public.estimate_field_photos;
CREATE POLICY estimate_field_photos_delete ON public.estimate_field_photos
  FOR DELETE TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR public.is_dev()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid())
        AND u.role = ANY (ARRAY['assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'master_technician'::public.user_role, 'primary'::public.user_role])
    )
  );

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
