-- Estimate catalog: line_item, quantity, unit_price_cents + derived amount_cents; extend audit + RPC payload.

ALTER TABLE public.estimate_catalog_items
  ADD COLUMN IF NOT EXISTS line_item text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS quantity numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unit_price_cents integer NOT NULL DEFAULT 0;

ALTER TABLE public.estimate_catalog_items
  DROP CONSTRAINT IF EXISTS estimate_catalog_items_quantity_check;

ALTER TABLE public.estimate_catalog_items
  ADD CONSTRAINT estimate_catalog_items_quantity_check CHECK (quantity > 0);

ALTER TABLE public.estimate_catalog_items
  DROP CONSTRAINT IF EXISTS estimate_catalog_items_unit_price_cents_check;

ALTER TABLE public.estimate_catalog_items
  ADD CONSTRAINT estimate_catalog_items_unit_price_cents_check CHECK (unit_price_cents >= 0);

COMMENT ON COLUMN public.estimate_catalog_items.line_item IS 'Short line / catalog name (separate from description notes).';
COMMENT ON COLUMN public.estimate_catalog_items.quantity IS 'Count multiplier; extended amount_cents = round(quantity * unit_price_cents).';
COMMENT ON COLUMN public.estimate_catalog_items.unit_price_cents IS 'Unit price in cents; extended total stored in amount_cents.';

-- Backfill from legacy single-amount lines (qty 1, unit = former line total).
UPDATE public.estimate_catalog_items
SET
  quantity = 1,
  unit_price_cents = amount_cents,
  line_item = COALESCE(line_item, '')
WHERE unit_price_cents = 0 AND amount_cents IS NOT NULL;

-- If any row still has unit 0 but amount 0, leave as-is.

ALTER TABLE public.estimate_catalog_item_events
  ADD COLUMN IF NOT EXISTS prev_line_item text,
  ADD COLUMN IF NOT EXISTS new_line_item text,
  ADD COLUMN IF NOT EXISTS prev_quantity numeric,
  ADD COLUMN IF NOT EXISTS new_quantity numeric,
  ADD COLUMN IF NOT EXISTS prev_unit_price_cents integer,
  ADD COLUMN IF NOT EXISTS new_unit_price_cents integer;

