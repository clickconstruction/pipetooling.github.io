SET lock_timeout = '3s';

-- Division 22 rule corrections (v2.2624): owner-requested verification sweep of
-- every rule against the FULL 3,655-name universe (the green rules were only
-- dry-run against the capped top-1,000). 157 names re-file; every change was
-- dry-run and spot-verified before this migration was cut. Highlights:
--   * Heater/equipment names containing the word "water" were stolen by the
--     seeded WATER rule (priority 220) — "EWH-1 Electric Water Heater" filed as
--     PIPING. A 175–199 carve band now routes water heaters, softeners,
--     filters, coolers/fountains, and water meters first.
--   * Roof/overflow/scupper drains filed under sanitary 22 13 19 → new section
--     22 14 26 Facility Storm Drains (resolves Decision Sheet amber #6).
--   * contains "our " no-coded "Pour Back" and labor-hour lines via "hour "
--     → becomes starts_with.
--   * contains "hose" claimed air-hose reels and medical hose kits → deleted;
--     narrow hosebib/hose-drop rules replace it.
--   * "wash" ran before "sink"/"urinal" and stole wash sinks, the washdown
--     urinal, and Eyewash → moved after the fixture rules (priority 640), with
--     an "eyewash" rule and a hardware-"washers" no-code carve.
--   * Misc: flush valves → water closets; Reduced Pressure Zone → backflow;
--     Schier sample wells/ports → interceptors; stub-outs → water piping;
--     "demo …" narratives, tubes/sealants, juice machines, sand, scavenger
--     (med-gas family, parked) → deliberate no-code.

INSERT INTO public.spec_sections (code, title) VALUES
  ('22 14 26', 'Facility Storm Drains'),
  ('22 31 00', 'Domestic Water Softeners'),
  ('22 32 00', 'Domestic Water Filtration Equipment')
ON CONFLICT (code) DO NOTHING;

-- Rule edits (idempotent by current shape):
DELETE FROM public.spec_section_match_rules
  WHERE pattern = 'hose' AND match_kind = 'contains';
UPDATE public.spec_section_match_rules
  SET match_kind = 'starts_with'
  WHERE pattern = 'our ' AND match_kind = 'contains';
UPDATE public.spec_section_match_rules
  SET priority = 640
  WHERE pattern = 'wash' AND match_kind = 'contains' AND priority = 556;

INSERT INTO public.spec_section_match_rules (pattern, match_kind, section_code, priority)
SELECT v.pattern, v.match_kind, v.section_code, v.priority
FROM (VALUES
  ('gas water heater',  'contains',    '22 34 00', 175),
  ('GFWH',              'contains',    '22 34 00', 176),
  ('tankless',          'contains',    '22 34 00', 177),
  ('water heater',      'contains',    '22 33 00', 178),
  ('water softener',    'contains',    '22 31 00', 180),
  ('water filter',      'contains',    '22 32 00', 182),
  ('filtered water',    'contains',    '22 32 00', 183),
  ('water cooler',      'contains',    '22 47 00', 185),
  ('water fountain',    'contains',    '22 47 00', 186),
  ('water meter',       'contains',    '22 11 19', 188),
  ('irrigation meter',  'contains',    '22 11 19', 189),
  ('scavenger',         'contains',    NULL,       190),
  ('roof drain',        'contains',    '22 14 26', 300),
  ('overflow',          'contains',    '22 14 26', 301),
  ('scupper',           'contains',    '22 14 26', 302),
  ('RD-',               'starts_with', '22 14 26', 303),
  ('eyewash',           'contains',    '22 45 00', 315),
  ('flush valve',       'contains',    '22 42 13', 320),
  ('pressure zone',     'contains',    '22 11 19', 321),
  ('juice',             'contains',    NULL,       325),
  ('schier sv',         'contains',    '22 13 23', 326),
  ('sample well',       'contains',    '22 13 23', 327),
  ('sampling port',     'contains',    '22 13 23', 328),
  ('stub out',          'contains',    '22 11 16', 330),
  ('tubes',             'contains',    NULL,       331),
  ('washers',           'contains',    NULL,       335),
  ('hydrant',           'contains',    '22 11 19', 340),
  ('hosebib',           'contains',    '22 11 19', 342),
  ('hose drop',         'contains',    '22 11 19', 343),
  ('demo ',             'starts_with', NULL,       345),
  ('sand ',             'contains',    NULL,       455),
  ('laundry tub',       'contains',    '22 42 16', 575)
) AS v(pattern, match_kind, section_code, priority)
WHERE NOT EXISTS (
  SELECT 1 FROM public.spec_section_match_rules r
  WHERE r.pattern = v.pattern AND r.match_kind = v.match_kind
);
