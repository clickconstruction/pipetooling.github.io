-- Dispatch PO "Other" buckets (v2.955): company-wide demotion flags for the
-- Dispatch Mode PO tab's For (people) and Supply house pickers. A row means
-- "this option lives under the Other entry at the end of the list". Any
-- authenticated user can move items in or out (insert/delete only — no
-- updates, no data loss; moving back is the undo).

CREATE TABLE IF NOT EXISTS public.dispatch_po_other_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('for_person', 'supply_house')),
  item_id uuid NOT NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (kind, item_id)
);

COMMENT ON TABLE public.dispatch_po_other_items IS 'Dispatch Mode PO pickers (v2.955): options demoted to the "Other" bucket (kind = for_person → users.id, supply_house → supply_houses.id). Company-wide; any authenticated user may add/remove.';

ALTER TABLE public.dispatch_po_other_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read dispatch po other items" ON public.dispatch_po_other_items;
CREATE POLICY "Authenticated read dispatch po other items" ON public.dispatch_po_other_items
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated insert dispatch po other items" ON public.dispatch_po_other_items;
CREATE POLICY "Authenticated insert dispatch po other items" ON public.dispatch_po_other_items
  FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated delete dispatch po other items" ON public.dispatch_po_other_items;
CREATE POLICY "Authenticated delete dispatch po other items" ON public.dispatch_po_other_items
  FOR DELETE USING ((SELECT auth.uid()) IS NOT NULL);

-- Training-mode write blocks (required for every CREATE TABLE — see CLAUDE.md).
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