CREATE OR REPLACE FUNCTION public.replace_estimate_catalog_payload(p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_payload_ids uuid[];
  v_id_total int;
  v_id_distinct int;
  r_live record;
  v_elem jsonb;
  v_idx int;
  v_id uuid;
  v_line text;
  v_desc text;
  v_qty numeric;
  v_unit int;
  v_amt int;
  v_row public.estimate_catalog_items%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.user_can_manage_estimate_catalog() THEN
    RAISE EXCEPTION 'Not allowed to manage estimate catalog';
  END IF;

  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'array' THEN
    RAISE EXCEPTION 'payload must be a JSON array';
  END IF;

  SELECT COUNT(*)::int
  INTO v_id_total
  FROM jsonb_array_elements(p_payload) elem
  WHERE elem ? 'id'
    AND nullif(trim(elem->>'id'), '') IS NOT NULL;

  SELECT COUNT(DISTINCT (trim(elem->>'id'))::uuid)::int
  INTO v_id_distinct
  FROM jsonb_array_elements(p_payload) elem
  WHERE elem ? 'id'
    AND nullif(trim(elem->>'id'), '') IS NOT NULL;

  IF v_id_total <> v_id_distinct THEN
    RAISE EXCEPTION 'Duplicate catalog ids in payload';
  END IF;

  SELECT COALESCE(
    array_agg(DISTINCT (trim(elem->>'id'))::uuid) FILTER (WHERE nullif(trim(elem->>'id'), '') IS NOT NULL),
    ARRAY[]::uuid[]
  )
  INTO v_payload_ids
  FROM jsonb_array_elements(p_payload) elem
  WHERE elem ? 'id'
    AND nullif(trim(elem->>'id'), '') IS NOT NULL;

  FOR r_live IN
    SELECT *
    FROM public.estimate_catalog_items
    WHERE deleted_at IS NULL
  LOOP
    IF NOT (r_live.id = ANY (v_payload_ids)) THEN
      INSERT INTO public.estimate_catalog_item_events (
        item_id,
        editor_user_id,
        action,
        prev_line_item,
        prev_description,
        prev_quantity,
        prev_unit_price_cents,
        prev_amount_cents,
        new_line_item,
        new_description,
        new_quantity,
        new_unit_price_cents,
        new_amount_cents
      )
      VALUES (
        r_live.id,
        v_uid,
        'delete',
        r_live.line_item,
        r_live.description,
        r_live.quantity,
        r_live.unit_price_cents,
        r_live.amount_cents,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL
      );

      UPDATE public.estimate_catalog_items
      SET deleted_at = now(),
          updated_at = now()
      WHERE id = r_live.id;
    END IF;
  END LOOP;

  FOR v_elem, v_idx IN
    SELECT elem, ord::int
    FROM jsonb_array_elements(p_payload) WITH ORDINALITY AS t(elem, ord)
  LOOP
    v_line := trim(COALESCE(v_elem->>'line_item', ''));
    v_desc := trim(COALESCE(v_elem->>'description', ''));

    BEGIN
      IF v_elem ? 'quantity' AND nullif(trim(v_elem->>'quantity'), '') IS NOT NULL THEN
        v_qty := (v_elem->>'quantity')::numeric;
      ELSE
        v_qty := 1::numeric;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_qty := 1::numeric;
    END;

    IF v_qty <= 0 THEN
      v_qty := 1::numeric;
    END IF;

    v_unit := GREATEST(
      0,
      COALESCE((v_elem->>'unit_price_cents')::numeric, 0)::integer
    );

    -- Legacy payload: only amount_cents (line total), qty 1.
    IF v_unit = 0
      AND v_elem ? 'amount_cents'
      AND COALESCE((v_elem->>'amount_cents')::numeric, 0) > 0    THEN
      v_unit := GREATEST(
        0,
        COALESCE((v_elem->>'amount_cents')::numeric, 0)::integer
      );
      v_qty := 1::numeric;
    END IF;

    v_amt := GREATEST(0, ROUND((v_qty * v_unit)::numeric)::integer);

    IF v_line = '' AND v_desc = '' AND v_amt = 0 THEN
      CONTINUE;
    END IF;

    IF v_elem ? 'id' AND nullif(trim(v_elem->>'id'), '') IS NOT NULL THEN
      v_id := trim(v_elem->>'id')::uuid;

      SELECT *
      INTO v_row
      FROM public.estimate_catalog_items
      WHERE id = v_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Unknown catalog id %', v_id;
      END IF;

      IF v_row.deleted_at IS NOT NULL THEN
        INSERT INTO public.estimate_catalog_item_events (
          item_id,
          editor_user_id,
          action,
          prev_line_item,
          prev_description,
          prev_quantity,
          prev_unit_price_cents,
          prev_amount_cents,
          new_line_item,
          new_description,
          new_quantity,
          new_unit_price_cents,
          new_amount_cents
        )
        VALUES (
          v_id,
          v_uid,
          'restore',
          NULL,
          NULL,
          NULL,
          NULL,
          NULL,
          v_line,
          v_desc,
          v_qty,
          v_unit,
          v_amt
        );

        UPDATE public.estimate_catalog_items
        SET line_item = v_line,
            description = v_desc,
            quantity = v_qty,
            unit_price_cents = v_unit,
            amount_cents = v_amt,
            sort_order = v_idx,
            deleted_at = NULL,
            updated_at = now()
        WHERE id = v_id;
      ELSE
        IF v_row.line_item IS DISTINCT FROM v_line
          OR v_row.description IS DISTINCT FROM v_desc
          OR v_row.quantity IS DISTINCT FROM v_qty
          OR v_row.unit_price_cents IS DISTINCT FROM v_unit
        THEN
          INSERT INTO public.estimate_catalog_item_events (
            item_id,
            editor_user_id,
            action,
            prev_line_item,
            prev_description,
            prev_quantity,
            prev_unit_price_cents,
            prev_amount_cents,
            new_line_item,
            new_description,
            new_quantity,
            new_unit_price_cents,
            new_amount_cents
          )
          VALUES (
            v_id,
            v_uid,
            'update',
            v_row.line_item,
            v_row.description,
            v_row.quantity,
            v_row.unit_price_cents,
            v_row.amount_cents,
            v_line,
            v_desc,
            v_qty,
            v_unit,
            v_amt
          );
        END IF;

        UPDATE public.estimate_catalog_items
        SET line_item = v_line,
            description = v_desc,
            quantity = v_qty,
            unit_price_cents = v_unit,
            amount_cents = v_amt,
            sort_order = v_idx,
            updated_at = now()
        WHERE id = v_id;
      END IF;
    ELSE
      INSERT INTO public.estimate_catalog_items (
        line_item,
        description,
        quantity,
        unit_price_cents,
        amount_cents,
        sort_order
      )
      VALUES (
        v_line,
        v_desc,
        v_qty,
        v_unit,
        v_amt,
        v_idx
      )
      RETURNING id INTO v_id;

      INSERT INTO public.estimate_catalog_item_events (
        item_id,
        editor_user_id,
        action,
        prev_line_item,
        prev_description,
        prev_quantity,
        prev_unit_price_cents,
        prev_amount_cents,
        new_line_item,
        new_description,
        new_quantity,
        new_unit_price_cents,
        new_amount_cents
      )
      VALUES (
        v_id,
        v_uid,
        'create',
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        v_line,
        v_desc,
        v_qty,
        v_unit,
        v_amt
      );
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.replace_estimate_catalog_payload(jsonb) IS
  'Replaces live catalog from JSON array [{ id?, line_item, description, quantity, unit_price_cents }]; amount_cents derived as round(quantity*unit_price); legacy { description, amount_cents } treated as qty 1; soft-deletes missing ids; writes audit events.';
