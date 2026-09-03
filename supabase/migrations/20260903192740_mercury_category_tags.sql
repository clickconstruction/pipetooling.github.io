SET lock_timeout = '3s';

-- Bank-category tags (Banking → Accounting → Tags; 2026-09-03, v2.2714).
--
-- A tag is a name, an icon and a color plus two kinds of members: the
-- Mercury bank categories it covers (`FuelAndGas`, `Retail`, …) and the
-- accounting labels it stands for (`mercury_drag_sort_labels`). Accounting
-- label rules can point at a tag (criteria `bankTag`), and surfaces that split
-- card spend (People → Review, Jobs → Job Summary) can draw a tag as its own
-- cost line (`show_as_cost_line`). Seeded once per org with six families that
-- mirror `src/lib/banking/categoryTags.ts` — keep the two lists identical.

CREATE TABLE IF NOT EXISTS public.mercury_category_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL DEFAULT '🏷',
  color text NOT NULL DEFAULT 'gray',
  sort_order integer NOT NULL DEFAULT 0,
  default_key text,
  show_as_cost_line boolean NOT NULL DEFAULT false,
  hide_from_picker boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT mercury_category_tags_name_chk CHECK (char_length(btrim(name)) >= 1 AND char_length(name) <= 60),
  CONSTRAINT mercury_category_tags_icon_chk CHECK (char_length(icon) BETWEEN 1 AND 8),
  CONSTRAINT mercury_category_tags_color_chk CHECK (color IN ('amber', 'blue', 'violet', 'teal', 'gray', 'rose')),
  CONSTRAINT mercury_category_tags_default_key_chk CHECK (default_key IS NULL OR (char_length(default_key) BETWEEN 1 AND 64))
);

CREATE UNIQUE INDEX IF NOT EXISTS mercury_category_tags_default_key_uidx
  ON public.mercury_category_tags (default_key) WHERE default_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS mercury_category_tags_sort_order_idx
  ON public.mercury_category_tags (sort_order, id);

COMMENT ON TABLE public.mercury_category_tags IS
  'Bank-category tags: a name/icon/color grouping of Mercury bank categories and accounting labels. Rules reference tags via criteria.bankTag; show_as_cost_line draws the tag as its own cost line on Review / Job Summary.';

CREATE TABLE IF NOT EXISTS public.mercury_category_tag_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id uuid NOT NULL REFERENCES public.mercury_category_tags(id) ON DELETE CASCADE,
  bank_category text,
  label_id uuid REFERENCES public.mercury_drag_sort_labels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mercury_category_tag_members_one_kind_chk CHECK (
    (bank_category IS NOT NULL AND label_id IS NULL) OR (bank_category IS NULL AND label_id IS NOT NULL)
  ),
  CONSTRAINT mercury_category_tag_members_bank_category_chk CHECK (
    bank_category IS NULL OR (char_length(btrim(bank_category)) BETWEEN 1 AND 80)
  )
);

-- A bank category / label belongs to at most ONE tag, so a cost line never
-- counts a purchase twice.
CREATE UNIQUE INDEX IF NOT EXISTS mercury_category_tag_members_bank_category_uidx
  ON public.mercury_category_tag_members (lower(bank_category)) WHERE bank_category IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mercury_category_tag_members_label_uidx
  ON public.mercury_category_tag_members (label_id) WHERE label_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS mercury_category_tag_members_tag_idx
  ON public.mercury_category_tag_members (tag_id);

COMMENT ON TABLE public.mercury_category_tag_members IS
  'Members of a bank-category tag: exactly one of bank_category (Mercury category string) or label_id (mercury_drag_sort_labels). Each category / label is in at most one tag.';

-- RLS: the same people who manage accounting labels manage tags.
ALTER TABLE public.mercury_category_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mercury_category_tag_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_mercury_category_tags()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role])
  );
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mercury_category_tags' AND policyname = 'mercury_category_tags banking staff select') THEN
    CREATE POLICY "mercury_category_tags banking staff select" ON public.mercury_category_tags FOR SELECT TO authenticated USING (public.can_manage_mercury_category_tags());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mercury_category_tags' AND policyname = 'mercury_category_tags banking staff insert') THEN
    CREATE POLICY "mercury_category_tags banking staff insert" ON public.mercury_category_tags FOR INSERT TO authenticated WITH CHECK (public.can_manage_mercury_category_tags());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mercury_category_tags' AND policyname = 'mercury_category_tags banking staff update') THEN
    CREATE POLICY "mercury_category_tags banking staff update" ON public.mercury_category_tags FOR UPDATE TO authenticated USING (public.can_manage_mercury_category_tags()) WITH CHECK (public.can_manage_mercury_category_tags());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mercury_category_tags' AND policyname = 'mercury_category_tags banking staff delete') THEN
    CREATE POLICY "mercury_category_tags banking staff delete" ON public.mercury_category_tags FOR DELETE TO authenticated USING (public.can_manage_mercury_category_tags());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mercury_category_tag_members' AND policyname = 'mercury_category_tag_members banking staff select') THEN
    CREATE POLICY "mercury_category_tag_members banking staff select" ON public.mercury_category_tag_members FOR SELECT TO authenticated USING (public.can_manage_mercury_category_tags());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mercury_category_tag_members' AND policyname = 'mercury_category_tag_members banking staff insert') THEN
    CREATE POLICY "mercury_category_tag_members banking staff insert" ON public.mercury_category_tag_members FOR INSERT TO authenticated WITH CHECK (public.can_manage_mercury_category_tags());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mercury_category_tag_members' AND policyname = 'mercury_category_tag_members banking staff update') THEN
    CREATE POLICY "mercury_category_tag_members banking staff update" ON public.mercury_category_tag_members FOR UPDATE TO authenticated USING (public.can_manage_mercury_category_tags()) WITH CHECK (public.can_manage_mercury_category_tags());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'mercury_category_tag_members' AND policyname = 'mercury_category_tag_members banking staff delete') THEN
    CREATE POLICY "mercury_category_tag_members banking staff delete" ON public.mercury_category_tag_members FOR DELETE TO authenticated USING (public.can_manage_mercury_category_tags());
  END IF;
