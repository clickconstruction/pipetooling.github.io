SET lock_timeout = '3s';

-- Supply house directory, PR 2 (to-dos/supply-house-directory): one predicate
-- for "may this user add, edit or delete a supply house or its reps", read by
-- the write policies on supply_houses and supply_house_contacts. The client's
-- materialsTabsFor(role) kernel is the same list; keep the two in step.
--
-- Roles: the office (dev, master_technician, assistant, controller) and
-- estimator. Controller was missing from the baseline supply_houses policies
-- (the 2026-07-14 controller sweep never touched this table); primary and
-- superintendent were in them only because the baseline listed every
-- Materials reader — their only door was the Parts Book "Price coverage"
-- modal, which PR 3 reduces to price coverage. SELECT policies are unchanged:
-- every Materials reader still reads houses and reps.

CREATE OR REPLACE FUNCTION public.can_manage_supply_house_directory()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())
      AND u.role = ANY (ARRAY[
        'dev'::public.user_role,
        'master_technician'::public.user_role,
        'assistant'::public.user_role,
        'controller'::public.user_role,
        'estimator'::public.user_role
      ])
  )
$$;

COMMENT ON FUNCTION public.can_manage_supply_house_directory() IS
  'Supply house directory (v2.3167): may the current user add / edit / delete a supply house or its reps. Office roles + estimator. Mirror of the client''s materialsTabsFor(role).';

REVOKE ALL ON FUNCTION public.can_manage_supply_house_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_supply_house_directory() TO authenticated;

-- supply_houses: the three write policies point at the predicate; select stays.
DROP POLICY IF EXISTS "sup_supply_houses_insert" ON public.supply_houses;
CREATE POLICY "sup_supply_houses_insert" ON public.supply_houses
  FOR INSERT WITH CHECK (public.can_manage_supply_house_directory());

DROP POLICY IF EXISTS "sup_supply_houses_update" ON public.supply_houses;
CREATE POLICY "sup_supply_houses_update" ON public.supply_houses
  FOR UPDATE USING (public.can_manage_supply_house_directory())
  WITH CHECK (public.can_manage_supply_house_directory());

DROP POLICY IF EXISTS "sup_supply_houses_delete" ON public.supply_houses;
CREATE POLICY "sup_supply_houses_delete" ON public.supply_houses
  FOR DELETE USING (public.can_manage_supply_house_directory());

-- supply_house_contacts: same three (20260902170045 created them with the role list inline).
DROP POLICY IF EXISTS supply_house_contacts_insert_office ON public.supply_house_contacts;
CREATE POLICY supply_house_contacts_insert_office ON public.supply_house_contacts
  FOR INSERT WITH CHECK (public.can_manage_supply_house_directory());

DROP POLICY IF EXISTS supply_house_contacts_update_office ON public.supply_house_contacts;
CREATE POLICY supply_house_contacts_update_office ON public.supply_house_contacts
  FOR UPDATE USING (public.can_manage_supply_house_directory());

DROP POLICY IF EXISTS supply_house_contacts_delete_office ON public.supply_house_contacts;
CREATE POLICY supply_house_contacts_delete_office ON public.supply_house_contacts
  FOR DELETE USING (public.can_manage_supply_house_directory());
