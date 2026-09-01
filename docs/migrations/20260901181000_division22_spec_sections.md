# 20260901181000_division22_spec_sections

Division 22 ledger foundation (v2.2580). Two org-wide tables:
`spec_sections` (code PK + title; seeded with 14 MasterFormat Division 22
sections — codes outside 22 allowed, e.g. gas under 23 11 23 if specs say
so) and `spec_section_match_rules` (pattern, match_kind
starts_with/contains/exact, nullable section_code FK, priority; first
match by priority wins, NULL section = "deliberately no code"). Seeded
with 16 starter rules for the house fixture naming (exact cleanouts
before the COPPER trap, WASTE/STORM before the WATER catch-all,
DEMO → NULL). Gas fittings, GPR-, RH-, EDF- deliberately unseeded —
owner's spec-book call, they surface as unmatched. Classification is
read-time (`src/lib/classifySpecSection.ts`); no bid data touched.
RLS: bid-family roles SELECT; dev/master/assistant/controller/estimator
write. Ends with all three fence appliers.
