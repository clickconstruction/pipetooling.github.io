SET lock_timeout = '3s';

-- Field reports → HR (v2.2235). Master technicians and devs write a short,
-- dated observation about a person from their Dashboard; it queues on
-- People → HR as "Pending reports" until a dev (or the HR agent) files it,
-- which appends an ordinary person_file_entries row on that person's file.
--
-- Why a queue instead of writing straight to the file: HR entries are
-- append-only and read back in disputes, so they get one authoring standard
-- and one reviewer. Masters capture what they saw while it is fresh; the
-- review turns it into the file's voice without losing the author or the date.
--
-- Resolution is a status change, never a delete: 'filed' keeps the entry id it
-- became, 'dismissed' keeps its reason. Same append-only spirit as the file.

CREATE TABLE IF NOT EXISTS public.person_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  author_name text NOT NULL DEFAULT '',
  occurred_date date NOT NULL,
  content text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  filed_entry_id uuid REFERENCES public.person_file_entries(id) ON DELETE SET NULL,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT person_reports_content_not_blank CHECK (btrim(content) <> ''),
  CONSTRAINT person_reports_status_check CHECK (status IN ('pending','filed','dismissed'))
);

COMMENT ON TABLE public.person_reports IS
  'Field reports about a person, written by masters/devs on the Dashboard and queued on People → HR until filed into the person''s HR file (or dismissed with a reason). Resolution never deletes.';
COMMENT ON COLUMN public.person_reports.occurred_date IS
  'Date the thing being reported HAPPENED (APP_CALENDAR_TZ) — becomes the HR entry''s entry_date. created_at covers when it was written.';
COMMENT ON COLUMN public.person_reports.author_name IS
  'Denormalized author display name so authorship survives a user row going away.';
COMMENT ON COLUMN public.person_reports.filed_entry_id IS
  'The person_file_entries row this report became, once filed.';

CREATE INDEX IF NOT EXISTS idx_person_reports_pending
  ON public.person_reports (created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_person_reports_subject ON public.person_reports (subject_person_id);
CREATE INDEX IF NOT EXISTS idx_person_reports_author ON public.person_reports (author_user_id, created_at DESC);

ALTER TABLE public.person_reports ENABLE ROW LEVEL SECURITY;

-- Write: masters + devs, as themselves. Read: devs see everything; an author
-- sees only their own submissions (so the Dashboard card can show status).
-- Update: devs only (resolution). No DELETE policy anywhere, by design.
DROP POLICY IF EXISTS "Masters and devs write person reports" ON public.person_reports;
CREATE POLICY "Masters and devs write person reports" ON public.person_reports
  FOR INSERT WITH CHECK (
    author_user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid()) AND u.role IN ('dev','master_technician')
    )
  );

