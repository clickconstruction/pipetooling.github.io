SET lock_timeout = '3s';

-- Custom portal addresses (portal custom-links train, PR A / migration 2).
--
-- One human-readable address per company (my.clickplumbing.com/knight-contracting)
-- that resolves to the customer's merged 'all' portal link. Company-level so it
-- SURVIVES token rotation — rotating the link never breaks the printed address.
-- The slug is freely editable until first shared (first office Copy, or first
-- public resolve), then locked_at is set and editing moves behind the gear with
-- a "printed copies go stale" warning. Events feed the modal's history list.

CREATE TABLE IF NOT EXISTS public.customer_portal_slugs (
  customer_id uuid PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
  locked_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.customer_portal_slugs IS
  'Custom portal address per customer (portal custom-links train). Resolves to the active audience=''all'' portal link; locked_at set on first share (office Copy or first public resolve).';

CREATE TABLE IF NOT EXISTS public.customer_portal_slug_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('created', 'changed', 'locked')),
  slug text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.customer_portal_slug_events IS
  'Append-only history of portal-address changes (created / changed / locked) shown in the globe modal''s History row.';

CREATE INDEX IF NOT EXISTS idx_customer_portal_slug_events_customer
  ON public.customer_portal_slug_events (customer_id, created_at DESC);

ALTER TABLE public.customer_portal_slugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_portal_slug_events ENABLE ROW LEVEL SECURITY;

-- Office-readable, same shape as customer_portal_links; all writes go through
-- the SECURITY DEFINER RPCs below (or the service-role edge function).
DROP POLICY IF EXISTS "Office can read portal slugs" ON public.customer_portal_slugs;
CREATE POLICY "Office can read portal slugs" ON public.customer_portal_slugs
  FOR SELECT USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (
         SELECT 1 FROM public.users u
         WHERE u.id = (SELECT auth.uid()) AND u.role IN ('master_technician', 'primary')
       )
  );

DROP POLICY IF EXISTS "Office can read portal slug events" ON public.customer_portal_slug_events;
CREATE POLICY "Office can read portal slug events" ON public.customer_portal_slug_events
  FOR SELECT USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (
         SELECT 1 FROM public.users u
         WHERE u.id = (SELECT auth.uid()) AND u.role IN ('master_technician', 'primary')
       )
  );

GRANT SELECT ON TABLE public.customer_portal_slugs TO authenticated;
GRANT SELECT ON TABLE public.customer_portal_slug_events TO authenticated;

-- Create or change a customer's portal address. Allowed before AND after lock
-- (post-lock the modal shows the stale-copies warning first). Friendly error
-- strings, never raw constraint failures.
CREATE OR REPLACE FUNCTION public.set_customer_portal_slug(
  p_customer_id uuid,
  p_slug text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
  v_slug text;
  v_old text;
BEGIN
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
    INTO v_ok;
  IF NOT COALESCE(v_ok, false) THEN
    RETURN jsonb_build_object('error', 'Not authorized to manage portal links');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers c WHERE c.id = p_customer_id) THEN
    RETURN jsonb_build_object('error', 'Customer not found');
  END IF;

  v_slug := lower(trim(coalesce(p_slug, '')));
  IF v_slug !~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$' THEN
    RETURN jsonb_build_object('error', 'Addresses are 3-60 characters: letters, numbers, and dashes.');
  END IF;

  SELECT slug INTO v_old FROM public.customer_portal_slugs WHERE customer_id = p_customer_id;
  IF v_old = v_slug THEN
    RETURN jsonb_build_object('slug', v_slug, 'unchanged', true);
  END IF;

  BEGIN
    INSERT INTO public.customer_portal_slugs (customer_id, slug, created_by)
    VALUES (p_customer_id, v_slug, auth.uid())
    ON CONFLICT (customer_id)
    DO UPDATE SET slug = EXCLUDED.slug, updated_at = now();
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('error', 'That address is taken — try another.');
  END;

  INSERT INTO public.customer_portal_slug_events (customer_id, event, slug, created_by)
  VALUES (p_customer_id, CASE WHEN v_old IS NULL THEN 'created' ELSE 'changed' END, v_slug, auth.uid());

  RETURN jsonb_build_object('slug', v_slug);
END;
$$;

COMMENT ON FUNCTION public.set_customer_portal_slug(uuid, text) IS
  'Create or change a customer''s portal address (custom slug). Office writers. Friendly errors for format and uniqueness; logs created/changed events.';

REVOKE EXECUTE ON FUNCTION public.set_customer_portal_slug(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_customer_portal_slug(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_customer_portal_slug(uuid, text) TO authenticated;

-- Lock the address on first share (called by the modal's first Copy; the
-- portal edge function also locks server-side on first public resolve).
CREATE OR REPLACE FUNCTION public.mark_customer_portal_slug_shared(
  p_customer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
  v_slug text;
BEGIN
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
    INTO v_ok;
  IF NOT COALESCE(v_ok, false) THEN
    RETURN jsonb_build_object('error', 'Not authorized to manage portal links');
  END IF;

  UPDATE public.customer_portal_slugs
  SET locked_at = now(), updated_at = now()
  WHERE customer_id = p_customer_id AND locked_at IS NULL
  RETURNING slug INTO v_slug;

  IF v_slug IS NOT NULL THEN
    INSERT INTO public.customer_portal_slug_events (customer_id, event, slug, created_by)
    VALUES (p_customer_id, 'locked', v_slug, auth.uid());
    RETURN jsonb_build_object('locked', true, 'slug', v_slug);
  END IF;
  RETURN jsonb_build_object('locked', false);
END;
$$;

COMMENT ON FUNCTION public.mark_customer_portal_slug_shared(uuid) IS
  'Set locked_at on the customer''s portal address the first time it is shared (office Copy). Idempotent; logs a locked event on the transition.';

REVOKE EXECUTE ON FUNCTION public.mark_customer_portal_slug_shared(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_customer_portal_slug_shared(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_customer_portal_slug_shared(uuid) TO authenticated;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
