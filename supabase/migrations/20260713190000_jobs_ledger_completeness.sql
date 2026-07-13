-- Job completeness (0-100%) marked from the Job Detail modal, with attribution.
-- Current value lives on jobs_ledger; every change is logged to job_activity_events
-- ('completeness_marked', bucket: status) by the trigger below, so the activity
-- panel shows who marked it and when.

ALTER TABLE public.jobs_ledger ADD COLUMN IF NOT EXISTS completeness_pct integer;
ALTER TABLE public.jobs_ledger ADD COLUMN IF NOT EXISTS completeness_marked_by uuid REFERENCES public.users(id);
ALTER TABLE public.jobs_ledger ADD COLUMN IF NOT EXISTS completeness_marked_at timestamptz;

DO $$
BEGIN
  ALTER TABLE public.jobs_ledger
    ADD CONSTRAINT jobs_ledger_completeness_pct_range
    CHECK (completeness_pct IS NULL OR (completeness_pct >= 0 AND completeness_pct <= 100));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Same shape as the other job_activity_events writers (AFTER, SECURITY DEFINER,
-- search_path pinned). Fires once per completeness change; no idempotency guard
-- needed since there is no backfill path for this source.
CREATE OR REPLACE FUNCTION public.jobs_ledger_completeness_to_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.job_activity_events (job_id, event_type, occurred_at, actor_user_id, summary, detail, financial)
  VALUES (
    NEW.id,
    'completeness_marked',
    coalesce(NEW.completeness_marked_at, now()),
    coalesce(NEW.completeness_marked_by, auth.uid()),
    'Completeness: '
      || coalesce(OLD.completeness_pct::text || '%', 'unset')
      || ' → '
      || coalesce(NEW.completeness_pct::text || '%', 'unset'),
    jsonb_build_object('from', OLD.completeness_pct, 'to', NEW.completeness_pct),
    false
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_ledger_completeness_to_activity_upd ON public.jobs_ledger;
CREATE TRIGGER jobs_ledger_completeness_to_activity_upd
  AFTER UPDATE ON public.jobs_ledger
  FOR EACH ROW
  WHEN (OLD.completeness_pct IS DISTINCT FROM NEW.completeness_pct)
  EXECUTE FUNCTION public.jobs_ledger_completeness_to_activity();
