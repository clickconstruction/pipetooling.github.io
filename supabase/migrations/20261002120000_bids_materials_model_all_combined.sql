SET lock_timeout = '3s';

-- v2.4405 (punch list #77, PR 3): the data says what the app does. By Stage is retired
-- (v2.4389 switched it off, v2.4396 deleted its code), and since then no client code reads
-- bids.materials_model. 151 bids still carried 'exact' (By Stage), nearly all of them only because
-- it was the column's default until April 2026. They become 'rough' (Combined), so an audit of the
-- table reads one value.
--
-- Recounted on prod 2026-10-02, read-only: 409 bids, 258 'rough', 151 'exact'. Of the 151, five
-- hold any By Stage data: picks on B82, B85, B159 and B403 (the ZZ Twin test bid), and stage
-- purchase orders linked on B82, B83 and B85. Those rows stay where they are, in
-- bids_takeoff_template_mappings and cost_estimates.purchase_order_id_*: this migration changes one
-- column on bids and nothing else. docs/migrations/ lists the 151 bid numbers.
--
-- The update must not look like 151 bids were worked on tonight. update_bids_updated_at stamps
-- updated_at = now() on every row update, so it is held off for this one statement. The whole thing
-- is one DO block, so it is atomic: if anything fails the trigger is back on with nothing changed.
-- ALTER TABLE … DISABLE TRIGGER takes a SHARE ROW EXCLUSIVE lock: readers go on, a writer to bids
-- waits the few milliseconds this takes, and the 3s timeout above gives up rather than queue.
--
-- The other triggers that fire on a bid update do nothing here: the send, outcome and bid-number
-- ones watch columns this does not touch, the twin and training guards do not apply to a migration,
-- and bids_clear_working_board_archive_on_progress un-archives a sent or decided bid only (none of
-- the 151 was both archived and sent or decided on 2026-10-02).
--
-- Idempotent: a second run updates nothing.

DO $$
DECLARE
  n integer;
BEGIN
  ALTER TABLE public.bids DISABLE TRIGGER update_bids_updated_at;

  UPDATE public.bids SET materials_model = 'rough' WHERE materials_model IS DISTINCT FROM 'rough';
  GET DIAGNOSTICS n = ROW_COUNT;

  ALTER TABLE public.bids ENABLE TRIGGER update_bids_updated_at;

  IF EXISTS (SELECT 1 FROM public.bids WHERE materials_model IS DISTINCT FROM 'rough') THEN
    RAISE EXCEPTION 'bids_materials_model_all_combined: a bid is still not Combined after the update';
  END IF;
  RAISE NOTICE 'bids_materials_model_all_combined: % bid(s) set to Combined', n;
END $$;

COMMENT ON COLUMN public.bids.materials_model IS
  'Always ''rough'' (Combined: priced part lines in bids_takeoff_rough_part_lines). ''exact'' was By Stage (assembly + stage picks in bids_takeoff_template_mappings, priced through three stage purchase orders): switched off in v2.4389, its code deleted in v2.4396, and the 151 bids that still carried the flag set to ''rough'' in v2.4405. No client code reads this column. The CHECK still allows ''exact'' so a bid row restored from before the retirement can be written.';
