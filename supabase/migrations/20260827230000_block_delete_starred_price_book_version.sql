SET lock_timeout = '3s';

-- v2.2409: a packet's ★ scenario can never be deleted out from under its letter.
--
-- bid_versions.starred_price_book_version_id is ON DELETE SET NULL, so deleting a
-- price scenario silently nulled any packet ★ built on it — which is exactly what
-- happened on 2026-08-27 (BP384: the NORTHSTAR packet's ★ was deleted from a session
-- viewing a different packet; the client guard compared against the viewed packet's
-- star). The client check is fixed, but the invariant belongs in the database.
--
-- BEFORE DELETE trigger: refuse the delete while any LIVE packet stars the scenario.
-- Cascade deletes stay legal on their own: when a packet (bid_versions row) or a whole
-- bid is deleted, the referencing row is already gone by the time the cascade reaches
-- price_book_versions, so the lookup below finds nothing. The JOIN to bids covers the
-- whole-bid cascade regardless of which FK path reaches this table first.
--
-- SECURITY DEFINER so RLS can never hide a starring packet from the check.

CREATE OR REPLACE FUNCTION public.block_delete_starred_price_book_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_holder record;
BEGIN
  SELECT v.id, v.name
    INTO v_holder
    FROM public.bid_versions v
    JOIN public.bids b ON b.id = v.bid_id
   WHERE v.starred_price_book_version_id = OLD.id
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'This price is the customer-facing (star) scenario of packet "%" — star another price for that packet before deleting this one.', v_holder.name
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.block_delete_starred_price_book_version() FROM PUBLIC;

DROP TRIGGER IF EXISTS price_book_versions_block_starred_delete ON public.price_book_versions;
CREATE TRIGGER price_book_versions_block_starred_delete
  BEFORE DELETE ON public.price_book_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.block_delete_starred_price_book_version();
