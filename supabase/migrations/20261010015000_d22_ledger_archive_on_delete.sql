SET lock_timeout = '3s';

-- Division 22 rules manager, PR 2 of the train (v2.5056; to-dos/division-22-rules-manager.md). Before any screen can
-- delete a ledger row, both ledger tables join the deleted-records archive, so a rule or a section deleted in the
-- manager is restorable for 90 days from Settings → Data & recovery → Recently deleted. Until now neither table had
-- the trigger, and a deleted rule was gone for good.
--
--   spec_section_match_rules   group key section_code (a rule bundles under its section; a no-code rule, whose
--                              section_code is NULL, falls back to its own id)
--   spec_sections              group key code (the table's key; it has no id column, so record_id stays null)
--
-- The manager refuses to delete a section that still has rules (PR 4), because section_code is ON DELETE CASCADE.
-- That refusal keeps a section and its rules out of one bundle, and it matters for restores: restore_deleted_records
-- finds a parent in the same bundle by record_id, which a section does not have.
--
-- Reuses public.archive_deleted_record() and the idempotent DO-block / to_regclass pattern from 20261008070000.
-- No new table, so no apply_read_only_* / digital-twin footers. Client change: Recently deleted learned the two
-- table names and how to summarize their rows (deletedRecordContents.ts).

DO $do$
DECLARE
  r         record;
  arg_frag  text;
BEGIN
  FOR r IN
    SELECT tbl, cols FROM (VALUES
      ('spec_section_match_rules', ARRAY['section_code']),
      ('spec_sections',            ARRAY['code'])
    ) AS t(tbl, cols)
  LOOP
    IF to_regclass(format('public.%I', r.tbl)) IS NULL THEN
      RAISE WARNING 'deleted_records_archive coverage: table public.% not found, skipping trigger', r.tbl;
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
