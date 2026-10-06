SET lock_timeout = '3s';

-- Punch list #85, item 27: one firm, said in the schema. The office works with one
-- collections law firm at a time (the guide says "One firm at a time"; the portal, the
-- Lien grid and the emails serve that firm). Settings edits the one active row and
-- inserts only when none is active, so a second active row could only come from a race
-- or a hand edit. A partial unique index on a constant makes it impossible: at most one
-- row may have active = true. Retiring a firm (active = false) and adding the next one
-- still works; inactive rows are unlimited.

DO $$
DECLARE
  v_active int;
BEGIN
  SELECT count(*) INTO v_active FROM public.legal_firms WHERE active;
  IF v_active > 1 THEN
    RAISE EXCEPTION 'legal_firms has % active rows; set active = false on all but one before this migration (punch list #85, item 27)', v_active;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS legal_firms_one_active ON public.legal_firms ((true)) WHERE active;

COMMENT ON INDEX public.legal_firms_one_active IS 'One collections law firm at a time (punch list #85, item 27): at most one legal_firms row with active = true.';
COMMENT ON TABLE public.legal_firms IS 'The collections law firm the office works with (v2.3313). One active row at a time, held by legal_firms_one_active since item 27 of punch list #85; the fee model (contingency %, filing cost) drives the Legal desk''s worth panel. Dev-only writes.';
