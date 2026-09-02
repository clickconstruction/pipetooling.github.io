SET lock_timeout = '3s';

-- Sub portal links (sub-portal train, PR 1): the customer portal's link spine,
-- person-keyed. One private capability link per roster person (people.id) that
-- opens their Work & Pay statement — no login, revocation is the kill switch.
--
-- Mirrors customer_portal_links/_slugs/_slug_events column-for-column minus
-- audiences (a sub has exactly one view). Slugs share the printed
-- my.clickplumbing.com namespace with customer slugs: uniqueness is enforced
-- ACROSS both tables (each set_* RPC checks the other), and /p/<slug>
-- dual-resolves client-side (customer first, then sub).

CREATE TABLE IF NOT EXISTS public.sub_portal_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  token text,
  token_hash text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

COMMENT ON TABLE public.sub_portal_links IS
  'Private no-login portal links for subcontractors (person-keyed). The raw token is the capability; revoked_at is the only kill switch (no expiry).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_portal_links_active
  ON public.sub_portal_links (person_id)
  WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_portal_links_token
  ON public.sub_portal_links (token)
  WHERE token IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.sub_portal_slugs (
  person_id uuid PRIMARY KEY REFERENCES public.people(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
  locked_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sub_portal_slugs IS
  'Custom portal address per sub (my.clickplumbing.com/<slug>). Shares the printed namespace with customer_portal_slugs — the set RPCs enforce uniqueness across both. Survives token rotation; locked_at set on first share.';

CREATE TABLE IF NOT EXISTS public.sub_portal_slug_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('created', 'changed', 'locked')),
  slug text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.sub_portal_slug_events IS
  'Append-only history of sub portal-address changes (created / changed / locked), shown in the sub globe modal''s History row.';

CREATE INDEX IF NOT EXISTS idx_sub_portal_slug_events_person
  ON public.sub_portal_slug_events (person_id, created_at DESC);

ALTER TABLE public.sub_portal_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_portal_slugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sub_portal_slug_events ENABLE ROW LEVEL SECURITY;

-- Office-readable (feeds the red-off globe state and the modal); all writes
-- go through the SECURITY DEFINER RPCs below or the service-role edge fn.
DROP POLICY IF EXISTS "Office can read sub portal links" ON public.sub_portal_links;
CREATE POLICY "Office can read sub portal links" ON public.sub_portal_links
  FOR SELECT USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (
         SELECT 1 FROM public.users u
         WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician'
       )
  );

DROP POLICY IF EXISTS "Office can read sub portal slugs" ON public.sub_portal_slugs;
CREATE POLICY "Office can read sub portal slugs" ON public.sub_portal_slugs
  FOR SELECT USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (
         SELECT 1 FROM public.users u
         WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician'
       )
  );

DROP POLICY IF EXISTS "Office can read sub portal slug events" ON public.sub_portal_slug_events;
CREATE POLICY "Office can read sub portal slug events" ON public.sub_portal_slug_events
  FOR SELECT USING (
    public.is_dev()
    OR public.is_assistant()
    OR EXISTS (
         SELECT 1 FROM public.users u
         WHERE u.id = (SELECT auth.uid()) AND u.role = 'master_technician'
       )
  );

GRANT SELECT ON TABLE public.sub_portal_links TO authenticated;
GRANT SELECT ON TABLE public.sub_portal_slugs TO authenticated;
GRANT SELECT ON TABLE public.sub_portal_slug_events TO authenticated;

-- Mint: returns the EXISTING active link's raw token when present (the modal
-- re-shows it); p_rotate revokes + re-mints in one transaction.
CREATE OR REPLACE FUNCTION public.mint_sub_portal_link(
  p_person_id uuid,
  p_rotate boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_ok boolean;
  v_raw text;
  v_row record;
BEGIN
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
    INTO v_ok;
  IF NOT COALESCE(v_ok, false) THEN
    RETURN jsonb_build_object('error', 'Not authorized to manage portal links');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.people p WHERE p.id = p_person_id) THEN
    RETURN jsonb_build_object('error', 'Person not found');
  END IF;

  SELECT token, created_at INTO v_row
  FROM public.sub_portal_links
  WHERE person_id = p_person_id AND revoked_at IS NULL;

  IF v_row.token IS NOT NULL AND NOT p_rotate THEN
    RETURN jsonb_build_object('token', v_row.token, 'activeSince', v_row.created_at);
  END IF;

  UPDATE public.sub_portal_links
  SET revoked_at = now()
  WHERE person_id = p_person_id AND revoked_at IS NULL;

  v_raw := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');

  INSERT INTO public.sub_portal_links (person_id, token, token_hash, created_by)
  VALUES (p_person_id, v_raw, encode(digest(v_raw, 'sha256'), 'hex'), auth.uid());

  RETURN jsonb_build_object('token', v_raw, 'activeSince', now());
END;
$$;

COMMENT ON FUNCTION public.mint_sub_portal_link(uuid, boolean) IS
  'Returns the existing active sub portal link''s raw token (or mints one); p_rotate revokes + re-mints. Office writers (dev/master/assistant-like).';

