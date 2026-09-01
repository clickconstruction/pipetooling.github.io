SET lock_timeout = '3s';

-- Division 22 ledger (owner request 2026-09-01, design canvas "Division 22 Ledger"):
-- spec-section codes for fixture lists sent to parts/supply houses. Two tables:
--   * spec_sections — the section catalog (MasterFormat Division 22, seeded below;
--     codes outside 22 are allowed — e.g. gas piping under 23 11 23 if specs say so).
--   * spec_section_match_rules — pattern rules that classify a fixture NAME to a
--     section at read time (first match by priority wins). No bid data is touched:
--     rules classify every historical and future count row. A NULL section_code rule
--     means "deliberately no code" (e.g. DEMO) so audits can tell it from unmatched.
-- Seeds cover only the confident house naming (WC-, L-, WASTE, WATER, cleanouts…).
-- Deliberately NOT seeded, pending the owner's spec-book call: gas fittings, GPR-,
-- RH-, EDF- — they surface as unmatched until pinned.

CREATE TABLE IF NOT EXISTS public.spec_sections (
  code text PRIMARY KEY,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.spec_section_match_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern text NOT NULL,
  match_kind text NOT NULL CHECK (match_kind = ANY (ARRAY['starts_with'::text, 'contains'::text, 'exact'::text])),
  section_code text REFERENCES public.spec_sections(code) ON UPDATE CASCADE ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 1000,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS spec_section_match_rules_priority_idx
  ON public.spec_section_match_rules (priority, created_at);

ALTER TABLE public.spec_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spec_section_match_rules ENABLE ROW LEVEL SECURITY;

-- Read: every staff role that can see bids. Write: the roles that can share pricing
-- (mirrors canPackageAndSendBidPricing — dev, master, assistant-like, estimator).
DROP POLICY IF EXISTS "Bid users can read spec_sections" ON public.spec_sections;
CREATE POLICY "Bid users can read spec_sections" ON public.spec_sections FOR SELECT
  USING (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role])));
DROP POLICY IF EXISTS "Pricing sharers can write spec_sections" ON public.spec_sections;
CREATE POLICY "Pricing sharers can write spec_sections" ON public.spec_sections FOR ALL
  USING (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])))
  WITH CHECK (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])));

DROP POLICY IF EXISTS "Bid users can read spec_section_match_rules" ON public.spec_section_match_rules;
CREATE POLICY "Bid users can read spec_section_match_rules" ON public.spec_section_match_rules FOR SELECT
  USING (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role, 'primary'::public.user_role, 'superintendent'::public.user_role])));
DROP POLICY IF EXISTS "Pricing sharers can write spec_section_match_rules" ON public.spec_section_match_rules;
CREATE POLICY "Pricing sharers can write spec_section_match_rules" ON public.spec_section_match_rules FOR ALL
  USING (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])))
  WITH CHECK (EXISTS ( SELECT 1 FROM public.users
    WHERE users.id = ( SELECT auth.uid() ) AND users.role = ANY (ARRAY['dev'::public.user_role, 'master_technician'::public.user_role, 'assistant'::public.user_role, 'controller'::public.user_role, 'estimator'::public.user_role])));

-- Section catalog seed (MasterFormat Division 22; verify titles against the spec
-- books in use — see docs/migrations fragment).
INSERT INTO public.spec_sections (code, title) VALUES
  ('22 05 76', 'Facility Drainage Piping Cleanouts'),
  ('22 07 19', 'Plumbing Piping Insulation'),
  ('22 11 16', 'Domestic Water Piping'),
  ('22 11 19', 'Domestic Water Piping Specialties'),
  ('22 13 16', 'Sanitary Waste and Vent Piping'),
  ('22 13 19', 'Sanitary Waste Piping Specialties'),
  ('22 14 13', 'Facility Storm Drainage Piping'),
  ('22 33 00', 'Electric Domestic Water Heaters'),
  ('22 34 00', 'Fuel-Fired Domestic Water Heaters'),
  ('22 42 13', 'Commercial Water Closets and Urinals'),
  ('22 42 16', 'Commercial Lavatories and Sinks'),
  ('22 42 23', 'Commercial Showers and Bathtubs'),
  ('22 45 00', 'Emergency Plumbing Fixtures'),
  ('22 47 00', 'Drinking Fountains and Water Coolers')
ON CONFLICT (code) DO NOTHING;

-- Starter rules for the house fixture naming. Priority gaps of 10 leave room to
-- slot rules between. Order matters: exact cleanouts first (so "CO" never grabs
-- "COPPER"), WASTE/STORM before the broad WATER catch-all.
INSERT INTO public.spec_section_match_rules (pattern, match_kind, section_code, priority)
SELECT v.pattern, v.match_kind, v.section_code, v.priority
FROM (VALUES
  ('GCO',   'exact',       '22 05 76', 10),
  ('FCO',   'exact',       '22 05 76', 20),
  ('WCO',   'exact',       '22 05 76', 30),
  ('CO',    'exact',       '22 05 76', 40),
  ('DEMO',  'exact',       NULL,       50),
  ('WC-',   'starts_with', '22 42 13', 100),
  ('U-',    'starts_with', '22 42 13', 110),
  ('L-',    'starts_with', '22 42 16', 120),
  ('SH-',   'starts_with', '22 42 23', 130),
  ('FS-',   'starts_with', '22 13 19', 140),
  ('FD-',   'contains',    '22 13 19', 150),
  ('TP-',   'starts_with', '22 11 19', 160),
  ('WH-',   'starts_with', '22 33 00', 170),
  ('WASTE', 'contains',    '22 13 16', 200),
  ('STORM', 'contains',    '22 14 13', 210),
  ('WATER', 'contains',    '22 11 16', 220)
) AS v(pattern, match_kind, section_code, priority)
WHERE NOT EXISTS (
  SELECT 1 FROM public.spec_section_match_rules r
  WHERE r.pattern = v.pattern AND r.match_kind = v.match_kind
);

-- House rules: read-only training mode + twin write fence cover every new table.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
