SET lock_timeout = '3s';

-- An In kind payment leaves pay speed (punch list #301, v2.6834). A credit given instead of money is dated to its
-- bill's own day more often than not, so a customer who pays in kind read as "pays in 0 days" over every credit, and
-- the forecast and the chase judged their bills by that pace. The existing record of a payment left out of pay speed
-- is pay_speed_exclusions (20260825170000): pay_speed_samples already skips a row there, the Data health list
-- already names it *excluded*, and a person can count it again. So nothing is rewritten: an In kind payment gets its
-- exclusion row as it is written, and the In kind payments already on the books get theirs once.
--
--   1. in_kind_payment_leaves_pay_speed: after a payment is inserted, or its kind changes, an In kind payment is
--      given an exclusion row in the app's name. A payment whose kind is changed away from In kind loses the row the
--      app gave it; a row a person made is never touched.
--   2. The In kind payments already recorded get their rows.
--
-- Additive and idempotent. No table is created. The kind is told by v2.6816's own test, as
-- list_unlinked_payments_for_bank_payments writes it.

CREATE OR REPLACE FUNCTION public.in_kind_payment_leaves_pay_speed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_in_kind boolean := lower(coalesce(trim(NEW.payment_type), '')) ~ '(^|[^a-z])in[[:space:]-]?kind';
BEGIN
  IF v_in_kind THEN
    INSERT INTO public.pay_speed_exclusions (payment_id, excluded_by, excluded_by_name, reason)
    VALUES (NEW.id, NULL, 'The app', 'In kind: a credit given instead of money, so it says nothing of how fast the customer pays.')
    ON CONFLICT (payment_id) DO NOTHING;
  ELSIF TG_OP = 'UPDATE' THEN
    DELETE FROM public.pay_speed_exclusions x
    WHERE x.payment_id = NEW.id AND x.excluded_by IS NULL AND x.excluded_by_name = 'The app';
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.in_kind_payment_leaves_pay_speed() FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.in_kind_payment_leaves_pay_speed() IS 'In kind (punch list #301, v2.6834): an In kind payment gets a pay_speed_exclusions row in the app''s name as it is written, so pay speed leaves it out; a payment whose kind changes away from In kind loses that row.';

DROP TRIGGER IF EXISTS in_kind_payment_leaves_pay_speed ON public.jobs_ledger_payments;
CREATE TRIGGER in_kind_payment_leaves_pay_speed
  AFTER INSERT OR UPDATE OF payment_type ON public.jobs_ledger_payments
  FOR EACH ROW EXECUTE FUNCTION public.in_kind_payment_leaves_pay_speed();

INSERT INTO public.pay_speed_exclusions (payment_id, excluded_by, excluded_by_name, reason)
SELECT p.id, NULL, 'The app', 'In kind: a credit given instead of money, so it says nothing of how fast the customer pays.'
FROM public.jobs_ledger_payments p
WHERE lower(coalesce(trim(p.payment_type), '')) ~ '(^|[^a-z])in[[:space:]-]?kind'
ON CONFLICT (payment_id) DO NOTHING;
