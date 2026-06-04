-- Dispatch Inbox: one-time task when a license first qualifies as expiring within 30 days (People → Licenses save).

ALTER TABLE public.person_licenses
  ADD COLUMN IF NOT EXISTS expiry_dispatch_notified_at timestamptz;

COMMENT ON COLUMN public.person_licenses.expiry_dispatch_notified_at IS 'Set when a dispatch_requests row was created for this license’s expiry-in-30-days window (dedupe).';

CREATE OR REPLACE FUNCTION public.notify_dispatch_license_expiry_if_needed(p_license_id uuid, p_link text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_row public.person_licenses%ROWTYPE;
  v_title text;
  v_dr_id uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_link IS NULL OR length(trim(p_link)) = 0 OR length(p_link) > 2000 THEN
    RETURN NULL;
  END IF;

  IF NOT (
    public.is_dev()
    OR public.is_pay_approved_master()
    OR public.is_assistant_of_pay_approved_master()
    OR public.is_assistant()
  ) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_row
  FROM public.person_licenses
  WHERE id = p_license_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF v_row.expiry_dispatch_notified_at IS NOT NULL THEN
    RETURN NULL;
  END IF;

  IF v_row.date_of_expiry < CURRENT_DATE OR v_row.date_of_expiry > (CURRENT_DATE + 30) THEN
    RETURN NULL;
  END IF;

  v_title :=
    'License expiring: ' || v_row.person_name || ' — ' || v_row.license_type
    || ' expires ' || v_row.date_of_expiry::text || ' · Open [1]';

  IF length(v_title) > 2000 THEN
    v_title := left(v_title, 1997) || '...';
  END IF;

  INSERT INTO public.dispatch_requests (from_user_id, title, links, status)
  VALUES (v_uid, v_title, ARRAY[p_link]::text[], 'open')
  RETURNING id INTO v_dr_id;

  UPDATE public.person_licenses
  SET expiry_dispatch_notified_at = now()
  WHERE id = p_license_id;

  RETURN v_dr_id;
END;
$$;

COMMENT ON FUNCTION public.notify_dispatch_license_expiry_if_needed(uuid, text) IS 'Creates a dispatch_requests row and marks person_licenses when expiry is within 30 days; returns dispatch id or NULL.';

REVOKE ALL ON FUNCTION public.notify_dispatch_license_expiry_if_needed(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_dispatch_license_expiry_if_needed(uuid, text) TO authenticated;
