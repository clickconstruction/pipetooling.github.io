SET lock_timeout = '3s';

-- The gas ruling (v2.2626): owner decision 2026-09-01 — "gas goes under
-- 23 11 23" (MasterFormat Facility Natural-Gas Piping). Fills the 400–449
-- band reserved since v2.2606. Dry-run against all 3,655 distinct fixture
-- names before shipping: 237 re-file — 211 to 23 11 23 (piping/fittings,
-- footage, GPR + regulators, meters/meter sets, drops, equipment
-- connections, and the 12 gas valves the 22 05 23 catch-all was holding),
-- 26 to deliberate no-code (med gas parked pending its own ruling; gaskets,
-- welding gas, gas-charge money lines, methane/sewer-gas/fireplace repair
-- narratives). The five bare "ft of X\" G" footage names get exact pins so
-- the GW grease-waste rule is never at risk. Carves 400–408 run before the
-- broad gas rules 420+; heater names are already protected by the 175–199
-- band (v2.2624).

INSERT INTO public.spec_sections (code, title) VALUES
  ('23 11 23', 'Facility Natural-Gas Piping')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.spec_section_match_rules (pattern, match_kind, section_code, priority)
SELECT v.pattern, v.match_kind, v.section_code, v.priority
FROM (VALUES
  ('med gas',          'contains',    NULL,       400),
  ('medical',          'contains',    NULL,       401),
  ('animal gas',       'contains',    NULL,       402),
  ('gasket',           'contains',    NULL,       403),
  ('welding gas',      'contains',    NULL,       404),
  ('gas charge',       'contains',    NULL,       405),
  ('methane',          'contains',    NULL,       406),
  ('sewer gas',        'contains',    NULL,       407),
  ('fireplace',        'contains',    NULL,       408),
  ('gas',              'contains',    '23 11 23', 420),
  ('gpr',              'starts_with', '23 11 23', 421),
  ('regulator',        'contains',    '23 11 23', 422),
  ('cock',             'contains',    '23 11 23', 423),
  ('ft of 1 1/2" G',   'exact',       '23 11 23', 425),
  ('ft of 1 1/4" G',   'exact',       '23 11 23', 426),
  ('ft of 1" G',       'exact',       '23 11 23', 427),
  ('ft of 2" G',       'exact',       '23 11 23', 428),
  ('ft of 3/4" G',     'exact',       '23 11 23', 429)
) AS v(pattern, match_kind, section_code, priority)
WHERE NOT EXISTS (
  SELECT 1 FROM public.spec_section_match_rules r
  WHERE r.pattern = v.pattern AND r.match_kind = v.match_kind
);
