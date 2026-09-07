SET lock_timeout = '3s';

-- v2.3067 — my_sub_portal_address(): a signed-in sub or helper reaches their own statement.
--
-- Journey map SP-2 (customer-portal-visit.md, Tier 5 P1 walk 2026-09-06): a sub with a login who
-- opened /sub from inside the app got "This link is missing its key" and their Job Mode Dashboard
-- had no door to the portal — the texted link was the only way in. sub_portal_links / _slugs are
-- office-read (RLS), so the door needs a SECURITY DEFINER read that answers ONLY for the caller's
-- own roster row: people.account_user_id = auth.uid(), kind sub / helper, one active link.
-- Returns {slug, token} — slug first (the short address), the raw token only where the link still
-- stores it (hash-only links answer with the slug or nothing). Never mints; a turned-off portal
-- stays off. No anonymous consumer → revoked from PUBLIC and anon (v2.2954 rule).

CREATE OR REPLACE FUNCTION public.my_sub_portal_address()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'slug', (SELECT s.slug FROM public.sub_portal_slugs s WHERE s.person_id = p.id),
    'token', l.token
  )
  FROM public.people p
  JOIN public.sub_portal_links l ON l.person_id = p.id AND l.revoked_at IS NULL
  WHERE p.account_user_id = auth.uid()
    AND p.archived_at IS NULL
    AND p.kind IN ('sub', 'helper')
  ORDER BY l.created_at DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.my_sub_portal_address() IS
  'The signed-in sub/helper''s own portal address (v2.3067, SP-2): {slug, token} for their active sub_portal_links row, or NULL when they have no roster row, no link, or the portal is off. Never mints.';

REVOKE EXECUTE ON FUNCTION public.my_sub_portal_address() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_sub_portal_address() TO authenticated, service_role;
