SET lock_timeout = '3s';

-- State roll, the ground (punch list #411, step one). Taunya cannot find experienced plumbers, and they must be
-- licensed. The state publishes who holds a license: the Texas State Board of Plumbing Examiners as free files, the
-- Texas Department of Licensing and Regulation on its open list. A weekly pull keeps the rows of our counties here,
-- so a person can see who was newly licensed, who stepped up and whose license lapsed, and so our own people's and
-- subs' licenses can be checked against the state's.
--
-- Five tables. Nothing here reads the state: the pull is an edge function of its own (license-roll-pull), which
-- writes with the service key. Nobody signed in writes a roll row.
--
--   license_roll            one row a license, as the state's file has it today. A person who holds two ranks is
--                           two rows; name_key (last name, first name, middle initial and ZIP) is what joins them.
--                           A row is kept because the person lives in one of our counties, or because the number is
--                           one of our own people's (ours).
--   license_roll_changes    what a pull saw change on a row. The state keeps no history, so this is the only one,
--                           and it starts on the day of our first pull. It only grows.
--   license_roll_pulls      the ledger: one row a file read, with what it saw and kept.
--   license_roll_counties   the counties whose rows are kept. Seeded with the five the permits cover.
--   license_roll_left_off   a person who asked not to be listed. Kept by number and by name_key, so a new rank's
--                           new number does not bring them back. The pull keeps no row that matches one.
--
-- The state gives no phone, street address or email for a person (Tex. Gov't Code § 552.11765), and none is kept
-- here. A responsible master plumber's row carries the company and the day the insurance on file with the board
-- ends; its business address and phone are not kept.
--
-- Who reads: the people who hold the Hiring switch, through user_can_read_license_roll(). The rows are real people,
-- so the gate is the narrow one. Additive and idempotent.

CREATE OR REPLACE FUNCTION public.user_can_read_license_roll()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_team_prospects_access();
$$;
COMMENT ON FUNCTION public.user_can_read_license_roll() IS
  'State roll (punch list #411): true for the people who hold the Hiring switch. The one gate on the kept roll of state licenses, so the rule has one home.';
REVOKE EXECUTE ON FUNCTION public.user_can_read_license_roll() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_read_license_roll() TO authenticated, service_role;

-- ── The ledger ───────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.license_roll_pulls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('tsbpe', 'tdlr')),
  -- The state's file: RMP, MP, JP, TP or PA for the plumbing board, a license type for TDLR.
  file text NOT NULL CHECK (length(btrim(file)) > 0),
  trade text NOT NULL CHECK (trade IN ('plumbing', 'electrical', 'hvac')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  rows_seen integer NOT NULL DEFAULT 0 CHECK (rows_seen >= 0),
  rows_kept integer NOT NULL DEFAULT 0 CHECK (rows_kept >= 0),
  added integer NOT NULL DEFAULT 0 CHECK (added >= 0),
  changed integer NOT NULL DEFAULT 0 CHECK (changed >= 0),
  gone integer NOT NULL DEFAULT 0 CHECK (gone >= 0),
  -- Empty when the file was read whole. A pull that failed keeps its reason and changes no roll row.
  error text NOT NULL DEFAULT '',
  -- Who pressed Pull now. Null for the weekly job.
  pulled_by uuid REFERENCES public.users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS license_roll_pulls_file_idx ON public.license_roll_pulls (source, file, started_at DESC);
COMMENT ON TABLE public.license_roll_pulls IS
  'State roll (punch list #411): one row a state file read by license-roll-pull, with the rows it saw and kept, what was added, changed and gone, and the reason when it failed. Written with the service key only.';

ALTER TABLE public.license_roll_pulls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS license_roll_pulls_select ON public.license_roll_pulls;
CREATE POLICY license_roll_pulls_select ON public.license_roll_pulls
  FOR SELECT TO authenticated
  USING ((SELECT public.user_can_read_license_roll()));
REVOKE ALL ON TABLE public.license_roll_pulls FROM anon;
REVOKE ALL ON TABLE public.license_roll_pulls FROM authenticated;
GRANT SELECT ON TABLE public.license_roll_pulls TO authenticated;
GRANT ALL ON TABLE public.license_roll_pulls TO service_role;

-- ── The roll ─────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.license_roll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('tsbpe', 'tdlr')),
  trade text NOT NULL CHECK (trade IN ('plumbing', 'electrical', 'hvac')),
  -- The rank, in the words license_targets already uses, with a responsible master apart from a master.
  license_class text NOT NULL CHECK (license_class IN (
    'apprentice', 'tradesman', 'journeyman', 'master', 'responsible_master',
    'registered_tech', 'certified_tech', 'contractor')),
  -- As the state writes it. Unique within a source and a class, not across them.
  license_number text NOT NULL CHECK (length(btrim(license_number)) > 0),
  status text NOT NULL CHECK (status IN ('current', 'expired')),
  -- The plumbing board gives the day this rank was licensed. TDLR gives none.
  licensed_on date,
  expires_on date,
  last_name text NOT NULL DEFAULT '',
  first_name text NOT NULL DEFAULT '',
  middle_name text NOT NULL DEFAULT '',
  suffix text NOT NULL DEFAULT '',
  -- last name, first name, middle initial and five-digit ZIP, lower case, joined with '|'. Joins one person's rows
  -- across ranks and holds Leave off. Two people can share one, so a join on it is a match to check.
  name_key text NOT NULL CHECK (length(btrim(name_key)) > 0),
  zip text NOT NULL DEFAULT '',
  -- Upper case, as the state writes it and as license_roll_counties holds it.
  county text NOT NULL DEFAULT '',
  -- medical_gas, fire_sprinkler, water_supply, drain_cleaner, drain_cleaner_restricted, utilities_installer for
  -- plumbing; the A/C class and endorsement letters for a contractor.
  endorsements text[] NOT NULL DEFAULT '{}',
  -- A responsible master plumber or a contractor: the company on the state's row.
  company text NOT NULL DEFAULT '',
  -- A responsible master plumber: the day the insurance on file with the board ends.
  insurance_ends_on date,
  -- The number is one of our own people's or subs'. Such a row is kept whatever the county.
  ours boolean NOT NULL DEFAULT false,
  first_seen_on date NOT NULL,
  last_seen_on date NOT NULL,
  -- The day a pull first found the row missing from the state's file. Null while it is there.
  gone_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT license_roll_number_once UNIQUE (source, license_class, license_number)
);
CREATE INDEX IF NOT EXISTS license_roll_place_idx ON public.license_roll (trade, county, license_class);
CREATE INDEX IF NOT EXISTS license_roll_name_key_idx ON public.license_roll (name_key);
CREATE INDEX IF NOT EXISTS license_roll_licensed_idx ON public.license_roll (trade, licensed_on DESC);
CREATE INDEX IF NOT EXISTS license_roll_lapsed_idx ON public.license_roll (trade, expires_on) WHERE status = 'expired';
CREATE INDEX IF NOT EXISTS license_roll_ours_idx ON public.license_roll (source, license_number) WHERE ours;
COMMENT ON TABLE public.license_roll IS
  'State roll (punch list #411): one row a state license as the state''s file has it today, kept for the counties in license_roll_counties or because the number is one of our own (ours). Name, number, class, status, dates, ZIP, county and endorsements; no phone, street address or email, which the state does not give. Written by license-roll-pull with the service key only.';

