-- Optional default person for Banking: auto-apply mercury_transaction_attributions.person_id
-- per debit card when a transaction is still unattributed (no person_id, no user_id).

ALTER TABLE public.mercury_debit_card_user_links
  ADD COLUMN auto_assign_person_id uuid REFERENCES public.people (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.mercury_debit_card_user_links.auto_assign_person_id IS
  'When set, new/updated Mercury transactions for this card get person_id attribution if still unassigned.';

COMMENT ON TABLE public.mercury_debit_card_user_links IS
  'One Mercury debit card maps to one app user; optional auto_assign_person_id for Banking Sorting person attribution.';

-- Trigger: after sync or any raw change, apply link.auto_assign_person_id when no manual attribution.
CREATE OR REPLACE FUNCTION public.mercury_transactions_apply_debit_card_auto_attribution()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_card uuid;
  v_person_id uuid;
BEGIN
  v_card := public.mercury_debit_card_id_from_raw(NEW.raw);
  IF v_card IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT l.auto_assign_person_id INTO v_person_id
  FROM public.mercury_debit_card_user_links l
  WHERE l.mercury_debit_card_id = v_card;

  IF v_person_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.mercury_transaction_attributions a
    WHERE a.mercury_transaction_id = NEW.id
      AND (a.user_id IS NOT NULL OR a.person_id IS NOT NULL)
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.mercury_transaction_attributions (mercury_transaction_id, person_id, user_id)
  VALUES (NEW.id, v_person_id, NULL)
  ON CONFLICT (mercury_transaction_id) DO UPDATE
  SET person_id = EXCLUDED.person_id
  WHERE public.mercury_transaction_attributions.user_id IS NULL
    AND public.mercury_transaction_attributions.person_id IS NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mercury_transactions_debit_card_auto_attribution
  ON public.mercury_transactions;
CREATE TRIGGER trg_mercury_transactions_debit_card_auto_attribution
  AFTER INSERT OR UPDATE OF raw ON public.mercury_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.mercury_transactions_apply_debit_card_auto_attribution();

COMMENT ON FUNCTION public.mercury_transactions_apply_debit_card_auto_attribution() IS
  'Fills mercury_transaction_attributions from mercury_debit_card_user_links when unattributed.';

-- Staff: backfill existing rows for a card (e.g. after User Card Link save).
CREATE OR REPLACE FUNCTION public.backfill_mercury_auto_attributions_for_debit_card(
  p_mercury_debit_card_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cnt int;
  v_person_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
  ) THEN
    RAISE EXCEPTION 'backfill_mercury_auto_attributions_for_debit_card: not authorized';
  END IF;

  SELECT l.auto_assign_person_id INTO v_person_id
  FROM public.mercury_debit_card_user_links l
  WHERE l.mercury_debit_card_id = p_mercury_debit_card_id;

  IF v_person_id IS NULL THEN
    RETURN 0;
  END IF;

  WITH ins AS (
    INSERT INTO public.mercury_transaction_attributions (mercury_transaction_id, person_id, user_id)
    SELECT
      t.id,
      v_person_id,
      NULL
    FROM public.mercury_transactions t
    WHERE public.mercury_debit_card_id_from_raw(t.raw) = p_mercury_debit_card_id
      AND (
        NOT EXISTS (
          SELECT 1
          FROM public.mercury_transaction_attributions a
          WHERE a.mercury_transaction_id = t.id
        )
        OR EXISTS (
          SELECT 1
          FROM public.mercury_transaction_attributions a2
          WHERE a2.mercury_transaction_id = t.id
            AND a2.user_id IS NULL
            AND a2.person_id IS NULL
        )
      )
    ON CONFLICT (mercury_transaction_id) DO UPDATE
    SET person_id = EXCLUDED.person_id
    WHERE public.mercury_transaction_attributions.user_id IS NULL
      AND public.mercury_transaction_attributions.person_id IS NULL
    RETURNING 1
  )
  SELECT coalesce((SELECT count(*)::int FROM ins), 0) INTO v_cnt;

  RETURN v_cnt;
END;
$$;

REVOKE ALL ON FUNCTION public.backfill_mercury_auto_attributions_for_debit_card(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backfill_mercury_auto_attributions_for_debit_card(uuid) TO authenticated;

COMMENT ON FUNCTION public.backfill_mercury_auto_attributions_for_debit_card(uuid) IS
  'Applies link.auto_assign_person_id to all unattributed Mercury rows for a debit card (staff only).';