END;
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mercury_category_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mercury_category_tag_members TO authenticated;
GRANT SELECT ON public.mercury_category_tags TO service_role;
GRANT SELECT ON public.mercury_category_tag_members TO service_role;

-- Seed the six default families (idempotent on default_key; members ON
-- CONFLICT DO NOTHING so a category the owner has already moved stays put).
-- Mirrors DEFAULT_CATEGORY_TAGS in src/lib/banking/categoryTags.ts.
CREATE OR REPLACE FUNCTION public.seed_default_mercury_category_tags()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_tag_id uuid;
  v_cat text;
  v_label_key text;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('fuel_vehicle',    'Fuel & gas',        '⛽', 'amber',  0,  true,
        ARRAY['FuelAndGas','VehicleExpenses','Parking'],
        ARRAY['fuel_gas','car_truck_expenses','vehicle_maintenance_repairs']),
      ('retail_supply',   'Retail & supply',   '🛒', 'blue',   10, false,
        ARRAY['Retail','Electronics'],
        ARRAY['cogs_part_iii','supplies','job_materials_parts','shop_supplies','consumables','tools_small_equipment']),
      ('office_software', 'Office & software', '💻', 'violet', 20, false,
        ARRAY['Software','Utilities','Insurance','InternetAndTelephone','Advertising','Education','Medical'],
        ARRAY['office_expense','utilities','insurance','advertising','employee_benefits','rent_lease_20a','rent_lease_20b','repairs_maintenance']),
      ('fees_services',   'Fees & services',   '🧾', 'teal',   30, false,
        ARRAY['Fees','ProfessionalServices'],
        ARRAY['commissions_fees','legal_professional','contract_labor','bad_debts_27b']),
      ('government',      'Government',        '🏛', 'gray',   40, false,
        ARRAY['GovernmentServices','BooksAndNewspaper'],
        ARRAY['taxes_licenses']),
      ('food_travel',     'Food & travel',     '🍔', 'rose',   50, false,
        ARRAY['Restaurants','Lodging','Grocery','GroundTransportation','AlcoholAndBars'],
        ARRAY['travel','meals'])
    ) AS t(default_key, name, icon, color, sort_order, show_as_cost_line, categories, label_keys)
  LOOP
    INSERT INTO public.mercury_category_tags (name, icon, color, sort_order, default_key, show_as_cost_line)
    VALUES (r.name, r.icon, r.color, r.sort_order, r.default_key, r.show_as_cost_line)
    ON CONFLICT (default_key) WHERE default_key IS NOT NULL DO NOTHING;

    SELECT id INTO v_tag_id FROM public.mercury_category_tags WHERE default_key = r.default_key;
    IF v_tag_id IS NULL THEN CONTINUE; END IF;

    FOREACH v_cat IN ARRAY r.categories LOOP
      INSERT INTO public.mercury_category_tag_members (tag_id, bank_category)
      SELECT v_tag_id, v_cat
      WHERE NOT EXISTS (SELECT 1 FROM public.mercury_category_tag_members m WHERE lower(m.bank_category) = lower(v_cat));
    END LOOP;

    FOREACH v_label_key IN ARRAY r.label_keys LOOP
      INSERT INTO public.mercury_category_tag_members (tag_id, label_id)
      SELECT v_tag_id, l.id
      FROM public.mercury_drag_sort_labels l
      WHERE l.default_key = v_label_key
        AND NOT EXISTS (SELECT 1 FROM public.mercury_category_tag_members m WHERE m.label_id = l.id);
    END LOOP;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_default_mercury_category_tags() FROM public;
GRANT EXECUTE ON FUNCTION public.seed_default_mercury_category_tags() TO authenticated;

SELECT public.seed_default_mercury_category_tags();

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
