SET lock_timeout = '3s';

-- Quickfill item snoozes (v2.5764): "Dismiss for one week" on a worked list's item, shared
-- by the office rather than kept per device. The first kind is `percent-complete` (the
-- Percent complete station: a job whose ticked stages or paid money disagree with its
-- % done), keyed by the job id; any station that needs a dismissal reuses the table with
-- its own kind and key. One live row per (kind, item_key): a second press moves `until`.
-- A row whose `until` has passed is simply ignored by the read, so nothing sweeps them.

BEGIN;

CREATE TABLE IF NOT EXISTS public.quickfill_item_snoozes (
  kind text NOT NULL CHECK (length(btrim(kind)) > 0),
  item_key text NOT NULL CHECK (length(btrim(item_key)) > 0),
  until timestamptz NOT NULL,
  snoozed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, item_key)
);

CREATE INDEX IF NOT EXISTS quickfill_item_snoozes_kind_until_idx
  ON public.quickfill_item_snoozes (kind, until);

COMMENT ON TABLE public.quickfill_item_snoozes IS 'Quickfill "Dismiss for one week" rows (v2.5764), shared by the office: one per (kind, item_key), hidden from the station until `until` passes. kind = the station''s own name (percent-complete: item_key is the jobs_ledger id). A press after the week moves `until` again; nothing sweeps spent rows.';
COMMENT ON COLUMN public.quickfill_item_snoozes.until IS 'When the item shows again. The read ignores rows at or before now.';
COMMENT ON COLUMN public.quickfill_item_snoozes.snoozed_by IS 'Who pressed Dismiss; NULL once that user is gone.';

ALTER TABLE public.quickfill_item_snoozes ENABLE ROW LEVEL SECURITY;

-- The same office that marks a station up to date (quickfill_section_marks).
DROP POLICY IF EXISTS quickfill_item_snoozes_office_select ON public.quickfill_item_snoozes;
CREATE POLICY quickfill_item_snoozes_office_select ON public.quickfill_item_snoozes
  FOR SELECT TO authenticated USING (public.is_dev_or_master_or_assistant());
DROP POLICY IF EXISTS quickfill_item_snoozes_office_insert ON public.quickfill_item_snoozes;
CREATE POLICY quickfill_item_snoozes_office_insert ON public.quickfill_item_snoozes
  FOR INSERT TO authenticated WITH CHECK (public.is_dev_or_master_or_assistant());
DROP POLICY IF EXISTS quickfill_item_snoozes_office_update ON public.quickfill_item_snoozes;
CREATE POLICY quickfill_item_snoozes_office_update ON public.quickfill_item_snoozes
  FOR UPDATE TO authenticated USING (public.is_dev_or_master_or_assistant()) WITH CHECK (public.is_dev_or_master_or_assistant());
DROP POLICY IF EXISTS quickfill_item_snoozes_office_delete ON public.quickfill_item_snoozes;
CREATE POLICY quickfill_item_snoozes_office_delete ON public.quickfill_item_snoozes
  FOR DELETE TO authenticated USING (public.is_dev_or_master_or_assistant());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quickfill_item_snoozes TO authenticated;
GRANT ALL ON public.quickfill_item_snoozes TO service_role;

COMMIT;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
