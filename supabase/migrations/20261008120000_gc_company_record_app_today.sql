SET lock_timeout = '3s';

-- v2.4918 — GC mode's company record (B1, 20261008020000) dates in the company's calendar, not UTC.
-- The database session runs in UTC, so CURRENT_DATE is tomorrow's date every evening after 7 PM
-- Central (6 PM in winter): an ask made at 9 PM on Oct 7 was dated Oct 8. B1's six date defaults and
-- its four functions that stamp a day now use public.app_today() (20260903190000), the SQL twin of
-- todayYmdInAppTz(). Each function body below is B1's, byte for byte, which is prod's live definition,
-- with only `current_date` changed — see docs/migrations/20261008120000_gc_company_record_app_today.md.
-- Idempotent: SET DEFAULT and CREATE OR REPLACE. No signature, grant or comment changes.

ALTER TABLE public.gc_company_vetting_forms ALTER COLUMN sent_on SET DEFAULT public.app_today();
ALTER TABLE public.gc_invites ALTER COLUMN invited_on SET DEFAULT public.app_today();
ALTER TABLE public.gc_quotes ALTER COLUMN submitted_on SET DEFAULT public.app_today();
ALTER TABLE public.gc_company_contacts ALTER COLUMN contacted_on SET DEFAULT public.app_today();
ALTER TABLE public.gc_trade_promises ALTER COLUMN made_on SET DEFAULT public.app_today();
ALTER TABLE public.gc_trade_promise_moves ALTER COLUMN moved_on SET DEFAULT public.app_today();

CREATE OR REPLACE FUNCTION public.gc_vet_company(p_company_id uuid, p_status text, p_limit numeric DEFAULT NULL, p_note text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.' USING ERRCODE = 'P0001';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('approved', 'declined') THEN
    RAISE EXCEPTION 'Approve the company or decline it.' USING ERRCODE = 'P0001';
  END IF;
  IF p_limit IS NOT NULL AND p_status <> 'approved' THEN
    RAISE EXCEPTION 'A limit goes with an approval only.' USING ERRCODE = 'P0001';
  END IF;
  IF p_limit IS NOT NULL AND p_limit <= 0 THEN
    RAISE EXCEPTION 'The limit is a dollar amount over 0.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_companies
  SET vetting_status = p_status, vetting_limit = p_limit, vetting_decided_on = public.app_today(),
      vetting_decided_by = v_uid, vetting_note = btrim(coalesce(p_note, ''))
  WHERE id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No company with that id.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.gc_keep_promise(p_promise_id uuid, p_on date DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.gc_trade_promises WHERE id = p_promise_id) THEN
    RAISE EXCEPTION 'No promise with that id.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_trade_promises SET kept_on = coalesce(p_on, public.app_today())
  WHERE id = p_promise_id AND kept_on IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.gc_keep_promises(p_company_id uuid, p_kind text, p_project_id uuid DEFAULT NULL, p_package_id uuid DEFAULT NULL, p_on date DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  UPDATE public.gc_trade_promises SET kept_on = coalesce(p_on, public.app_today())
  WHERE kept_on IS NULL AND company_id = p_company_id AND kind = p_kind
    AND project_id IS NOT DISTINCT FROM p_project_id AND package_id IS NOT DISTINCT FROM p_package_id
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.gc_office_decline(p_invite_id uuid, p_why text, p_reason text DEFAULT NULL, p_note text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF p_why IS NULL OR p_why NOT IN ('wont', 'cant') THEN
    RAISE EXCEPTION 'Say whether they will not do it or cannot.' USING ERRCODE = 'P0001';
  END IF;
  IF p_reason IS NOT NULL AND p_reason NOT IN ('busy', 'far', 'size', 'scope', 'terms', 'other') THEN
    RAISE EXCEPTION 'That reason is not one of the picks.' USING ERRCODE = 'P0001';
  END IF;
  IF p_reason = 'other' AND btrim(coalesce(p_note, '')) = '' THEN
    RAISE EXCEPTION 'Write down why in their words.' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.gc_invites
  SET status = 'declined', declined_why = p_why, decline_reason = p_reason,
      decline_note = btrim(coalesce(p_note, '')), declined_on = public.app_today()
  WHERE id = p_invite_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No ask with that id.' USING ERRCODE = 'P0001';
  END IF;
END;
$$;
