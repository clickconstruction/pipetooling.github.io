SET lock_timeout = '3s';

-- Customer properties train, PR 2 (v2.3008): the primary address is a
-- property row. Until now customers.address (a plain string) was the primary
-- and only customer_addresses rows could carry the lien-paperwork legal
-- identity or be linked to a job — so the customer's own house, the most
-- common lien target, could not be lien-ready without being typed twice.
--
-- After this migration every customer with an address has exactly one
-- customer_addresses row flagged is_primary, and customers.address is a
-- MIRROR of that row kept by triggers in both directions, so every existing
-- consumer of customers.address (map links, pickers, supply-house prefill,
-- merge_customers, the New Customer page) keeps working unchanged while the
-- Edit customer modal edits the row.
--
-- Additive and idempotent; no CREATE TABLE.

ALTER TABLE public.customer_addresses
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.customer_addresses.is_primary IS
  'The customer''s primary property (one per customer). customers.address mirrors this row''s address via sync triggers (v2.3008).';

CREATE UNIQUE INDEX IF NOT EXISTS customer_addresses_one_primary_idx
  ON public.customer_addresses (customer_id)
  WHERE is_primary;

-- ---------------------------------------------------------------------------
-- Sync triggers. pg_trigger_depth() > 1 means "I was fired by the other
-- trigger" — the value is already consistent, stop. SECURITY DEFINER so the
-- cross-table write runs regardless of the caller's RLS on the other table
-- (a controller may update customers but not customer_addresses).
-- ---------------------------------------------------------------------------

-- customer_addresses → customers.address
CREATE OR REPLACE FUNCTION public.customer_address_primary_sync_to_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.is_primary THEN
      -- The primary row went away: promote the earliest remaining row, else clear.
      UPDATE public.customer_addresses
         SET is_primary = true, updated_at = now()
       WHERE id = (
         SELECT id FROM public.customer_addresses
          WHERE customer_id = OLD.customer_id AND id <> OLD.id
          ORDER BY sequence_order, created_at
          LIMIT 1
       );
      UPDATE public.customers c
         SET address = (SELECT a.address FROM public.customer_addresses a WHERE a.customer_id = OLD.customer_id AND a.is_primary LIMIT 1)
       WHERE c.id = OLD.customer_id;
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.is_primary THEN
    -- Only one primary per customer: demote any other.
    UPDATE public.customer_addresses
       SET is_primary = false, updated_at = now()
     WHERE customer_id = NEW.customer_id AND id <> NEW.id AND is_primary;
    UPDATE public.customers c
       SET address = NEW.address
     WHERE c.id = NEW.customer_id AND c.address IS DISTINCT FROM NEW.address;
  ELSIF TG_OP = 'UPDATE' AND OLD.is_primary AND NOT NEW.is_primary THEN
    -- Un-starring without starring another leaves the customer with no primary;
    -- keep customers.address as it was (nothing better to say).
    NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_address_primary_sync_to_customer_tr ON public.customer_addresses;
CREATE TRIGGER customer_address_primary_sync_to_customer_tr
  AFTER INSERT OR UPDATE OF address, is_primary OR DELETE ON public.customer_addresses
  FOR EACH ROW EXECUTE FUNCTION public.customer_address_primary_sync_to_customer();

-- customers.address → the primary customer_addresses row
CREATE OR REPLACE FUNCTION public.customer_address_sync_from_customer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_addr text := NULLIF(btrim(COALESCE(NEW.address, '')), '');
  v_primary_id uuid;
  v_match_id uuid;
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.address IS NOT DISTINCT FROM OLD.address THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_primary_id FROM public.customer_addresses
   WHERE customer_id = NEW.id AND is_primary LIMIT 1;

  IF v_addr IS NULL THEN
    -- Address cleared: the primary row stays (its legal record is worth keeping) but is un-starred.
    IF v_primary_id IS NOT NULL THEN
      UPDATE public.customer_addresses SET is_primary = false, updated_at = now() WHERE id = v_primary_id;
    END IF;
    RETURN NEW;
  END IF;

  -- An existing row already spelling this address (case/space-insensitive) becomes the primary.
  SELECT id INTO v_match_id FROM public.customer_addresses
   WHERE customer_id = NEW.id
     AND lower(regexp_replace(btrim(address), '\s+', ' ', 'g')) = lower(regexp_replace(v_addr, '\s+', ' ', 'g'))
   ORDER BY is_primary DESC, sequence_order, created_at
   LIMIT 1;

  IF v_match_id IS NOT NULL THEN
    IF v_primary_id IS NOT NULL AND v_primary_id <> v_match_id THEN
      UPDATE public.customer_addresses SET is_primary = false, updated_at = now() WHERE id = v_primary_id;
    END IF;
    UPDATE public.customer_addresses SET is_primary = true, updated_at = now()
     WHERE id = v_match_id AND NOT is_primary;
  ELSIF v_primary_id IS NOT NULL THEN
    -- The primary was retyped: follow it (the legal record travels with the row —
    -- a different property should be added as a new row and starred instead).
    UPDATE public.customer_addresses SET address = v_addr, updated_at = now() WHERE id = v_primary_id;
  ELSE
    INSERT INTO public.customer_addresses (customer_id, address, is_primary, sequence_order)
    VALUES (NEW.id, v_addr, true, 0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customer_address_sync_from_customer_tr ON public.customers;
CREATE TRIGGER customer_address_sync_from_customer_tr
  AFTER INSERT OR UPDATE OF address ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.customer_address_sync_from_customer();

-- ---------------------------------------------------------------------------
-- Backfill: one primary row per customer that has an address and no primary yet.
-- A row already spelling the address is starred; otherwise a row is created.
-- Depth is 0 here, so the row trigger mirrors back a value that is already
-- equal (no-op by the IS DISTINCT FROM guard).
-- ---------------------------------------------------------------------------
UPDATE public.customer_addresses a
   SET is_primary = true, updated_at = now()
  FROM public.customers c
 WHERE a.customer_id = c.id
   AND NOT a.is_primary
   AND NULLIF(btrim(COALESCE(c.address, '')), '') IS NOT NULL
   AND lower(regexp_replace(btrim(a.address), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(c.address), '\s+', ' ', 'g'))
   AND NOT EXISTS (SELECT 1 FROM public.customer_addresses p WHERE p.customer_id = c.id AND p.is_primary)
   AND a.id = (
     SELECT id FROM public.customer_addresses x
      WHERE x.customer_id = c.id
        AND lower(regexp_replace(btrim(x.address), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(c.address), '\s+', ' ', 'g'))
      ORDER BY sequence_order, created_at LIMIT 1
   );

INSERT INTO public.customer_addresses (customer_id, address, is_primary, sequence_order)
SELECT c.id, btrim(c.address), true, 0
  FROM public.customers c
 WHERE NULLIF(btrim(COALESCE(c.address, '')), '') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM public.customer_addresses p WHERE p.customer_id = c.id AND p.is_primary);
