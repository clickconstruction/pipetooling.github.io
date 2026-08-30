# 20260830210000_robot_price_research.sql — Robot price research (v2.2515, 2026-08-30)

Twins may research plan-scheduled products (manufacturer + catalog #) on the web and
record findings as checkable parts + prices:

- `material_parts.is_robot` flag; fence applier v2 → v3: twins INSERT/edit robot
  parts and prices on robot parts (`material_part_prices` via parent). Everything
  else unchanged from v2.
- Owner rule baked into doctrine: **`material_parts.link` = source URL, mandatory**
  — one click to verify any researched price.
- Seeds the `🤖 Web Research` supply house; researched prices attribute there,
  never to a real supplier.