ALTER TABLE public.license_roll ENABLE ROW LEVEL SECURITY;
-- The rule sits in a scalar subquery so it is read once per statement.
DROP POLICY IF EXISTS license_roll_select ON public.license_roll;
CREATE POLICY license_roll_select ON public.license_roll
  FOR SELECT TO authenticated
  USING ((SELECT public.user_can_read_license_roll()));
REVOKE ALL ON TABLE public.license_roll FROM anon;
REVOKE ALL ON TABLE public.license_roll FROM authenticated;
GRANT SELECT ON TABLE public.license_roll TO authenticated;
GRANT ALL ON TABLE public.license_roll TO service_role;

-- ── What changed ─────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.license_roll_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Leave off deletes the person's rows, and their history goes with them.
  roll_id uuid NOT NULL REFERENCES public.license_roll(id) ON DELETE CASCADE,
  pull_id uuid REFERENCES public.license_roll_pulls(id) ON DELETE SET NULL,
  seen_on date NOT NULL,
  -- first_seen: new on the roll. renewed: a later expiry on a current license. lapsed: current to expired.
  -- current_again: expired to current. moved: the county or ZIP changed. endorsement: one was added or dropped.
  -- named: the name changed. gone: missing from the state's file. back: there again after being gone.
  kind text NOT NULL CHECK (kind IN (
    'first_seen', 'renewed', 'lapsed', 'current_again', 'moved', 'endorsement', 'named', 'gone', 'back')),
  -- The fields that changed, before and after, keyed by column name.
  was jsonb NOT NULL DEFAULT '{}'::jsonb,
  now_is jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS license_roll_changes_roll_idx ON public.license_roll_changes (roll_id, seen_on DESC);
