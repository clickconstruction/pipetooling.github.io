SET lock_timeout = '3s';

-- Sold in sticks — PR 1: the minimum-order rule.
--
-- Pipe comes in sticks (20 ft copper, 20 ft PVC, 21 ft black iron) and PEX in
-- 100 ft coils. A takeoff that needs 105 ft buys 120 ft, and the bid should
-- know it. The rule lives on the PART TYPE (six entries cover the catalog),
-- a part can override it (a 10 ft stick, a coil), and a takeoff line
-- SNAPSHOTS the effective value when the part is picked — exactly as the
-- line snapshots unit_price — so setting "20 ft" on copper next month never
-- re-costs a bid sent in June. Lines created before the rule carry NULL and
-- never round.
--
-- order_increment: the pack size in the part's own unit (20 = 20 ft, 100 = a
-- 100 ft coil, 10 = a box of 10). order_increment_unit: how it is sold —
-- 'ft_stick' | 'ft_coil' | 'box' | 'bundle' (the client's
-- src/lib/materials/orderIncrement.ts is the one reader).
--
-- Additive and idempotent; no CREATE TABLE, so no read-only-block calls;
-- each table's existing RLS governs writes.

ALTER TABLE public.part_types
  ADD COLUMN IF NOT EXISTS order_increment numeric(12,4),
  ADD COLUMN IF NOT EXISTS order_increment_unit text;

ALTER TABLE public.material_parts
  ADD COLUMN IF NOT EXISTS order_increment numeric(12,4),
  ADD COLUMN IF NOT EXISTS order_increment_unit text;

ALTER TABLE public.bids_takeoff_rough_part_lines
  ADD COLUMN IF NOT EXISTS order_increment numeric(12,4),
  ADD COLUMN IF NOT EXISTS order_increment_unit text;

COMMENT ON COLUMN public.part_types.order_increment IS 'Sold in: the pack size every part of this type rounds up to (20 = 20 ft sticks); NULL = sold by the each. A part''s own order_increment overrides it.';
COMMENT ON COLUMN public.material_parts.order_increment IS 'Sold in: this part''s pack size, overriding its type; NULL = inherit the type''s rule.';
COMMENT ON COLUMN public.bids_takeoff_rough_part_lines.order_increment IS 'Snapshot of the part''s effective Sold in rule when the part was picked (like unit_price); NULL = the line never rounds.';
