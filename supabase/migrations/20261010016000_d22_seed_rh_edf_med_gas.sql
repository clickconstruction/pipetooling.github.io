SET lock_timeout = '3s';

-- Division 22 rules manager, PR 5 of the train (v2.5063; to-dos/division-22-rules-manager.md): the seed the
-- owner named on 2026-10-09, sent by Punchlist. Doc and every name it moves, before → after:
-- docs/migrations/20261010016000_d22_seed_rh_edf_med_gas.md.
--
--   EDF          → 22 47 00 Drinking Fountains and Water Coolers (the Elkay EZTL-8C on the bids decided it)
--   drench       → 22 45 00 Emergency Plumbing Fixtures (no name today; for future emergency showers)
--   RH- / hydrants → 22 11 19 Domestic Water Piping Specialties (wall and roof hydrants)
--   med gas, medical, animal gas, scavenger, oxygen, O2 → a new 22 63 00 Gas Systems for Laboratory and
--                  Healthcare Facilities
--
-- Data only, and idempotent: the section is inserted once, each update names the rule as it stands today, and a
-- new rule is skipped when one already looks for the same words the same way.

-- 1. The new section for medical gas.
INSERT INTO public.spec_sections (code, title)
VALUES ('22 63 00', 'Gas Systems for Laboratory and Healthcare Facilities')
ON CONFLICT (code) DO NOTHING;

-- 2. The four rules parked as "no code" until the med-gas ruling file under it. They already decide ahead of the
--    plain 'gas' rule (order 420): med gas 400, medical 401, animal gas 402, scavenger 190.
UPDATE public.spec_section_match_rules
SET section_code = '22 63 00', updated_at = now()
WHERE match_kind = 'contains'
  AND lower(btrim(pattern)) IN ('med gas', 'medical', 'animal gas', 'scavenger')
  AND section_code IS NULL;

-- 3. The hydrant rule decides earlier, before 'starts with WH-' (170), 'EWH' (460) and 'drain' (510), so the six
--    wall and roof hydrants those rules filed under water heaters and drains come home to 22 11 19.
UPDATE public.spec_section_match_rules
SET priority = 165, updated_at = now()
WHERE match_kind = 'contains'
  AND lower(btrim(pattern)) = 'hydrant'
  AND section_code = '22 11 19'
  AND priority = 561;

-- 4. The new rules. 'O2' is last of all (order 900): a two-letter pattern, so it files only names no other rule
--    files; 'fco2' (a cleanout) and the O2 copper line keep their rules.
INSERT INTO public.spec_section_match_rules (pattern, match_kind, section_code, priority)
SELECT v.pattern, v.match_kind, v.section_code, v.priority
FROM (VALUES
  ('RH-',    'starts_with', '22 11 19', 166),
  ('EDF',    'starts_with', '22 47 00', 177),
  ('drench', 'contains',    '22 45 00', 314),
  ('oxygen', 'contains',    '22 63 00', 406),
  ('O2',     'contains',    '22 63 00', 900)
) AS v(pattern, match_kind, section_code, priority)
WHERE NOT EXISTS (
  SELECT 1 FROM public.spec_section_match_rules r
  WHERE r.match_kind = v.match_kind AND lower(btrim(r.pattern)) = lower(btrim(v.pattern))
);
