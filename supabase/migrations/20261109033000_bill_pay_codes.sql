SET lock_timeout = '3s';

-- The bill text's link: a ten-letter code on the bill (v2.6769, punch list #290 PR 2;
-- docs/migrations/20261109033000_bill_pay_codes.md).
--
-- PR 1 (v2.6768) put the bill's pay page in the text: my.clickplumbing.com/pay/<jobs_ledger_invoices.id>, 69 characters,
-- a page that asks Stripe for the bill's current payment link each time it is opened, so the link never expires as
-- Stripe's own does. This migration gives the bill a ten-letter code from the estimate link's alphabet
-- (23456789abcdefghjkmnpqrstuvwxyz, 31 letters with no 0, O, 1, l or I; 31^10 is about 8 × 10^14 codes), so the link
-- reads my.clickplumbing.com/pay/<code>, 43 characters.
--
--   1. jobs_ledger_invoices.pay_code: one code per bill, minted once, kept in plain. The bill's id is already the
--      capability for /pay/<id> and sits in plain on the row, so a code beside it is no weaker; one per bill because a
--      bill has one address for its life; no expiry because a bill is owed until paid, and the paid page stops asking.
--      A shape check and a unique index over the codes that exist.
--   2. mint_pay_code(): ten letters, unbiased (a byte at or past 248 = 8 × 31 is thrown away), as share_estimate_link
--      mints. Harmless on its own: it returns a random string and writes nothing.
--   3. bill_pay_code(p_invoice_id): the bill's code, minted on the first ask. SECURITY INVOKER on purpose: the table's
--      own RLS says who may read and update a bill, and the read-only, twin and archived fences refuse as they do on
--      any update, so a training account is refused and the client falls back to PR 1's link. A caller who can read
--      the row but not update it gets a refusal in words. The service role (create-stripe-invoice, right after it
--      writes a new bill) mints the same way. A code the table already holds (one chance in 10^14) is minted again.
--
-- No CREATE TABLE, so no fence appliers; the column is NULL on every row until its bill is asked for.

-- ---------- 1. The column ----------

ALTER TABLE public.jobs_ledger_invoices ADD COLUMN IF NOT EXISTS pay_code text;

COMMENT ON COLUMN public.jobs_ledger_invoices.pay_code IS
  'The bill''s short link code (#290, v2.6769): ten letters from 23456789abcdefghjkmnpqrstuvwxyz, minted once by bill_pay_code and never expiring; my.clickplumbing.com/pay/<code> opens the pay page, which asks Stripe for the current link. NULL until the first ask.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_ledger_invoices_pay_code_shape') THEN
    -- NOT VALID: every row is NULL today, so there is nothing to scan; new writes are checked from here on.
    ALTER TABLE public.jobs_ledger_invoices
      ADD CONSTRAINT jobs_ledger_invoices_pay_code_shape
      CHECK (pay_code IS NULL OR pay_code ~ '^[23456789abcdefghjkmnpqrstuvwxyz]{10}$') NOT VALID;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS jobs_ledger_invoices_pay_code_key
  ON public.jobs_ledger_invoices (pay_code) WHERE pay_code IS NOT NULL;

-- ---------- 2. The minter ----------

CREATE OR REPLACE FUNCTION public.mint_pay_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  -- 31 letters: the digits 2–9 and the lowercase letters without l and o, nothing that reads as another over the phone.
  v_alphabet CONSTANT text := '23456789abcdefghjkmnpqrstuvwxyz';
  v_length CONSTANT int := 10;
  v_bytes bytea := extensions.gen_random_bytes(32);
  v_i int := 0;
  v_b int;
  v_code text := '';
BEGIN
  WHILE length(v_code) < v_length LOOP
    IF v_i >= length(v_bytes) THEN
      v_bytes := extensions.gen_random_bytes(32);
      v_i := 0;
    END IF;
    v_b := get_byte(v_bytes, v_i);
    v_i := v_i + 1;
    -- 248 = 8 × 31: a byte at or past it is thrown away, so no letter is likelier than another.
    IF v_b < 248 THEN
      v_code := v_code || substr(v_alphabet, (v_b % 31) + 1, 1);
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

COMMENT ON FUNCTION public.mint_pay_code() IS
  'Ten letters from the no-look-alike alphabet, unbiased (#290, v2.6769). Writes nothing; bill_pay_code keeps the one it stores.';

REVOKE ALL ON FUNCTION public.mint_pay_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mint_pay_code() TO authenticated, service_role;

-- ---------- 3. The bill's code ----------

CREATE OR REPLACE FUNCTION public.bill_pay_code(p_invoice_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_tries int := 0;
BEGIN
  SELECT i.pay_code INTO v_code FROM public.jobs_ledger_invoices i WHERE i.id = p_invoice_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That bill is not there.' USING ERRCODE = 'P0001';
  END IF;
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;
  LOOP
    BEGIN
      UPDATE public.jobs_ledger_invoices i
        SET pay_code = public.mint_pay_code()
        WHERE i.id = p_invoice_id AND i.pay_code IS NULL
        RETURNING i.pay_code INTO v_code;
      IF v_code IS NULL THEN
        -- No row updated: another ask minted it a moment ago, or the caller may read the bill but not change it.
        SELECT i.pay_code INTO v_code FROM public.jobs_ledger_invoices i WHERE i.id = p_invoice_id;
        IF v_code IS NULL THEN
          RAISE EXCEPTION 'Only the office can make a bill''s link.' USING ERRCODE = '42501';
        END IF;
      END IF;
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      -- The same code twice: one chance in 10^14. Mint another; give up only if it keeps happening.
      v_tries := v_tries + 1;
      IF v_tries >= 5 THEN
        RAISE;
      END IF;
    END;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.bill_pay_code(uuid) IS
  'The bill''s short link code (#290, v2.6769): the one on the row, or ten letters minted on the first ask and kept. SECURITY INVOKER: the table''s RLS and the read-only, twin and archived fences say who may; a caller who can read the bill but not change it is refused in words. The share row asks once per bill; create-stripe-invoice asks for a new bill.';

REVOKE ALL ON FUNCTION public.bill_pay_code(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bill_pay_code(uuid) TO authenticated, service_role;
