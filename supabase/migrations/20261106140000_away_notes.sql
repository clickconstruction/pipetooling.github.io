SET lock_timeout = '3s';

-- The Away note (punch list #256, PR 8, v2.6587). While a teammate is away, the office leaves them one screen,
-- written person by person: a note in the office's words, a countdown to the day back, where the office is and the
-- office line. They sign in as always and the app draws that screen and nothing else, behind the seal of
-- 20261106120000_archived_seal: the pre-request gate refuses every request from an archived caller except
-- /rpc/my_away_note, the fence on every table reads nothing for them, and the edge guard turns them away. This file is
-- the note's table and the one RPC the gate lets through.
--
--   1. away_notes — one row per account (the person signs in by account), the office's words and switches.
--   2. Reads for the people who may archive (dev, controller, a pay-approved master; the gate archive-user admits).
--      No write policy for anyone: the edge function away-note writes as the service role, since a note on an
--      archived account also lifts the sign-in ban and taking it down puts the ban back.
--   3. my_away_note() — everything the sealed screen draws, for the archived caller alone: their first name, the
--      note, the day they left, the office address and line. SECURITY DEFINER, since the fence closes every table
--      to them. Anyone else gets null.
--
-- Additive and idempotent. One table is created, so the file ends with the four fence calls.

-- 1. The table.
CREATE TABLE IF NOT EXISTS public.away_notes (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  words text NOT NULL DEFAULT '' CHECK (length(words) <= 600),
  countdown_ymd date,
  show_where boolean NOT NULL DEFAULT true,
  show_call boolean NOT NULL DEFAULT true,
  alert_on_day boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT away_notes_alert_needs_day CHECK (NOT alert_on_day OR countdown_ymd IS NOT NULL)
);
COMMENT ON TABLE public.away_notes IS 'The Away note (#256 PR 8): the one screen a teammate who left sees when they sign in. One row per account: the office''s words (600 characters at most), the day back the countdown runs to, whether the screen shows where the office is and the office line, and whether the office wants a Needs you item on the day. Written by the away-note edge function alone, read by the people who may archive; the person reads theirs through my_away_note().';
COMMENT ON COLUMN public.away_notes.countdown_ymd IS 'The day back the countdown runs to, on the phone''s clock; null for no countdown.';
COMMENT ON COLUMN public.away_notes.alert_on_day IS 'Tell me when the countdown ends: a Needs you item for the office on the day, with Bring back on it (PR 9). Off by default.';

DROP TRIGGER IF EXISTS away_notes_touch_updated_at ON public.away_notes;
CREATE TRIGGER away_notes_touch_updated_at BEFORE UPDATE ON public.away_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.away_notes ENABLE ROW LEVEL SECURITY;

-- 2. Reads for the people who may archive: the set archive-user admits (dev, controller, pay-approved master).
DROP POLICY IF EXISTS away_notes_read_offboarding ON public.away_notes;
CREATE POLICY away_notes_read_offboarding ON public.away_notes
  FOR SELECT TO authenticated
  USING (public.is_pay_approved_master() OR public.is_controller());

REVOKE ALL ON public.away_notes FROM PUBLIC, anon;
GRANT SELECT ON public.away_notes TO authenticated;
GRANT ALL ON public.away_notes TO service_role;

-- 3. The one RPC the gate lets an archived caller reach. Null for an active account, for an archived account with
--    no note, and for no caller. The day they left is the roster row's end date, else the day the account was
--    archived in the company's calendar. The office address is Settings → Office address as stored
--    (app_settings.office_address_v1, JSON with address, lat, lng) and the line is the dispatch phone
--    (field_dispatch_phone_v1); the screen's kernel reads the city and the links out of them.
CREATE OR REPLACE FUNCTION public.my_away_note() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_user record;
  v_note record;
  v_left date;
  v_office text;
  v_phone text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT id, name, archived_at INTO v_user FROM public.users WHERE id = v_uid;
  IF v_user.id IS NULL OR v_user.archived_at IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_note FROM public.away_notes WHERE user_id = v_uid;
  IF v_note.user_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT p.end_date INTO v_left
  FROM public.people p
  WHERE p.account_user_id = v_uid AND p.end_date IS NOT NULL
  ORDER BY p.end_date DESC
  LIMIT 1;
  IF v_left IS NULL THEN
    v_left := (v_user.archived_at AT TIME ZONE 'America/Chicago')::date;
  END IF;
  SELECT value_text INTO v_office FROM public.app_settings WHERE key = 'office_address_v1';
  SELECT value_text INTO v_phone FROM public.app_settings WHERE key = 'field_dispatch_phone_v1';
  RETURN jsonb_build_object(
    'first_name', NULLIF(split_part(btrim(coalesce(v_user.name, '')), ' ', 1), ''),
    'words', v_note.words,
    'countdown_ymd', v_note.countdown_ymd,
    'show_where', v_note.show_where,
    'show_call', v_note.show_call,
    'left_ymd', v_left,
    'updated_ymd', (v_note.updated_at AT TIME ZONE 'America/Chicago')::date,
    'office_address', v_office,
    'office_phone', v_phone
  );
END $$;

COMMENT ON FUNCTION public.my_away_note() IS 'The Away note for the signed-in archived caller (#256 PR 8): first name, the note, its switches, the day they left, the office address setting and the office line; null for anyone else. The one RPC the archived pre-request gate lets through.';

REVOKE ALL ON FUNCTION public.my_away_note() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_away_note() TO authenticated, service_role;

-- The four fence calls: a table was made.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
