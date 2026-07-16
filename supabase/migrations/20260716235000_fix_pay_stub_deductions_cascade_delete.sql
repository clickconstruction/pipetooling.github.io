-- Fix: deleting a pay stub that has ANY deduction rows fails with
--   "pay stub not found for pay_stub_id <uuid>"
-- and the whole delete is aborted.
--
-- User-reachable today: People.tsx deletePayStub() does a straight
-- `supabase.from('pay_stubs').delete().eq('id', ...)` with no child cleanup, relying on the DB cascade —
-- so any stub with at least one deduction is simply undeletable from the UI.
--
-- Cause: pay_stub_deductions_enforce_gross_tr is BEFORE INSERT OR DELETE OR UPDATE OF amount, pay_stub_id
-- on pay_stub_deductions. During the parent's ON DELETE CASCADE the pay_stubs row is already gone by the
-- time the child's BEFORE-DELETE trigger fires, so the function's parent lookup finds nothing and RAISEs.
-- Same bug shape as 20260619120000_guard_activity_events_on_job_delete (a child trigger firing during its
-- parent's cascade and failing because the parent has already been removed).
--
-- Pre-existing since the baseline, NOT caused by the deleted-records archive: it reproduces with the
-- archive trigger dropped. Found while testing tier-2 archive coverage (20260716230000).
--
-- The fix mirrors this table family's own precedent. validate_pay_stub_payments_vs_net() (baseline)
-- performs the identical parent lookup and already returns quietly when the stub is gone:
--     SELECT gross_pay INTO v_gross FROM public.pay_stubs WHERE id = p_stub;
--     IF v_gross IS NULL THEN RETURN; END IF;
-- which is why the two AFTER-DELETE validators on pay_stub_deductions / pay_stub_additional_lines are
-- already cascade-safe. enforce_gross is the one sibling that raises where the others return.
--
-- Scope notes:
--   * pay_stubs.gross_pay is NOT NULL, so "v_gross IS NULL" means the row is genuinely gone — the guard
--     has no second meaning.
--   * On DELETE the cap check is vacuous anyway (removing a deduction only lowers the total), so
--     returning early on the cascade path cannot skip a real violation.
--   * The INSERT/UPDATE cap (v_new_total > v_gross + 0.01) is UNCHANGED — that is what this trigger is
--     for, and it must keep working.
--   * pay_stub_payments_enforce_total_fn() has the same raise-on-missing-parent shape, but its trigger
--     omits DELETE so it never fires on the cascade. Left alone deliberately (latent, not reachable).
--   * No trigger DDL: pay_stub_deductions_enforce_gross_tr already points at this function name and
--     already wires DELETE, so replacing the body updates it in place.
--   * SET search_path = public added per the repo's helper-hardening convention (20260605212302); zero
--     behaviour change, the function only touches public. SECURITY DEFINER deliberately NOT added — that
--     would flip the pay_stubs lookup from invoker to owner and silently change RLS semantics inside a
--     bug fix.

CREATE OR REPLACE FUNCTION public.pay_stub_deductions_enforce_gross_fn()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
DECLARE
  v_gross numeric;
  v_sum_excl numeric;
  v_new_total numeric;
  v_stub uuid;
BEGIN
  v_stub := COALESCE(NEW.pay_stub_id, OLD.pay_stub_id);

  SELECT gross_pay INTO v_gross FROM public.pay_stubs WHERE id = v_stub;
  IF v_gross IS NULL THEN
    -- Parent stub already gone => we are inside its ON DELETE CASCADE. There is no gross to enforce
    -- against, and removing a deduction only lowers the total, so there is nothing to check. Return
    -- quietly, exactly as validate_pay_stub_payments_vs_net() already does in this situation.
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    -- On INSERT/UPDATE a missing stub is still a genuine error. The NOT NULL FK should make this
    -- unreachable, but keep the guard.
    RAISE EXCEPTION 'pay stub not found for pay_stub_id %', v_stub;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_sum_excl
    FROM public.pay_stub_deductions
    WHERE pay_stub_id = NEW.pay_stub_id;
    v_new_total := v_sum_excl + NEW.amount;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_sum_excl
    FROM public.pay_stub_deductions
    WHERE pay_stub_id = NEW.pay_stub_id
      AND id <> NEW.id;
    v_new_total := v_sum_excl + NEW.amount;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_sum_excl
    FROM public.pay_stub_deductions
    WHERE pay_stub_id = OLD.pay_stub_id
      AND id <> OLD.id;
    v_new_total := v_sum_excl;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_new_total > v_gross + 0.01 THEN
    RAISE EXCEPTION 'pay_stub_deductions total would exceed gross pay for stub %', v_stub;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$fn$;

COMMENT ON FUNCTION public.pay_stub_deductions_enforce_gross_fn() IS 'Caps total pay_stub_deductions at the stub''s gross_pay on INSERT/UPDATE. Returns quietly when the parent stub is already gone (its ON DELETE CASCADE), which previously raised and made any stub with deductions undeletable.';
