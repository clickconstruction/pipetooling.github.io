SET lock_timeout = '3s';

-- Hiring, the owner's scale for the trades (spike of 2026-10-23; the kernel is src/lib/hiring/tradeScale.ts). One scale
-- for everyone we may hire or use, a candidate on the Team hiring board (team_prospects) or a sub on the roster
-- (people), read per trade: 0 never done it, 1 some experience and no tools, 2 says they can run a job alone and no
-- tools, 3 says they can run a job alone and has tools. A row a trade. The license they hold, their home (where they
-- drive in from) and its pin go on the record itself. Their qualifications are noted once the three trades, the
-- license (or that they hold none) and the home are known (qualificationsMissing in tradeScale.ts).
--   * trade_levels: one row a trade for a candidate or a sub, never both, each trade once.
--   * team_prospects and people: location (the words), location_lat / location_lng (the map's pin), license (the
--     words, '' for none) and license_asked (so '' reads as none rather than unknown).

CREATE TABLE IF NOT EXISTS public.trade_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_prospect_id uuid REFERENCES public.team_prospects(id) ON DELETE CASCADE,
  person_id uuid REFERENCES public.people(id) ON DELETE CASCADE,
  trade text NOT NULL
    CONSTRAINT trade_levels_trade_known CHECK (trade IN ('plumbing', 'electrical', 'hvac')),
  level smallint NOT NULL
    CONSTRAINT trade_levels_level_on_scale CHECK (level BETWEEN 0 AND 3),
  noted_by uuid REFERENCES public.users(id) DEFAULT auth.uid(),
  noted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trade_levels_one_record CHECK ((team_prospect_id IS NULL) <> (person_id IS NULL)),
  CONSTRAINT trade_levels_once UNIQUE NULLS NOT DISTINCT (team_prospect_id, person_id, trade)
);

CREATE INDEX IF NOT EXISTS trade_levels_team_prospect_idx ON public.trade_levels (team_prospect_id) WHERE team_prospect_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS trade_levels_person_idx ON public.trade_levels (person_id) WHERE person_id IS NOT NULL;

-- Where they drive in from (the words as typed or as the map found them, and the pin when the map found it) and the
-- license they hold, on the record itself.
ALTER TABLE public.team_prospects
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS location_lat double precision,
  ADD COLUMN IF NOT EXISTS location_lng double precision,
  ADD COLUMN IF NOT EXISTS license text,
  ADD COLUMN IF NOT EXISTS license_asked boolean NOT NULL DEFAULT false;

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS location_lat double precision,
  ADD COLUMN IF NOT EXISTS location_lng double precision,
  ADD COLUMN IF NOT EXISTS license text,
  ADD COLUMN IF NOT EXISTS license_asked boolean NOT NULL DEFAULT false;

-- Who reads and writes: Prospects staff, as the hiring board's roles allow (20260717230000_team_prospect_roles).
ALTER TABLE public.trade_levels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Prospects staff can see trade levels" ON public.trade_levels;
CREATE POLICY "Prospects staff can see trade levels" ON public.trade_levels
  FOR SELECT USING (public.user_has_prospects_staff_access());

DROP POLICY IF EXISTS "Prospects staff can insert trade levels" ON public.trade_levels;
CREATE POLICY "Prospects staff can insert trade levels" ON public.trade_levels
  FOR INSERT WITH CHECK (public.user_has_prospects_staff_access());

DROP POLICY IF EXISTS "Prospects staff can update trade levels" ON public.trade_levels;
CREATE POLICY "Prospects staff can update trade levels" ON public.trade_levels
  FOR UPDATE USING (public.user_has_prospects_staff_access())
  WITH CHECK (public.user_has_prospects_staff_access());

DROP POLICY IF EXISTS "Prospects staff can delete trade levels" ON public.trade_levels;
CREATE POLICY "Prospects staff can delete trade levels" ON public.trade_levels
  FOR DELETE USING (public.user_has_prospects_staff_access());

COMMENT ON TABLE public.trade_levels IS
  'Hiring (2026-10-23): the owner''s scale for the trades, one row a trade for a candidate (team_prospect_id) or a sub (person_id); level 0 to 3 as tradeScale.ts reads it. The license and the home sit on the record.';

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
