-- Allow superintendents to call pay_staff_bulk_insert_user_time_off for team-lead-assigned members only.

CREATE OR REPLACE FUNCTION public.pay_staff_bulk_insert_user_time_off(
  p_user_ids uuid[],
  p_start_date date,
  p_end_date date,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $body$
DECLARE
  v_uid uuid;
  v_today date;
  v_should_sync boolean;
  v_inserted jsonb := '[]'::jsonb;
  v_failed jsonb := '[]'::jsonb;
  v_sync_failed jsonb := '[]'::jsonb;
  v_note text;
  v_row jsonb;
  v_caller_is_superintendent boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'superintendent'
  ) INTO v_caller_is_superintendent;

  IF NOT (
    public.is_dev()
    OR public.is_pay_approved_master()
    OR public.is_assistant_of_pay_approved_master()
    OR public.is_assistant()
    OR v_caller_is_superintendent
  ) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date THEN
    RETURN jsonb_build_object(
      'error', 'invalid date range',
      'inserted', '[]'::jsonb,
      'failed', '[]'::jsonb,
      'sync_failed', '[]'::jsonb
    );
  END IF;

  IF p_user_ids IS NULL OR coalesce(array_length(p_user_ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object(
      'error', 'no user ids',
      'inserted', '[]'::jsonb,
      'failed', '[]'::jsonb,
      'sync_failed', '[]'::jsonb
    );
  END IF;

  IF array_length(p_user_ids, 1) > 200 THEN
    RETURN jsonb_build_object(
      'error', 'too many user ids (max 200)',
      'inserted', '[]'::jsonb,
      'failed', '[]'::jsonb,
      'sync_failed', '[]'::jsonb
    );
  END IF;

  v_today := (timezone('America/Denver', now()))::date;
  v_should_sync := v_today BETWEEN p_start_date AND p_end_date;
  v_note := NULLIF(trim(COALESCE(p_note, '')), '');

  FOR v_uid IN SELECT DISTINCT unnest(p_user_ids)
  LOOP
    IF NOT (
      public.salary_schedule_staff_or_self_target(v_uid)
      OR (
        v_caller_is_superintendent
        AND public.is_team_lead_for_member(auth.uid(), v_uid)
      )
    ) THEN
      v_failed := v_failed || jsonb_build_array(
        jsonb_build_object('user_id', v_uid::text, 'message', 'not authorized for this user')
      );
      CONTINUE;
    END IF;

    v_row := public._pay_staff_bulk_insert_user_time_off_row(
      v_uid,
      p_start_date,
      p_end_date,
      v_note,
      v_today,
      v_should_sync
    );

    IF coalesce(v_row->>'ok', '') = 'true' THEN
      v_inserted := v_inserted || jsonb_build_array(to_jsonb(v_uid::text));
      IF v_row ? 'sync_warning' AND v_row->>'sync_warning' IS NOT NULL AND length(v_row->>'sync_warning') > 0 THEN
        v_sync_failed := v_sync_failed || jsonb_build_array(
          jsonb_build_object('user_id', v_uid::text, 'message', v_row->>'sync_warning')
        );
      END IF;
    ELSE
      v_failed := v_failed || jsonb_build_array(
        jsonb_build_object(
          'user_id',
          v_uid::text,
          'message',
          coalesce(v_row->>'message', 'insert failed')
        )
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'failed', v_failed,
    'sync_failed', v_sync_failed
  );
END;
$body$;

COMMENT ON FUNCTION public.pay_staff_bulk_insert_user_time_off(uuid[], date, date, text) IS
'Pay staff and superintendent team leads: bulk unpaid time off; superintendent may insert only for users in team_leader_assignments as leader; per-user helper; syncs salary for Denver today when range covers today.';
