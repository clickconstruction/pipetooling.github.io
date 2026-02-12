-- Counts Fixtures: configurable quick-select groups for adding count rows in Bids
-- Each service type (Plumbing, Electrical, HVAC) can have its own groups and fixture names

-- ============================================================================
-- counts_fixture_groups table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.counts_fixture_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type_id UUID NOT NULL REFERENCES public.service_types(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counts_fixture_groups_service_type_id
  ON public.counts_fixture_groups(service_type_id);

-- ============================================================================
-- counts_fixture_group_items table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.counts_fixture_group_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.counts_fixture_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sequence_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counts_fixture_group_items_group_id
  ON public.counts_fixture_group_items(group_id);

-- RLS
ALTER TABLE public.counts_fixture_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counts_fixture_group_items ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read
CREATE POLICY "All authenticated users can read counts_fixture_groups"
ON public.counts_fixture_groups FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can read counts_fixture_group_items"
ON public.counts_fixture_group_items FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only devs can insert/update/delete
CREATE POLICY "Devs can manage counts_fixture_groups"
ON public.counts_fixture_groups FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'dev'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'dev'
  )
);

CREATE POLICY "Devs can manage counts_fixture_group_items"
ON public.counts_fixture_group_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'dev'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'dev'
  )
);

-- Updated_at triggers
CREATE TRIGGER update_counts_fixture_groups_updated_at
  BEFORE UPDATE ON public.counts_fixture_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_counts_fixture_group_items_updated_at
  BEFORE UPDATE ON public.counts_fixture_group_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.counts_fixture_groups IS 'Quick-select groups for Counts (e.g. Bathrooms, Kitchen). One set per service type.';
COMMENT ON TABLE public.counts_fixture_group_items IS 'Fixture names within a counts fixture group (e.g. Toilets, Bathroom sinks).';

-- ============================================================================
-- Seed Plumbing counts fixtures (from hardcoded Bids.tsx fixtureGroups)
-- ============================================================================

DO $$
DECLARE
  plumbing_id UUID;
  grp_bath UUID;
  grp_kitchen UUID;
  grp_laundry UUID;
  grp_plumbing UUID;
  grp_appliances UUID;
BEGIN
  SELECT id INTO plumbing_id FROM public.service_types WHERE name = 'Plumbing' LIMIT 1;
  IF plumbing_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.counts_fixture_groups (service_type_id, label, sequence_order)
  VALUES (plumbing_id, 'Bathrooms:', 1)
  RETURNING id INTO grp_bath;

  INSERT INTO public.counts_fixture_group_items (group_id, name, sequence_order)
  VALUES
    (grp_bath, 'Toilets', 1),
    (grp_bath, 'Bathroom sinks', 2),
    (grp_bath, 'Shower/tub combos', 3),
    (grp_bath, 'Showers no tub', 4),
    (grp_bath, 'Bathtubs', 5),
    (grp_bath, 'Urinals', 6),
    (grp_bath, 'Water closets', 7);

  INSERT INTO public.counts_fixture_groups (service_type_id, label, sequence_order)
  VALUES (plumbing_id, 'Kitchen:', 2)
  RETURNING id INTO grp_kitchen;

  INSERT INTO public.counts_fixture_group_items (group_id, name, sequence_order)
  VALUES
    (grp_kitchen, 'Kitchen sinks', 1),
    (grp_kitchen, 'Garbage disposals', 2),
    (grp_kitchen, 'Ice makers', 3),
    (grp_kitchen, 'Pot filler', 4);

  INSERT INTO public.counts_fixture_groups (service_type_id, label, sequence_order)
  VALUES (plumbing_id, 'Laundry:', 3)
  RETURNING id INTO grp_laundry;

  INSERT INTO public.counts_fixture_group_items (group_id, name, sequence_order)
  VALUES
    (grp_laundry, 'Laundry sinks', 1),
    (grp_laundry, 'Washing machine', 2);

  INSERT INTO public.counts_fixture_groups (service_type_id, label, sequence_order)
  VALUES (plumbing_id, 'Plumbing Fixtures:', 4)
  RETURNING id INTO grp_plumbing;

  INSERT INTO public.counts_fixture_group_items (group_id, name, sequence_order)
  VALUES
    (grp_plumbing, 'Hose bibs', 1),
    (grp_plumbing, 'Water fountain', 2),
    (grp_plumbing, 'Gas drops', 3),
    (grp_plumbing, 'Floor drains', 4),
    (grp_plumbing, 'Dog wash', 5);

  INSERT INTO public.counts_fixture_groups (service_type_id, label, sequence_order)
  VALUES (plumbing_id, 'Appliances:', 5)
  RETURNING id INTO grp_appliances;

  INSERT INTO public.counts_fixture_group_items (group_id, name, sequence_order)
  VALUES
    (grp_appliances, 'Water heaters (gas)', 1),
    (grp_appliances, 'Water heaters (electric)', 2),
    (grp_appliances, 'Water heaters (tankless)', 3),
    (grp_appliances, 'Water softener', 4);
END $$;