CREATE INDEX IF NOT EXISTS license_roll_changes_seen_idx ON public.license_roll_changes (seen_on DESC, kind);
COMMENT ON TABLE public.license_roll_changes IS
  'State roll (punch list #411): what a pull saw change on one license_roll row — first seen, renewed, lapsed, current again, moved, an endorsement, a name, gone, back — with the fields before and after. The state keeps no history, so this starts on our first pull. Append-only, written with the service key only.';

ALTER TABLE public.license_roll_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS license_roll_changes_select ON public.license_roll_changes;
CREATE POLICY license_roll_changes_select ON public.license_roll_changes
  FOR SELECT TO authenticated
  USING ((SELECT public.user_can_read_license_roll()));
REVOKE ALL ON TABLE public.license_roll_changes FROM anon;
REVOKE ALL ON TABLE public.license_roll_changes FROM authenticated;
GRANT SELECT ON TABLE public.license_roll_changes TO authenticated;
GRANT ALL ON TABLE public.license_roll_changes TO service_role;

-- ── The counties kept ────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.license_roll_counties (
  -- Upper case, as the state's files write a county.
  county text PRIMARY KEY CHECK (county = upper(btrim(county)) AND length(county) > 0),
  added_by uuid REFERENCES public.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  added_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.license_roll_counties IS
  'State roll (punch list #411): the counties whose license rows the pull keeps. Seeded with the five the permits cover. A person who reads the roll adds or removes one; the next pull follows it.';

INSERT INTO public.license_roll_counties (county, added_by)
VALUES ('BEXAR', NULL), ('TRAVIS', NULL), ('HAYS', NULL), ('COMAL', NULL), ('GUADALUPE', NULL)
ON CONFLICT (county) DO NOTHING;

ALTER TABLE public.license_roll_counties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS license_roll_counties_select ON public.license_roll_counties;
CREATE POLICY license_roll_counties_select ON public.license_roll_counties
  FOR SELECT TO authenticated
  USING ((SELECT public.user_can_read_license_roll()));
DROP POLICY IF EXISTS license_roll_counties_insert ON public.license_roll_counties;
CREATE POLICY license_roll_counties_insert ON public.license_roll_counties
  FOR INSERT TO authenticated
  WITH CHECK (added_by = auth.uid() AND (SELECT public.user_can_read_license_roll()));
DROP POLICY IF EXISTS license_roll_counties_delete ON public.license_roll_counties;
CREATE POLICY license_roll_counties_delete ON public.license_roll_counties
  FOR DELETE TO authenticated
  USING ((SELECT public.user_can_read_license_roll()));
REVOKE ALL ON TABLE public.license_roll_counties FROM anon;
REVOKE ALL ON TABLE public.license_roll_counties FROM authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.license_roll_counties TO authenticated;
GRANT ALL ON TABLE public.license_roll_counties TO service_role;

-- ── Left off ─────────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.license_roll_left_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One of the two is always there: a row's number, or the person's name_key.
  source text CHECK (source IS NULL OR source IN ('tsbpe', 'tdlr')),
  license_class text,
  license_number text,
  name_key text,
  note text NOT NULL DEFAULT '',
  noted_by uuid REFERENCES public.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  noted_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT license_roll_left_off_names_someone CHECK (
    (license_number IS NOT NULL AND source IS NOT NULL AND length(btrim(license_number)) > 0)
    OR (name_key IS NOT NULL AND length(btrim(name_key)) > 0))
);
CREATE INDEX IF NOT EXISTS license_roll_left_off_number_idx ON public.license_roll_left_off (source, license_number) WHERE license_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS license_roll_left_off_name_idx ON public.license_roll_left_off (name_key) WHERE name_key IS NOT NULL;
COMMENT ON TABLE public.license_roll_left_off IS
  'State roll (punch list #411): a person who asked not to be listed, kept by license number and by name_key so a new rank does not bring them back. license-roll-pull keeps no row that matches one. Rows are added by the Leave off press, which ships with the person''s sheet; until then only the service key writes here.';

ALTER TABLE public.license_roll_left_off ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS license_roll_left_off_select ON public.license_roll_left_off;
CREATE POLICY license_roll_left_off_select ON public.license_roll_left_off
  FOR SELECT TO authenticated
  USING ((SELECT public.user_can_read_license_roll()));
REVOKE ALL ON TABLE public.license_roll_left_off FROM anon;
REVOKE ALL ON TABLE public.license_roll_left_off FROM authenticated;
GRANT SELECT ON TABLE public.license_roll_left_off TO authenticated;
GRANT ALL ON TABLE public.license_roll_left_off TO service_role;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
