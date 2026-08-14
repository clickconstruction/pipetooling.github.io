SET lock_timeout = '3s';

-- Motor pool (Vehicles fleet phase 6): a vehicle can be handed to the "motor
-- pool" — deliberately parked, no one using it — as opposed to Unassigned
-- (never tracked / unknown). Modeled as a vehicle_possessions row with NO
-- person: user_id becomes nullable; NULL = the motor pool holds it. Every
-- other consumer of this table filters by a specific user_id (Dashboard My
-- Vehicle card, payroll vehicle lookups, holds_vehicle() RLS), so pool rows
-- are invisible to them. Metadata-only change; idempotent.

ALTER TABLE public.vehicle_possessions ALTER COLUMN user_id DROP NOT NULL;

COMMENT ON TABLE public.vehicle_possessions IS
  'User assigned to vehicle. end_date NULL = still in possession. user_id NULL = parked in the motor pool (deliberately held by no one — distinct from having no open possession at all, which renders as Unassigned).';
