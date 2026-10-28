SET lock_timeout = '3s';

-- Subs: the run's first text to a sub starts their Messages thread (punch list #153, v2.6032;
-- to-dos/subs-bench-board/README.md → Where it stands). The board's run offers one text after a missed call, through
-- quo-send to a number on the prospect's Messages thread. A sub added through New Prospect that nobody has written to
-- has no contact and no channel (the seven kinds, 20261013180000: a lead's contact is written by Who is this? and
-- Add to Prospects, never by New Prospect, and nobody signed in may insert one), so the press was dead for exactly
-- the subs the run exists for. The door below is contact_for_customer's shape (20261014020000) for a Prospects row.
--
--   * contact_for_prospect(p_prospect_id) answers the contact on the Prospects row (contacts.prospect_id, one per row
--     by contacts_prospect_once), kind lead, as the seven kinds give a Prospects row of any lane (a sub on Prospects
--     is a lead to Messages until it lands on the bench; the kind sub is the roster's). When there is none it makes
--     it, named after the person on the card, else the company, so the thread reads a name to someone the prospects
--     policy refuses (contact_display_name is an invoker). Then it puts the card's numbers (the person's cell and the
--     company's line) and address on the contact as channels where they are missing, so a contact a stranger's text
--     made, or one the office named a lead from an email, gains the card's number. Finding a contact with nothing to
--     add is a read.
--   * SECURITY DEFINER, since the office cannot insert a contact or a channel. It holds the office team
--     (gc_office_team(), the contacts' own policy and what quo-send asks of the caller) and the prospects staff
--     (user_has_prospects_staff_access(), the row's own policy) in its body and says each refusal in words: no
--     sign-in, anyone outside both, a prospect not there. Making or adding is a write, which the house fences would
--     refuse a training account and a digital twin and a definer passes, so the function refuses them in words first.
--   * A number a stranger already texted from stays on that stranger's contact; the card's number lands on the
--     prospect's own contact too, and the webhook's contact_for_channel then follows the last message. Who is this?
--     folds the two when the office says so, never the function.
--   * No table is made, so no fence call; the trigger contacts_keep_thread_on_delete already keeps a deleted
--     prospect's thread as a lead with no record.

CREATE OR REPLACE FUNCTION public.contact_for_prospect(p_prospect_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact uuid;
  v_row public.prospects%ROWTYPE;
  v_missing boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to text a prospect.' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.gc_office_team() OR NOT public.user_has_prospects_staff_access() THEN
    RAISE EXCEPTION 'Only the office texts a prospect.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_row FROM public.prospects p WHERE p.id = p_prospect_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That prospect is not there.' USING ERRCODE = 'P0001';
  END IF;

  -- The contact on their row, and whether the card holds a number or an address the thread does not.
  SELECT x.id INTO v_contact FROM public.contacts x WHERE x.prospect_id = p_prospect_id;
  v_missing := EXISTS (
    SELECT 1
    FROM (VALUES ('phone', v_row.contact_phone), ('phone', v_row.phone_number), ('email', v_row.email)) AS v(kind, value)
    WHERE public.contact_channel_key(v.kind, v.value) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM public.contact_channels ch
        WHERE ch.contact_id = v_contact AND ch.kind = v.kind AND ch.key = public.contact_channel_key(v.kind, v.value)));
  IF v_contact IS NOT NULL AND NOT v_missing THEN
    RETURN v_contact;
  END IF;

  -- A definer passes the read-only blocks and the twin fence, so each is said here before the first write.
  IF public.is_read_only() THEN
    RAISE EXCEPTION 'A training account cannot start a prospect''s thread.' USING ERRCODE = '42501';
  END IF;
  IF public.is_digital_twin() THEN
    RAISE EXCEPTION 'A digital twin cannot start a prospect''s thread.' USING ERRCODE = '42501';
  END IF;

  IF v_contact IS NULL THEN
    -- Two presses at once make one contact: the second meets contacts_prospect_once and reads the first's.
    INSERT INTO public.contacts (kind, prospect_id, name)
    VALUES ('lead', p_prospect_id,
            coalesce(nullif(left(btrim(coalesce(v_row.contact_name, '')), 200), ''), nullif(left(btrim(coalesce(v_row.company_name, '')), 200), '')))
    ON CONFLICT (prospect_id) WHERE prospect_id IS NOT NULL DO NOTHING
    RETURNING id INTO v_contact;
    IF v_contact IS NULL THEN
      SELECT x.id INTO v_contact FROM public.contacts x WHERE x.prospect_id = p_prospect_id;
    END IF;
  END IF;

  -- The card's numbers and address onto the thread, once each, where missing (contact_channels_once).
  INSERT INTO public.contact_channels (contact_id, kind, value)
  SELECT DISTINCT ON (v.kind, public.contact_channel_key(v.kind, v.value)) v_contact, v.kind, btrim(v.value)
  FROM (VALUES (1, 'phone', v_row.contact_phone), (2, 'phone', v_row.phone_number), (3, 'email', v_row.email)) AS v(ord, kind, value)
  WHERE public.contact_channel_key(v.kind, v.value) <> ''
  ORDER BY v.kind, public.contact_channel_key(v.kind, v.value), v.ord
  ON CONFLICT DO NOTHING;
  RETURN v_contact;
END;
$$;

COMMENT ON FUNCTION public.contact_for_prospect(uuid) IS
  'Subs (v2.6032, punch list #153): the contact on a Prospects row (kind lead), made when there is none and named after the card, with the card''s numbers and address added as channels where missing. SECURITY DEFINER: the office team on the prospects staff only, said in words; a training account and a digital twin may find one and never make or add.';

REVOKE ALL ON FUNCTION public.contact_for_prospect(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contact_for_prospect(uuid) TO authenticated, service_role;
