SET lock_timeout = '3s';

-- Messages: a number on the roster lands on its teammate or sub with no Who is this? (v2.5549, the second PR of the
-- owner's ask of 2026-10-14; the first, 20261015010000_contacts_team_kind.sql, gave today's roster its contacts).
-- quo_place_number, as the webhook places a number: when no contact holds the number, it reads the roster before it
-- makes an unknown contact. A roster person, not archived, whose People record holds the number gets the line on
-- their contact, made now with the roster's kind (sub, else team) when the seed has not made it, and the number as
-- its channel. So a teammate added after the seed, or given a number later, is known the moment they text.
-- The office's own writes are unchanged; the function stays the service role's.

CREATE OR REPLACE FUNCTION public.quo_place_number(p_value text, p_name text)
RETURNS TABLE (
  placed_contact uuid, placed_channel uuid, stopped_at timestamptz, made boolean,
  placed_kind text, placed_name text, placed_goes_by text
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_key text := public.contact_channel_key('phone', p_value);
  v_contact uuid;
  v_channel uuid;
  v_person uuid;
  v_person_kind text;
  v_made boolean := false;
BEGIN
  IF coalesce(v_key, '') = '' THEN
    RAISE EXCEPTION 'That is not a phone number: %', p_value;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('quo_place_number:' || v_key, 0));
  v_contact := public.contact_for_channel('phone', p_value);
  IF v_contact IS NULL THEN
    -- The roster's own number (v2.5549): the person it belongs to, their contact made now when the seed has not.
    SELECT p.id, p.kind INTO v_person, v_person_kind
    FROM public.people p
    WHERE p.archived_at IS NULL AND public.contact_channel_key('phone', p.phone) = v_key
    ORDER BY p.created_at, p.id
    LIMIT 1;
    IF v_person IS NOT NULL THEN
      SELECT c.id INTO v_contact FROM public.contacts c WHERE c.person_id = v_person ORDER BY c.created_at, c.id LIMIT 1;
      IF v_contact IS NULL THEN
        INSERT INTO public.contacts (kind, person_id)
        VALUES (CASE WHEN v_person_kind = 'sub' THEN 'sub' ELSE 'team' END, v_person)
        RETURNING id INTO v_contact;
        v_made := true;
      END IF;
      INSERT INTO public.contact_channels (contact_id, kind, value) VALUES (v_contact, 'phone', p_value);
    ELSE
      INSERT INTO public.contacts (kind, name) VALUES ('unknown', coalesce(nullif(btrim(p_name), ''), p_value))
        RETURNING id INTO v_contact;
      INSERT INTO public.contact_channels (contact_id, kind, value) VALUES (v_contact, 'phone', p_value)
        RETURNING id INTO v_channel;
      RETURN QUERY SELECT v_contact, v_channel, NULL::timestamptz, true, 'unknown'::text,
        coalesce(nullif(btrim(p_name), ''), p_value), NULL::text;
      RETURN;
    END IF;
  END IF;
  RETURN QUERY
    SELECT ch.contact_id, ch.id, ch.opted_out_at, v_made, c.kind,
      coalesce(
        nullif(btrim(c.name), ''),
        nullif(btrim(CASE
          WHEN c.customer_id IS NOT NULL THEN (SELECT x.name FROM public.customers x WHERE x.id = c.customer_id)
          WHEN c.customer_contact_person_id IS NOT NULL THEN (SELECT x.name FROM public.customer_contact_persons x WHERE x.id = c.customer_contact_person_id)
          WHEN c.gc_company_id IS NOT NULL THEN (SELECT coalesce(nullif(btrim(x.contact_name), ''), x.name) FROM public.gc_companies x WHERE x.id = c.gc_company_id)
          WHEN c.gc_company_person_id IS NOT NULL THEN (SELECT x.name FROM public.gc_company_people x WHERE x.id = c.gc_company_person_id)
          WHEN c.person_id IS NOT NULL THEN (SELECT x.name FROM public.people x WHERE x.id = c.person_id)
        END), ''),
        ch.value),
      c.goes_by
    FROM public.contact_channels ch
    JOIN public.contacts c ON c.id = ch.contact_id
    WHERE ch.contact_id = v_contact AND ch.kind = 'phone' AND ch.key = v_key
    ORDER BY ch.created_at, ch.id
    LIMIT 1;
END
$$;
