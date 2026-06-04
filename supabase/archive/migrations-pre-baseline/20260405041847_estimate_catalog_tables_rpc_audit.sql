-- Estimate line item catalog: normalized items + audit events (replaces app_settings JSON for live data).
-- RLS: staff roles aligned with estimates_select. Writes only via replace_estimate_catalog_payload (SECURITY DEFINER).

CREATE TABLE public.estimate_catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

COMMENT ON TABLE public.estimate_catalog_items IS
  'Org-wide preset line items for draft estimates; soft-deleted rows retain id for MRU and audit.';

CREATE INDEX idx_estimate_catalog_items_sort_live
  ON public.estimate_catalog_items (sort_order)
  WHERE deleted_at IS NULL;

CREATE TABLE public.estimate_catalog_item_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.estimate_catalog_items (id) ON DELETE RESTRICT,
  editor_user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE RESTRICT,
  edited_at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete', 'restore')),
  prev_description text,
  prev_amount_cents integer,
  new_description text,
  new_amount_cents integer
);

COMMENT ON TABLE public.estimate_catalog_item_events IS
  'Append-only edit history for estimate_catalog_items; inserted only from replace_estimate_catalog_payload.';

CREATE INDEX idx_estimate_catalog_events_item_edited
  ON public.estimate_catalog_item_events (item_id, edited_at DESC);

CREATE INDEX idx_estimate_catalog_events_edited
  ON public.estimate_catalog_item_events (edited_at DESC);

-- ---------------------------------------------------------------------------
-- Role helper (same six roles as core estimates staff)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_can_manage_estimate_catalog()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role IN (
        'dev',
        'master_technician',
        'assistant',
        'estimator',
        'primary',
        'superintendent'
      )
  );
$$;

COMMENT ON FUNCTION public.user_can_manage_estimate_catalog() IS
  'True when current user may read/write estimate line item catalog (Estimates-page staff roles).';

-- ---------------------------------------------------------------------------
-- RLS: SELECT only for clients; mutations via SECURITY DEFINER RPC
-- ---------------------------------------------------------------------------
ALTER TABLE public.estimate_catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_catalog_item_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY estimate_catalog_items_select
  ON public.estimate_catalog_items
  FOR SELECT
  TO authenticated
  USING (public.user_can_manage_estimate_catalog());

CREATE POLICY estimate_catalog_item_events_select
  ON public.estimate_catalog_item_events
  FOR SELECT
  TO authenticated
  USING (public.user_can_manage_estimate_catalog());

-- ---------------------------------------------------------------------------
-- Atomic replace + audit
-- ---------------------------------------------------------------------------
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
  v_desc text;
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
        prev_description,
        prev_amount_cents,
        new_description,
        new_amount_cents
      )
      VALUES (
        r_live.id,
        v_uid,
        'delete',
        r_live.description,
        r_live.amount_cents,
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
    v_desc := trim(COALESCE(v_elem->>'description', ''));
    v_amt := GREATEST(
      0,
      COALESCE((v_elem->>'amount_cents')::numeric, 0)::integer
    );

    IF v_desc = '' AND v_amt = 0 THEN
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
          prev_description,
          prev_amount_cents,
          new_description,
          new_amount_cents
        )
        VALUES (
          v_id,
          v_uid,
          'restore',
          NULL,
          NULL,
          v_desc,
          v_amt
        );

        UPDATE public.estimate_catalog_items
        SET description = v_desc,
            amount_cents = v_amt,
            sort_order = v_idx,
            deleted_at = NULL,
            updated_at = now()
        WHERE id = v_id;
      ELSE
        IF v_row.description IS DISTINCT FROM v_desc
          OR v_row.amount_cents IS DISTINCT FROM v_amt
        THEN
          INSERT INTO public.estimate_catalog_item_events (
            item_id,
            editor_user_id,
            action,
            prev_description,
            prev_amount_cents,
            new_description,
            new_amount_cents
          )
          VALUES (
            v_id,
            v_uid,
            'update',
            v_row.description,
            v_row.amount_cents,
            v_desc,
            v_amt
          );
        END IF;

        UPDATE public.estimate_catalog_items
        SET description = v_desc,
            amount_cents = v_amt,
            sort_order = v_idx,
            updated_at = now()
        WHERE id = v_id;
      END IF;
    ELSE
      INSERT INTO public.estimate_catalog_items (
        description,
        amount_cents,
        sort_order
      )
      VALUES (
        v_desc,
        v_amt,
        v_idx
      )
      RETURNING id INTO v_id;

      INSERT INTO public.estimate_catalog_item_events (
        item_id,
        editor_user_id,
        action,
        prev_description,
        prev_amount_cents,
        new_description,
        new_amount_cents
      )
      VALUES (
        v_id,
        v_uid,
        'create',
        NULL,
        NULL,
        v_desc,
        v_amt
      );
    END IF;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.replace_estimate_catalog_payload(jsonb) IS
  'Replaces live catalog from JSON array [{ id?, description, amount_cents }]; soft-deletes missing ids; writes audit events.';

GRANT SELECT ON public.estimate_catalog_items TO authenticated;
GRANT SELECT ON public.estimate_catalog_item_events TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_estimate_catalog_payload(jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- Backfill from legacy app_settings JSON (no audit events for import)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  j jsonb;
BEGIN
  SELECT value_text::jsonb INTO j
  FROM public.app_settings
  WHERE key = 'estimate_line_item_catalog';

  IF j IS NOT NULL AND jsonb_typeof(j) = 'array' THEN
    INSERT INTO public.estimate_catalog_items (
      id,
      description,
      amount_cents,
      sort_order
    )
    SELECT
      (trim(elem->>'id'))::uuid,
      COALESCE(trim(elem->>'description'), ''),
      GREATEST(0, COALESCE((elem->>'amount_cents')::numeric, 0)::integer),
      ord::int
    FROM jsonb_array_elements(j) WITH ORDINALITY AS t(elem, ord)
    WHERE nullif(trim(elem->>'id'), '') IS NOT NULL
    ON CONFLICT (id) DO NOTHING;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignore malformed legacy JSON
    NULL;
END;
$$;
