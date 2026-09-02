# 20260901220520_division22_green_rules

Division 22 green rule set (v2.2606) — data-only. Seeds 3 sections
(22 05 23 General-Duty Valves, 22 11 23 Domestic Water Pumps, 22 13 23
Sanitary Waste Interceptors) and ~130 owner-approved match rules for the
historic fixture naming, incl. 17 deliberate no-code rules (NULL
section). Priorities: 62–98 carve-outs (CWV/Floor Sink/Tubular/FS),
**400–449 reserved for the pending gas-family decision**, 450–627
specific groups, 700 Valve catch-all, 800+ broad water patterns.
Idempotent (ON CONFLICT / WHERE NOT EXISTS). Verified against the full
uncoded-name list pre-ship; live coverage moved 24% → 73%.
