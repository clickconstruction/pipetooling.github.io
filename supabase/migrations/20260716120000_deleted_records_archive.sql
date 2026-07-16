-- Deleted-records archive (trash safety-net) — Phase 1: CAPTURE.
--
-- High-value rows are hard-deleted and irrecoverable: deleting a jobs_ledger row cascades across ~17
-- child tables (invoices, payments, materials, crew, reports, …); bids cascades across its own tree;
-- reports/invoices delete directly. Supabase PITR is off (daily physical backups only, and PITR is a
-- whole-DB rollback anyway), so there is no surgical way to undo one hostile/accidental deletion.
--
-- This migration snapshots every deleted row of the covered tables into public.deleted_records_archive
-- via a BEFORE DELETE trigger that captures to_jsonb(OLD). BEFORE-DELETE (not AFTER) + reading only the
-- deleting row avoids the cascade-ordering trap that broke the AFTER-DELETE activity triggers
-- (20260619120000): by AFTER time on a cascade child the parent is gone. It fires for ALL delete paths
-- — direct client .delete(), the SECURITY DEFINER delete RPCs, and cascade.
--
-- Phase 2 (later): dev-only list_deleted_records / restore_deleted_records RPCs + a "Recently deleted"
-- Settings UI. Phase 1 alone makes every deletion recoverable-from-data (row_data holds the full row).
--
-- Design notes for robustness (this trigger sits on the crown-jewel delete path — it must NEVER break a
-- delete): record_id/group_key are TEXT (no ::uuid casts that could raise on composite/bigint keys),
-- both nullable, deleted_by has NO FK, and the INSERT is wrapped so any failure logs a warning and lets
-- the delete proceed. Written only by this SECURITY DEFINER trigger (definer = postgres bypasses RLS);
-- table is RLS-enabled, dev-only SELECT, no client write policy (mirrors job_activity_events). NOT added
-- to the realtime publication.

