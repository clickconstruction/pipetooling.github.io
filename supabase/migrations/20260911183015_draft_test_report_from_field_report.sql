SET lock_timeout = '3s';

-- Test reports PR 4 (dial A): the tech's clock-out report drafts the Test
-- report. When a Status Report / Job Complete report lands on a job whose name
-- says what test it is ("Johnson Pretest", "Montolongo Post Test", "…Hydrostatic
-- Test PRE", "Salinas Gas Test") — or whose wording mentions a hydrostatic test —
-- one draft job_test_reports row appears with the type from the job name and,
-- for hydrostatic tests, PASS / FAIL read from the tech's sentence ("Hydrostatic
-- test passed.", "No hydrostatic loss detected", "failed - lost 2 inches"). The
-- office finds it on the Dashboard as "N test reports ready to send", glances at
-- the paper, and sends. The regexes are the SQL twin of inferTestReportDraft in
-- supabase/functions/_shared/testReport.ts (tested from src/lib/jobs/testReport.test.ts).
--
-- One draft per job and type: a second status report on the same job updates
-- the open draft's verdict when it had none, never adds a row. Any failure inside
-- the trigger is a WARNING — a field report must never fail because of this.

CREATE OR REPLACE FUNCTION public.draft_test_report_from_field_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_name text;
  v_template text;
  v_text text;
  v_type text;
  v_result text;
  v_existing uuid;
  v_existing_result text;
BEGIN
  IF NEW.job_ledger_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT lower(coalesce(rt.name, '')) INTO v_template FROM public.report_templates rt WHERE rt.id = NEW.template_id;
  IF v_template IS NULL OR v_template NOT IN ('status report', 'job complete') THEN
    RETURN NEW;
  END IF;

  SELECT lower(coalesce(j.job_name, '')) INTO v_job_name FROM public.jobs_ledger j WHERE j.id = NEW.job_ledger_id;
  IF v_job_name IS NULL THEN
    RETURN NEW;
  END IF;

  -- Every string value the tech typed, joined — the status sentence lives under a template-named key.
  SELECT lower(coalesce(string_agg(v, ' '), ''))
    INTO v_text
    FROM jsonb_each_text(CASE WHEN jsonb_typeof(NEW.field_values) = 'object' THEN NEW.field_values ELSE '{}'::jsonb END) AS kv(k, v);

  v_type := CASE
    WHEN v_job_name ~ '\mpost[[:space:]-]*(test|level)' OR v_job_name ~ 'hydro[[:alnum:]]*[[:space:]]+test[[:space:]]+post\M' THEN 'post_test'
    WHEN v_job_name ~ '\mpre[[:space:]-]*(test|level)' OR v_job_name ~ 'hydro[[:alnum:]]*[[:space:]]+test[[:space:]]+pre\M' THEN 'pre_test'
    WHEN v_job_name ~ '\mpinpoint' THEN 'pinpoint'
    WHEN v_job_name ~ '\mgas[[:space:]]*test' THEN 'gas'
    WHEN v_job_name ~ '\mhydro' OR v_text ~ '\mhydro' THEN 'pre_test'
    ELSE NULL
  END;
  IF v_type IS NULL THEN
    RETURN NEW;
  END IF;

  v_result := NULL;
  IF v_type IN ('pre_test', 'post_test') THEN
    IF v_text ~ '\m(fail|failed|failing|leak[[:space:]]+found|leaks?[[:space:]]+detected|did[[:space:]]+not[[:space:]]+(pass|hold)|lost[[:space:]]+water|water[[:space:]]+loss[[:space:]]+detected)\M'
       AND v_text !~ '\mno[[:space:]]+(leaks?|loss|water[[:space:]]+loss)\M' THEN
      v_result := 'fail';
    ELSIF v_text ~ '\m(pass|passed|passing|held|no[[:space:]]+(leaks?|loss)|no[[:space:]]+hydrostatic[[:space:]]+loss)\M' THEN
      v_result := 'pass';
    END IF;
  END IF;

  SELECT t.id, t.result INTO v_existing, v_existing_result
    FROM public.job_test_reports t
    WHERE t.job_id = NEW.job_ledger_id AND t.test_type = v_type AND t.status = 'draft'
    ORDER BY t.created_at DESC
    LIMIT 1;

  IF v_existing IS NOT NULL THEN
    IF v_existing_result IS NULL AND v_result IS NOT NULL THEN
      UPDATE public.job_test_reports SET result = v_result WHERE id = v_existing;
    END IF;
    RETURN NEW;
  END IF;

  INSERT INTO public.job_test_reports (job_id, test_type, system, result, test_date, duration_minutes, source_report_id, created_by)
  VALUES (
    NEW.job_ledger_id,
    v_type,
    CASE WHEN v_type IN ('pre_test', 'post_test') THEN 'sewer' ELSE NULL END,
    v_result,
    (coalesce(NEW.created_at, now()) AT TIME ZONE 'America/Chicago')::date,
    CASE WHEN v_type IN ('pre_test', 'post_test') THEN 60 ELSE NULL END,
    NEW.id,
    NEW.created_by_user_id
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'draft_test_report_from_field_report: % (report %)', SQLERRM, NEW.id;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.draft_test_report_from_field_report() IS
  'AFTER INSERT on reports: drafts a job_test_reports row (type from the job name, PASS/FAIL from the tech''s wording) for Status Report / Job Complete reports on test jobs. One open draft per job and type. Never fails the report insert.';

DROP TRIGGER IF EXISTS reports_draft_test_report ON public.reports;
CREATE TRIGGER reports_draft_test_report
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.draft_test_report_from_field_report();

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