DROP POLICY IF EXISTS "Devs read all person reports, authors read own" ON public.person_reports;
CREATE POLICY "Devs read all person reports, authors read own" ON public.person_reports
  FOR SELECT USING (public.is_dev() OR author_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Devs resolve person reports" ON public.person_reports;
CREATE POLICY "Devs resolve person reports" ON public.person_reports
  FOR UPDATE USING (public.is_dev()) WITH CHECK (public.is_dev());

GRANT SELECT, INSERT, UPDATE ON TABLE public.person_reports TO authenticated;

-- The HR agent works this queue during reviews.
DO $g$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hr_agent') THEN
    GRANT SELECT, UPDATE ON public.person_reports TO hr_agent;
  END IF;
END
$g$;

-- file_person_report: turn one queued report into an append-only HR entry.
-- Dev-gated for app callers; the hr_agent role may call it during a review.
CREATE OR REPLACE FUNCTION public.file_person_report(
  p_report_id uuid,
  p_content text DEFAULT NULL,
  p_source text DEFAULT 'report'
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.person_reports%ROWTYPE;
  v_entry uuid;
  v_body text;
BEGIN
  IF NOT (public.is_dev() OR current_user = 'hr_agent') THEN
    RAISE EXCEPTION 'not allowed';
  END IF;

  SELECT * INTO r FROM public.person_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'report not found'; END IF;
  IF r.status <> 'pending' THEN
    RETURN jsonb_build_object('already', true, 'status', r.status, 'entry_id', r.filed_entry_id);
  END IF;

  -- Default body keeps the reporter's words and stamps provenance; a caller
  -- may pass rewritten prose (the agent usually does) and it is used as-is.
  v_body := COALESCE(NULLIF(btrim(p_content), ''),
    'Field report from ' || COALESCE(NULLIF(btrim(r.author_name), ''), 'a master technician')
    || ' (submitted ' || to_char(r.created_at AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD') || '): ' || r.content);

  INSERT INTO public.person_file_entries (person_id, entry_date, content, source, author_label)
  VALUES (r.subject_person_id, r.occurred_date, v_body, COALESCE(NULLIF(btrim(p_source),''), 'report'),
          'Field report — ' || COALESCE(NULLIF(btrim(r.author_name), ''), 'unknown author'))
  RETURNING id INTO v_entry;

  UPDATE public.person_reports
  SET status = 'filed', filed_entry_id = v_entry, resolved_at = now(), resolved_by = auth.uid()
  WHERE id = p_report_id;

  RETURN jsonb_build_object('already', false, 'status', 'filed', 'entry_id', v_entry);
END;
$$;
ALTER FUNCTION public.file_person_report(uuid, text, text) OWNER TO postgres;
COMMENT ON FUNCTION public.file_person_report(uuid, text, text) IS
  'Files a queued person_report as an append-only person_file_entries row (entry_date = when it happened, author_label = the reporter) and marks the report filed. Idempotent: an already-resolved report returns its existing state.';
GRANT ALL ON FUNCTION public.file_person_report(uuid, text, text) TO anon;
GRANT ALL ON FUNCTION public.file_person_report(uuid, text, text) TO authenticated;
GRANT ALL ON FUNCTION public.file_person_report(uuid, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.dismiss_person_report(p_report_id uuid, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.person_reports%ROWTYPE;
BEGIN
  IF NOT (public.is_dev() OR current_user = 'hr_agent') THEN
    RAISE EXCEPTION 'not allowed';
  END IF;
  IF btrim(COALESCE(p_reason,'')) = '' THEN
    RAISE EXCEPTION 'a dismissal reason is required';
  END IF;
  SELECT * INTO r FROM public.person_reports WHERE id = p_report_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'report not found'; END IF;
  IF r.status <> 'pending' THEN
    RETURN jsonb_build_object('already', true, 'status', r.status);
  END IF;
  UPDATE public.person_reports
  SET status='dismissed', resolution_note = btrim(p_reason), resolved_at = now(), resolved_by = auth.uid()
  WHERE id = p_report_id;
  RETURN jsonb_build_object('already', false, 'status', 'dismissed');
END;
$$;
ALTER FUNCTION public.dismiss_person_report(uuid, text) OWNER TO postgres;
COMMENT ON FUNCTION public.dismiss_person_report(uuid, text) IS
  'Dismisses a queued person_report with a required reason. The row and its text are kept — dismissal only removes it from the queue.';
GRANT ALL ON FUNCTION public.dismiss_person_report(uuid, text) TO anon;
GRANT ALL ON FUNCTION public.dismiss_person_report(uuid, text) TO authenticated;
GRANT ALL ON FUNCTION public.dismiss_person_report(uuid, text) TO service_role;

-- Let hr_agent_write accept the new 'report' source. Patched from the LIVE
-- definition (house rule: never rebuild an RPC body from a repo baseline),
-- and idempotent — re-running is a no-op once 'report' is present.
DO $mig$
DECLARE def text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname='public' AND p.proname='hr_agent_write' LIMIT 1;
  IF def IS NULL THEN
    RAISE NOTICE 'hr_agent_write absent; skipping source widening';
  ELSIF position('''report''' in def) > 0 THEN
    RAISE NOTICE 'hr_agent_write already allows the report source';
  ELSE
    def := replace(def,
      'ARRAY[''conversation'',''payroll_event'',''incident'',''review'',''milestone'',''job_event'']',
      'ARRAY[''conversation'',''payroll_event'',''incident'',''review'',''milestone'',''job_event'',''report'']');
    EXECUTE def;
  END IF;
END
$mig$;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