CREATE TABLE IF NOT EXISTS public.deleted_records_archive (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  text NOT NULL,                    -- TG_TABLE_NAME of the deleted row
  record_id   text,                             -- OLD.id as text (null if the table has no id column)
  group_key   text,                             -- top-level bundle handle: the job/bid id (own id for parents)
  row_data    jsonb NOT NULL,                   -- to_jsonb(OLD): full row, for Phase 2 restore
  deleted_by  uuid,                             -- auth.uid() at delete time (null for service-role); no FK on purpose
  deleted_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.deleted_records_archive IS 'Trash safety-net: BEFORE-DELETE snapshots (to_jsonb) of covered high-value tables (jobs_ledger + cascade, bids + cascade, invoices, reports). Dev-only SELECT; written only by the archive_deleted_record() SECURITY DEFINER trigger. 90-day auto-purge. Phase 2 adds restore.';

CREATE INDEX IF NOT EXISTS idx_deleted_records_archive_group ON public.deleted_records_archive (group_key);
CREATE INDEX IF NOT EXISTS idx_deleted_records_archive_deleted_at ON public.deleted_records_archive (deleted_at);
CREATE INDEX IF NOT EXISTS idx_deleted_records_archive_table_record ON public.deleted_records_archive (table_name, record_id);

ALTER TABLE public.deleted_records_archive ENABLE ROW LEVEL SECURITY;

-- Dev-only read. No INSERT/UPDATE/DELETE policy: clients can never write (the trigger, owned by
-- postgres, bypasses RLS). Table privilege is required for the policy to be reachable.
DROP POLICY IF EXISTS deleted_records_archive_select ON public.deleted_records_archive;
CREATE POLICY deleted_records_archive_select ON public.deleted_records_archive
  FOR SELECT USING (public.is_dev());

GRANT SELECT ON TABLE public.deleted_records_archive TO authenticated;

-- Generic capture function. TG_ARGV = ordered candidate group-key columns; group_key = first non-null
-- of those, else OLD.id (may be null). Never raises: the INSERT is guarded so a delete always proceeds.
CREATE OR REPLACE FUNCTION public.archive_deleted_record()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  j  jsonb;
  gk text := NULL;
  i  int;
BEGIN
  j := to_jsonb(OLD);
  IF TG_NARGS > 0 THEN
    FOR i IN 0 .. TG_NARGS - 1 LOOP
      IF (j ? TG_ARGV[i]) AND NULLIF(j ->> TG_ARGV[i], '') IS NOT NULL THEN
        gk := j ->> TG_ARGV[i];
        EXIT;
      END IF;
    END LOOP;
  END IF;
  IF gk IS NULL THEN
    gk := j ->> 'id';
  END IF;

  BEGIN
    INSERT INTO public.deleted_records_archive (table_name, record_id, group_key, row_data, deleted_by)
    VALUES (TG_TABLE_NAME, j ->> 'id', gk, j, auth.uid());
  EXCEPTION WHEN OTHERS THEN
    -- Never block a delete because archiving failed; surface it in the logs instead.
    RAISE WARNING 'archive_deleted_record failed for %.%: %', TG_TABLE_SCHEMA, TG_TABLE_NAME, SQLERRM;
  END;

  RETURN OLD;
END $fn$;

ALTER FUNCTION public.archive_deleted_record() OWNER TO postgres;

COMMENT ON FUNCTION public.archive_deleted_record() IS 'BEFORE DELETE trigger fn: snapshots to_jsonb(OLD) into deleted_records_archive. TG_ARGV lists candidate group-key columns (first non-null wins, else id). Robust: text keys, no casts, guarded INSERT — never blocks a delete.';

-- Attach the trigger to the two parents + their full ON DELETE CASCADE closures. Each entry supplies the
-- column(s) that point at the top-level job/bid so rows group into one bundle. Idempotent.
DO $do$
DECLARE
  r         record;
  arg_frag  text;
BEGIN
  FOR r IN
    SELECT tbl, cols FROM (VALUES
      -- parents (group by own id)
      ('jobs_ledger',                            ARRAY[]::text[]),
      ('bids',                                   ARRAY[]::text[]),
      -- jobs_ledger cascade children (group by their FK-to-jobs_ledger column)
      ('common_jobs',                            ARRAY['job_id']),
      ('inspections',                            ARRAY['job_ledger_id']),
      ('job_collect_payment_flows',              ARRAY['job_id']),
      ('job_schedule_blocks',                    ARRAY['job_id']),
      ('job_status_events',                      ARRAY['job_id']),
      ('jobs_ledger_fixtures',                   ARRAY['job_id']),
      ('jobs_ledger_invoices',                   ARRAY['job_id']),
      ('jobs_ledger_materials',                  ARRAY['job_id']),
      ('jobs_ledger_payments',                   ARRAY['job_id']),
      ('jobs_ledger_team_members',               ARRAY['job_id']),
      ('jobs_ledger_thread_notes',               ARRAY['job_id']),
      ('jobs_tally_parts',                       ARRAY['job_id']),
      ('material_po_generator_entries',          ARRAY['job_ledger_id']),
      ('mercury_transaction_job_allocations',    ARRAY['job_id']),
      ('stripe_oob_payment_reverts',             ARRAY['job_id']),
      ('supply_house_invoice_job_allocations',   ARRAY['job_id']),
      ('reports',                                ARRAY['job_ledger_id','bid_id']),
      -- jobs_ledger grandchildren (best-available parent handle)
      ('report_reads',                           ARRAY['report_id']),
      ('jobs_ledger_invoice_stripe_email_sends', ARRAY['jobs_ledger_invoice_id']),
      -- bids cascade children (group by bid_id)
      ('bid_count_row_custom_prices',            ARRAY['bid_id']),
      ('bid_count_row_submission_hides',         ARRAY['bid_id']),
      ('bid_pricing_assignments',                ARRAY['bid_id']),
      ('bid_pricing_package_sends',              ARRAY['bid_id']),
      ('bid_working_board_placements',           ARRAY['bid_id']),
      ('bids_count_rows',                        ARRAY['bid_id']),
      ('bids_submission_entries',                ARRAY['bid_id']),
      ('bids_takeoff_rough_part_lines',          ARRAY['bid_id']),
      ('bids_takeoff_template_mappings',         ARRAY['bid_id']),
      ('cost_estimates',                         ARRAY['bid_id']),
      ('user_bid_notes_read_state',              ARRAY['bid_id']),
      -- cost_estimates grandchildren (group by cost_estimate_id)
      ('cost_estimate_equipment_rows',           ARRAY['cost_estimate_id']),
      ('cost_estimate_labor_rows',               ARRAY['cost_estimate_id']),
      ('cost_estimate_other_rows',               ARRAY['cost_estimate_id']),
      ('cost_estimate_permit_rows',              ARRAY['cost_estimate_id']),
      ('cost_estimate_subcontractor_rows',       ARRAY['cost_estimate_id']),
      ('cost_estimate_waste_rows',               ARRAY['cost_estimate_id'])
    ) AS t(tbl, cols)
  LOOP
    IF to_regclass(format('public.%I', r.tbl)) IS NULL THEN
      RAISE WARNING 'deleted_records_archive: table public.% not found, skipping trigger', r.tbl;
      CONTINUE;
    END IF;
    arg_frag := COALESCE((SELECT string_agg(quote_literal(c), ', ') FROM unnest(r.cols) AS c), '');
    EXECUTE format('DROP TRIGGER IF EXISTS zzz_archive_on_delete ON public.%I', r.tbl);
    EXECUTE format(
      'CREATE TRIGGER zzz_archive_on_delete BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.archive_deleted_record(%s)',
      r.tbl, arg_frag
    );
  END LOOP;
END $do$;

-- 90-day retention purge via pg_cron (guarded + idempotent; mirrors 20260630180000_connection_usage_monitor).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-deleted-records-archive') THEN
      PERFORM cron.unschedule('purge-deleted-records-archive');
    END IF;
    PERFORM cron.schedule(
      'purge-deleted-records-archive', '0 9 * * *',
      $cmd$DELETE FROM public.deleted_records_archive WHERE deleted_at < now() - interval '90 days'$cmd$
    );
  ELSE
    RAISE WARNING 'pg_cron not installed; deleted_records_archive 90-day purge not scheduled';
  END IF;
END $$;

-- CREATE TABLE ⇒ (re)apply the training-mode restrictive write-block policies (CLAUDE.md). Harmless to
-- the SECURITY DEFINER trigger writes (definer bypasses RLS).
SELECT public.apply_read_only_write_blocks();
