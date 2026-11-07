SET lock_timeout = '3s';

-- The license-expiry notices sweep (punch list #253, v2.6630). Dispatch's notice for a license about to expire was
-- asked for only when someone saved the license on People → Licenses, so the licenses imported in March were never
-- asked about, and 14 of the 24 on file lapsed with nothing sent (v2.6424 found it). Every morning the sweep asks for
-- every license inside the thirty-day window whose once-only stamp is still null, under the name the portal's
-- requests already carry, and pushes Dispatch as a Save does. A license already past its expiry gets no notice: the
-- Expired section is its place (the owner's call, 2026-11-07).
--
-- 1. file_license_expiry_notice(license, from_user, link): the one row-maker. The window and the once-only stamp of
--    the baseline's notify_dispatch_license_expiry_if_needed move here, so the Save path and the sweep write the same
--    dispatch_requests row and never two for one license. Not callable from a client.
-- 2. notify_dispatch_license_expiry_if_needed(license, link) keeps its signature and its caller checks (a dev, a
--    pay-approved master or an assistant, signed in: the three gates the pay-visibility overhaul of 20260714200000
--    left standing), and files through 1 under auth.uid().
-- 3. license_expiry_notices_sweep(): the sweep. Runs with no signed-in user (the cron) or as a dev (a run now);
--    anyone else is answered with the reason. The sender is app_settings portal_requests_from_user_id when it names a
--    users row, else the first dev, as submit-portal-request picks it. Each new row is POSTed to
--    /functions/v1/notify-dispatch-request with the Vault CRON_SECRET (the function's cron door, v2.6630), so the
--    Dispatch group hears the push; a Vault or pg_net that is missing (a local bed) leaves the rows standing and names
--    the miss in the answer. Answers { ok, filed, dispatch_request_ids, pushed, from_user_id, push_error? }.
-- 4. Cron license-expiry-notices, 13:12 UTC daily (7:12 AM Central in winter, 8:12 in summer), SELECT 3. Unscheduled
--    first, so a second push leaves one row.
--
-- Additive and idempotent; no table is created, so no fence calls are owed. See
-- docs/migrations/20261107120000_license_expiry_notices_sweep.md.

-- ---------- 1. the row-maker ----------

CREATE OR REPLACE FUNCTION public.file_license_expiry_notice(p_license_id uuid, p_from_user_id uuid, p_link text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_row public.person_licenses%ROWTYPE;
  v_title text;
  v_dr_id uuid;
BEGIN
  IF p_from_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_link IS NULL OR length(trim(p_link)) = 0 OR length(p_link) > 2000 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_row
  FROM public.person_licenses
  WHERE id = p_license_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Once only: a license is asked about one time.
  IF v_row.expiry_dispatch_notified_at IS NOT NULL THEN
    RETURN NULL;
  END IF;

  -- Today through thirty days out. A license already past its expiry gets no notice; the Expired section is its place.
  IF v_row.date_of_expiry < public.app_today() OR v_row.date_of_expiry > (public.app_today() + 30) THEN
    RETURN NULL;
  END IF;

  v_title :=
    'License expiring: ' || v_row.person_name || ' — ' || v_row.license_type
    || ' expires ' || v_row.date_of_expiry::text || ' · Open [1]';

  IF length(v_title) > 2000 THEN
    v_title := left(v_title, 1997) || '...';
  END IF;

  INSERT INTO public.dispatch_requests (from_user_id, title, links, status)
  VALUES (p_from_user_id, v_title, ARRAY[p_link]::text[], 'open')
  RETURNING id INTO v_dr_id;

  UPDATE public.person_licenses
  SET expiry_dispatch_notified_at = now()
  WHERE id = p_license_id;

  RETURN v_dr_id;
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.file_license_expiry_notice(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.file_license_expiry_notice(uuid, uuid, text) IS
  'Punch list #253 (v2.6630): the one row-maker for a license-expiry notice. For a person_licenses row whose expiry is today through today + 30 and whose expiry_dispatch_notified_at is null, inserts one open dispatch_requests row (License expiring: … · Open [1]) under p_from_user_id and stamps the license; answers the row''s id, or NULL when nothing was owed. Called by notify_dispatch_license_expiry_if_needed (the Save path) and license_expiry_notices_sweep (the morning sweep); not callable from a client.';

-- ---------- 2. the Save path, through the row-maker ----------

CREATE OR REPLACE FUNCTION public.notify_dispatch_license_expiry_if_needed(p_license_id uuid, p_link text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- The three gates 20260714200000 left standing; the baseline file's fourth was dissolved there.
  IF NOT (
    public.is_dev()
    OR public.is_pay_approved_master()
    OR public.is_assistant()
  ) THEN
    RETURN NULL;
  END IF;

  RETURN public.file_license_expiry_notice(p_license_id, v_uid, p_link);
END;
$fn$;

COMMENT ON FUNCTION public.notify_dispatch_license_expiry_if_needed(uuid, text) IS
  'Creates a dispatch_requests row and marks person_licenses when expiry is within 30 days; returns dispatch id or NULL. Since v2.6630 it files through file_license_expiry_notice under auth.uid() (a dev, a pay-approved master or an assistant); the morning sweep license_expiry_notices_sweep files the same row for a license a Save never asked about.';

-- ---------- 3. the sweep ----------

CREATE OR REPLACE FUNCTION public.license_expiry_notices_sweep()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_from uuid;
  v_link constant text := 'https://clicktooling.com/people?tab=licenses';
  v_lic record;
  v_dr uuid;
  v_ids uuid[] := '{}'::uuid[];
  v_id uuid;
  v_url text;
  v_secret text;
  v_pushed integer := 0;
  v_push_error text;
BEGIN
  -- The cron runs with no signed-in user; a dev may ask for a run now. Anyone else hears why not.
  IF auth.uid() IS NOT NULL AND NOT public.is_dev() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Only the morning sweep or a dev runs the license notices sweep.');
  END IF;

  -- Whose name: the account the portal's requests go out under, else the first dev (submit-portal-request's rule).
  SELECT u.id INTO v_from
  FROM public.app_settings s
  JOIN public.users u ON u.id::text = btrim(COALESCE(s.value_text, ''))
  WHERE s.key = 'portal_requests_from_user_id'
  LIMIT 1;
  IF v_from IS NULL THEN
    SELECT u.id INTO v_from
    FROM public.users u
    WHERE u.role = 'dev' AND u.archived_at IS NULL
    ORDER BY u.created_at NULLS LAST, u.id
    LIMIT 1;
  END IF;
  IF v_from IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'No account to send under: set portal_requests_from_user_id or keep one dev on the roster.');
  END IF;

  -- Every license inside the window that no Save asked about; the row-maker keeps the once-only stamp.
  FOR v_lic IN
    SELECT l.id
    FROM public.person_licenses l
    WHERE l.expiry_dispatch_notified_at IS NULL
      AND l.date_of_expiry >= public.app_today()
      AND l.date_of_expiry <= (public.app_today() + 30)
    ORDER BY l.date_of_expiry, l.person_name, l.id
  LOOP
    v_dr := public.file_license_expiry_notice(v_lic.id, v_from, v_link);
    IF v_dr IS NOT NULL THEN
      v_ids := v_ids || v_dr;
    END IF;
  END LOOP;

  -- The push: one POST per new row to notify-dispatch-request's cron door, so the Dispatch group hears it as it does
  -- after a Save. A Vault or pg_net that is missing (a local bed) leaves the rows standing and is named in the answer.
  IF cardinality(v_ids) > 0 THEN
    BEGIN
      SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL';
      SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET';
      IF v_url IS NULL OR v_secret IS NULL THEN
        v_push_error := 'PROJECT_URL or CRON_SECRET is not in Vault; the rows were filed and no push went.';
      ELSE
        FOREACH v_id IN ARRAY v_ids LOOP
          PERFORM net.http_post(
            url := v_url || '/functions/v1/notify-dispatch-request',
            headers := jsonb_build_object('Content-Type', 'application/json', 'X-Cron-Secret', v_secret),
            body := jsonb_build_object('dispatch_request_id', v_id, 'mode', 'created')
          );
          v_pushed := v_pushed + 1;
        END LOOP;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_push_error := 'The push was not sent: ' || SQLERRM;
    END;
  END IF;

  RETURN jsonb_strip_nulls(jsonb_build_object(
    'ok', true,
    'filed', cardinality(v_ids),
    'dispatch_request_ids', to_jsonb(v_ids),
    'pushed', v_pushed,
    'from_user_id', v_from,
    'push_error', v_push_error
  ));
END;
$fn$;

REVOKE EXECUTE ON FUNCTION public.license_expiry_notices_sweep() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.license_expiry_notices_sweep() TO authenticated, service_role;
COMMENT ON FUNCTION public.license_expiry_notices_sweep() IS
  'Punch list #253 (v2.6630): the morning sweep for the license-expiry notices a Save never asked for. For every person_licenses row whose expiry is today through today + 30 and whose expiry_dispatch_notified_at is null, files one dispatch_requests row through file_license_expiry_notice under app_settings portal_requests_from_user_id (else the first dev) and POSTs it to notify-dispatch-request with the Vault CRON_SECRET so the Dispatch group hears the push. A license already past its expiry gets no notice; the Expired section is its place. Runs with no signed-in user (cron license-expiry-notices, 13:12 UTC daily) or as a dev; anyone else is answered { ok: false, reason }. Answers { ok, filed, dispatch_request_ids, pushed, from_user_id, push_error? }.';

-- ---------- 4. the cron ----------

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'license-expiry-notices';

SELECT cron.schedule(
  'license-expiry-notices',
  '12 13 * * *',
  $cmd$SELECT public.license_expiry_notices_sweep();$cmd$
);
