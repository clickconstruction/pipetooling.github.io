SET lock_timeout = '3s';

-- A person reads the PO codes made for them (punch list #295, PR 2, the ticket sheet's first chip). The office makes
-- a five-digit counter code for a tech, a job and a supply house (material_po_generator_entries, for_user_id); the
-- tech reads it off a text and says it at the counter. The table was read by the office alone, so the sheet a ticket
-- opens after its photo could not offer *PO 41207, your PO code at Ridgeway Supply* as the first choice. Two read
-- policies, both narrow:
--
--   1. material_po_generator_entries: a row is also read by the person it was made for.
--   2. supply_houses: a house is also read by a person a PO code names it for, so the chip can say the house's name.
--      Nothing else about the house is on the sheet, and a house no code of theirs names stays closed to them.
--
-- Additive and idempotent: no table is created, so no fence call is owed. Policies only, so a client on either side of
-- the Pages deploy is unharmed: before the push the read answers no rows and the sheet offers the clocked job first.

DROP POLICY IF EXISTS material_po_generator_entries_select_for_its_person ON public.material_po_generator_entries;
CREATE POLICY material_po_generator_entries_select_for_its_person ON public.material_po_generator_entries
  FOR SELECT TO authenticated
  USING (for_user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS supply_houses_select_by_my_po_code ON public.supply_houses;
CREATE POLICY supply_houses_select_by_my_po_code ON public.supply_houses
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.material_po_generator_entries e
    WHERE e.supply_house_id = supply_houses.id AND e.for_user_id = (SELECT auth.uid())
  ));
