# 20260902015631_division22_rule_corrections

Division 22 verification-sweep corrections (v2.2624). Data-only: seeds
3 sections (22 14 26 Facility Storm Drains, 22 31 00 Domestic Water
Softeners, 22 32 00 Domestic Water Filtration Equipment), inserts 32
carve/route rules (heater band 175–199 ahead of the seeded WATER rule;
storm drains 300s; misc carves), deletes the over-broad `contains hose`
rule, converts `our ` to starts_with, and moves `wash` to priority 640
(after the fixture rules). 157 of 3,655 distinct fixture names re-file;
diff dry-run pre-ship and spot-verified live post-apply. Idempotent.
