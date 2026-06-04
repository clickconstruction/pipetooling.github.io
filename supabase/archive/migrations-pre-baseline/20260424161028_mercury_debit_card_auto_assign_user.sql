-- Switch auto-assign from people (person_id) to app users (user_id), matching Tally user list.

ALTER TABLE public.mercury_debit_card_user_links
  ADD COLUMN auto_assign_user_id uuid REFERENCES public.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.mercury_debit_card_user_links.auto_assign_user_id IS
  'When set, new/updated Mercury transactions for this card get user_id attribution if still unassigned (same users set as Banking / Tally).';

ALTER TABLE public.mercury_debit_card_user_links
  DROP COLUMN auto_assign_person_id;

COMMENT ON TABLE public.mercury_debit_card_user_links IS
  'One Mercury debit card maps to one app user; optional auto_assign_user_id for Banking Sorting user attribution.';

-- Trigger: apply link.auto_assign_user_id → mercury_transaction_attributions.user_id
CREATE OR REPLACE FUNCTION public.mercury_transactions_apply_debit_card_auto_attribution()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_card uuid;
  v_user_id uuid;
BEGIN
  v_card := public.mercury_debit_card_id_from_raw(NEW.raw);
  IF v_card IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT l.auto_assign_user_id INTO v_user_id
  FROM public.mercury_debit_card_user_links l
  WHERE l.mercury_debit_card_id = v_card;

  IF v_user_id IS NULL THEN
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
  VALUES (NEW.id, NULL, v_user_id)
  ON CONFLICT (mercury_transaction_id) DO UPDATE
  SET user_id = EXCLUDED.user_id
  WHERE public.mercury_transaction_attributions.user_id IS NULL
    AND public.mercury_transaction_attributions.person_id IS NULL;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.mercury_transactions_apply_debit_card_auto_attribution() IS
  'Fills mercury_transaction_attributions (user_id) from mercury_debit_card_user_links when unattributed.';

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
  v_user_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN ('dev', 'master_technician', 'assistant')
  ) THEN
    RAISE EXCEPTION 'backfill_mercury_auto_attributions_for_debit_card: not authorized';
  END IF;

  SELECT l.auto_assign_user_id INTO v_user_id
  FROM public.mercury_debit_card_user_links l
  WHERE l.mercury_debit_card_id = p_mercury_debit_card_id;

  IF v_user_id IS NULL THEN
    RETURN 0;
  END IF;

  WITH ins AS (
    INSERT INTO public.mercury_transaction_attributions (mercury_transaction_id, person_id, user_id)
    SELECT
      t.id,
      NULL,
      v_user_id
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
    SET user_id = EXCLUDED.user_id
    WHERE public.mercury_transaction_attributions.user_id IS NULL
      AND public.mercury_transaction_attributions.person_id IS NULL
    RETURNING 1
  )
  SELECT coalesce((SELECT count(*)::int FROM ins), 0) INTO v_cnt;

  RETURN v_cnt;
END;
$$;

COMMENT ON FUNCTION public.backfill_mercury_auto_attributions_for_debit_card(uuid) IS
  'Applies link.auto_assign_user_id to all unattributed Mercury rows for a debit card (staff only).';
