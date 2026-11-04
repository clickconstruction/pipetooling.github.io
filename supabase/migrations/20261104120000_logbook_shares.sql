SET lock_timeout = '3s';

-- v2.6483 · Punch list #255 · The logbook, shown to its teammate.
--
-- The office turns a teammate's logbook on for that teammate, one at a time, from the logbook (/logbook/:userId).
-- One row a teammate shown: who pressed and when. The Licenses audience (dev, assistant-like, pay-approved master:
-- the gate list_user_license_hours_log keeps) writes the rows; a teammate reads only their own.
--
-- my_logbook() is the teammate's read, on auth.uid() alone, and answers only with a share row. It returns their
-- approved hours (the rows list_user_license_hours_log returns, for the caller), the licenses held under their name,
-- the supervising licenses (master, contractor) of current teammates for the signer line, and the office job's id.
-- The office's RPC and person_licenses stay closed to teammates. No wages, as before.

CREATE TABLE IF NOT EXISTS public.logbook_shares (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  shown_by uuid REFERENCES public.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  shown_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.logbook_shares IS
  'Punch list #255 (v2.6483): one row a teammate whose logbook the office has shown them (Show … this logbook on /logbook/:userId). The row opens my_logbook() and the My logbook menu row for that teammate; deleting it (Stop showing) closes both.';

ALTER TABLE public.logbook_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS logbook_shares_read ON public.logbook_shares;
CREATE POLICY logbook_shares_read ON public.logbook_shares FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_dev() OR public.is_assistant() OR public.is_pay_approved_master());

DROP POLICY IF EXISTS logbook_shares_show ON public.logbook_shares;
CREATE POLICY logbook_shares_show ON public.logbook_shares FOR INSERT TO authenticated
  WITH CHECK (public.is_dev() OR public.is_assistant() OR public.is_pay_approved_master());

DROP POLICY IF EXISTS logbook_shares_stop ON public.logbook_shares;
CREATE POLICY logbook_shares_stop ON public.logbook_shares FOR DELETE TO authenticated
  USING (public.is_dev() OR public.is_assistant() OR public.is_pay_approved_master());

REVOKE ALL ON public.logbook_shares FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.logbook_shares TO authenticated;

CREATE OR REPLACE FUNCTION public.my_logbook()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.logbook_shares WHERE user_id = v_uid) THEN
    RETURN NULL;
  END IF;
  SELECT u.name INTO v_name FROM public.users u WHERE u.id = v_uid;

  RETURN jsonb_build_object(
    'name', coalesce(v_name, ''),
    'hours', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'session_id', cs.id,
        'work_date', cs.work_date,
        'clocked_in_at', cs.clocked_in_at,
        'clocked_out_at', cs.clocked_out_at,
        'hours', (EXTRACT(EPOCH FROM (cs.clocked_out_at - cs.clocked_in_at)) / 3600.0)::numeric,
        'job_ledger_id', cs.job_ledger_id,
        'job_number', COALESCE(NULLIF(jl.hcp_number, ''), NULLIF(jl.click_number, ''), ''),
        'job_name', COALESCE(jl.job_name, ''),
        'job_address', COALESCE(jl.job_address, ''),
        'service_type_name', COALESCE(st.name, ''),
        'bid_id', cs.bid_id,
        'notes', COALESCE(cs.notes, '')
      ) ORDER BY cs.work_date, cs.clocked_in_at)
      FROM public.clock_sessions cs
      LEFT JOIN public.jobs_ledger jl ON jl.id = cs.job_ledger_id
      LEFT JOIN public.service_types st ON st.id = jl.service_type_id
      WHERE cs.user_id = v_uid
        AND cs.approved_at IS NOT NULL
        AND cs.rejected_at IS NULL
        AND cs.revoked_at IS NULL
        AND cs.clocked_in_at IS NOT NULL
        AND cs.clocked_out_at IS NOT NULL
    ), '[]'::jsonb),
    'licenses', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', pl.id, 'license_type', pl.license_type, 'date_of_expiry', pl.date_of_expiry)
        ORDER BY pl.license_type)
      FROM public.person_licenses pl
      WHERE v_name IS NOT NULL AND pl.person_name = v_name
    ), '[]'::jsonb),
    'signers', coalesce((
      SELECT jsonb_agg(jsonb_build_object('person_name', pl.person_name, 'license_type', pl.license_type, 'date_of_expiry', pl.date_of_expiry)
        ORDER BY pl.person_name, pl.license_type)
      FROM public.person_licenses pl
      WHERE pl.person_name IS DISTINCT FROM v_name
        AND pl.license_type ~* '(master|contractor)'
        AND (pl.date_of_expiry IS NULL OR pl.date_of_expiry >= (now() AT TIME ZONE 'America/Chicago')::date)
        AND NOT EXISTS (SELECT 1 FROM public.users u WHERE u.name = pl.person_name AND u.archived_at IS NOT NULL)
        AND NOT EXISTS (SELECT 1 FROM public.people p WHERE p.name = pl.person_name AND p.archived_at IS NOT NULL)
    ), '[]'::jsonb),
    'office_job_id', (SELECT nullif(btrim(s.value_text), '') FROM public.app_settings s WHERE s.key = 'overhead_office_job_ledger_id_v1')
  );
END;
$$;

COMMENT ON FUNCTION public.my_logbook() IS
  'Punch list #255 (v2.6483): the signed-in teammate''s own logbook, once the office showed it (a logbook_shares row); NULL otherwise. Their approved closed clock hours with job metadata, the licenses under their name, current teammates'' supervising licenses for the signer line, and the office job id. Hours only, no wages.';

REVOKE ALL ON FUNCTION public.my_logbook() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_logbook() TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
