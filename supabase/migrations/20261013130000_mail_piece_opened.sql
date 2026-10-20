SET lock_timeout = '3s';

-- The owner read it (the Docsmit train, PR 4 — docs/DOCSMIT_LIEN_RUN_PLAN.md, "The owner read it"): the owner's
-- mailed copy carries a QR whose link is the bill's pay page with the piece's short code (?m=CODE). The pay page
-- is public, so it records the open through this one function, callable without a sign-in: the first open stamps
-- mail_pieces.opened_at and adds an event; later opens change nothing. A code that matches nothing does nothing
-- and says false. Nothing about the piece comes back (the pay page already knows its bill); the eight-character
-- code (no 0/O/1/I) is the only key, and there is no listing.

CREATE OR REPLACE FUNCTION public.mail_piece_opened(p_code text)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_id uuid;
BEGIN
  IF v_code !~ '^[A-Z0-9]{6,16}$' THEN
    RETURN false;
  END IF;
  UPDATE public.mail_pieces
     SET opened_at = clock_timestamp(),
         events = events || jsonb_build_array(jsonb_build_object('at', clock_timestamp(), 'kind', 'opened'))
   WHERE short_code = v_code AND opened_at IS NULL
   RETURNING id INTO v_id;
  RETURN v_id IS NOT NULL;
END
$$;

COMMENT ON FUNCTION public.mail_piece_opened(text) IS
  'Docsmit train (v2.5382): the pay page records the first open of a mailed piece by the short code its QR carries (?m=CODE). Public; stamps opened_at once and adds an opened event; false when the code matches nothing or the piece was already opened.';

REVOKE EXECUTE ON FUNCTION public.mail_piece_opened(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mail_piece_opened(text) TO anon, authenticated, service_role;