REVOKE EXECUTE ON FUNCTION public.mint_sub_portal_link(uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mint_sub_portal_link(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.mint_sub_portal_link(uuid, boolean) TO authenticated;

-- Revoke without replacement — the "Turn off portal" kill switch.
CREATE OR REPLACE FUNCTION public.revoke_sub_portal_link(
  p_person_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean;
  v_count int;
BEGIN
  SELECT public.is_dev()
      OR public.is_assistant()
      OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'master_technician')
    INTO v_ok;
  IF NOT COALESCE(v_ok, false) THEN
    RETURN jsonb_build_object('error', 'Not authorized to manage portal links');
  END IF;

  UPDATE public.sub_portal_links
  SET revoked_at = now()
  WHERE person_id = p_person_id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('revoked', v_count);
END;
$$;

COMMENT ON FUNCTION public.revoke_sub_portal_link(uuid) IS
  'Revoke the active sub portal link without replacement. Office writers.';

REVOKE EXECUTE ON FUNCTION public.revoke_sub_portal_link(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.revoke_sub_portal_link(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.revoke_sub_portal_link(uuid) TO authenticated;

-- Create or change a sub's portal address. Uniqueness spans the customer
-- namespace too — one printed domain, one namespace.
CREATE OR REPLACE FUNCTION public.set_sub_portal_slug(
  p_person_id uuid,
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
  IF NOT EXISTS (SELECT 1 FROM public.people p WHERE p.id = p_person_id) THEN
    RETURN jsonb_build_object('error', 'Person not found');
  END IF;

  v_slug := lower(trim(coalesce(p_slug, '')));
  IF v_slug !~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$' THEN
    RETURN jsonb_build_object('error', 'Addresses are 3-60 characters: letters, numbers, and dashes.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.customer_portal_slugs s WHERE s.slug = v_slug) THEN
    RETURN jsonb_build_object('error', 'That address is taken — try another.');
  END IF;

  SELECT slug INTO v_old FROM public.sub_portal_slugs WHERE person_id = p_person_id;
  IF v_old = v_slug THEN
    RETURN jsonb_build_object('slug', v_slug, 'unchanged', true);
  END IF;

  BEGIN
    INSERT INTO public.sub_portal_slugs (person_id, slug, created_by)
    VALUES (p_person_id, v_slug, auth.uid())
    ON CONFLICT (person_id)
    DO UPDATE SET slug = EXCLUDED.slug, updated_at = now();
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('error', 'That address is taken — try another.');
  END;

  INSERT INTO public.sub_portal_slug_events (person_id, event, slug, created_by)
  VALUES (p_person_id, CASE WHEN v_old IS NULL THEN 'created' ELSE 'changed' END, v_slug, auth.uid());

  RETURN jsonb_build_object('slug', v_slug);
END;
$$;

COMMENT ON FUNCTION public.set_sub_portal_slug(uuid, text) IS
  'Create or change a sub''s portal address. Office writers. Uniqueness enforced across sub AND customer slug namespaces; friendly errors; logs created/changed events.';

REVOKE EXECUTE ON FUNCTION public.set_sub_portal_slug(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_sub_portal_slug(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_sub_portal_slug(uuid, text) TO authenticated;

-- Lock on first share (modal Copy; the edge fn also locks on first public
-- resolve).
CREATE OR REPLACE FUNCTION public.mark_sub_portal_slug_shared(
  p_person_id uuid
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

  UPDATE public.sub_portal_slugs
  SET locked_at = now(), updated_at = now()
  WHERE person_id = p_person_id AND locked_at IS NULL
  RETURNING slug INTO v_slug;

  IF v_slug IS NOT NULL THEN
    INSERT INTO public.sub_portal_slug_events (person_id, event, slug, created_by)
    VALUES (p_person_id, 'locked', v_slug, auth.uid());
    RETURN jsonb_build_object('locked', true, 'slug', v_slug);
  END IF;
  RETURN jsonb_build_object('locked', false);
END;
$$;

COMMENT ON FUNCTION public.mark_sub_portal_slug_shared(uuid) IS
  'Set locked_at on the sub''s portal address the first time it is shared. Idempotent; logs a locked event on the transition.';

REVOKE EXECUTE ON FUNCTION public.mark_sub_portal_slug_shared(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_sub_portal_slug_shared(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_sub_portal_slug_shared(uuid) TO authenticated;

-- The customer-side slug RPC learns the shared namespace: body copied from
-- its defining migration (20260821234000, unchanged since) + the sub-table
-- uniqueness check. Never rebuilt from the baseline.
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

  IF EXISTS (SELECT 1 FROM public.sub_portal_slugs s WHERE s.slug = v_slug) THEN
    RETURN jsonb_build_object('error', 'That address is taken — try another.');
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
  'Create or change a customer''s portal address (custom slug). Office writers. Friendly errors for format and uniqueness (checked across the sub slug namespace too); logs created/changed events.';

-- The sub portal is a counted public surface.
ALTER TABLE public.public_page_views
  DROP CONSTRAINT IF EXISTS public_page_views_surface_check;
ALTER TABLE public.public_page_views
  ADD CONSTRAINT public_page_views_surface_check
  CHECK (surface IN ('portal', 'estimate_terms', 'contract_accept', 'hazmat_notice', 'sub_portal'));

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
