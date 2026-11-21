-- Permits, Market: what was looked up about a builder, and a person's check of it (punch list
-- #405, step three, Ask for). The call list offers builders for the owner to call. A one-time
-- lookup finds, for a name, what kind of company it is, an office phone, and one person with a
-- title to ask for. Each fact is kept with the page it came from and the day it was read there,
-- and reads as "looked up, not checked" until a person says it held.
--
-- Two tables, both append-only:
--   builder_lookups         one row a fact. The newest row per (builder_key, fact) is the fact.
--     fact = 'kind'    value is builder | owner | design_firm | permit_service | trade, or
--                      'unknown' when no public page said it in plain words. `detail` is a few
--                      words on the kind.
--     fact = 'phone'   value is the office phone as the page wrote it.
--     fact = 'person'  value is the person's name, `detail` their title.
--   builder_lookup_checks   one row a press on a fact: checked, wrong, or back (a press undone).
--                           The newest press per fact is its state.
--
-- A fact is added only by a dev account, under its own name: the lookups are run by an agent
-- session signed in as the dev, and `looked_up_how` says an agent did the looking. A press is
-- given by anyone who reads permits, as themself. Nobody updates or deletes either.
--
-- A looked-up fact is apart from the office's own word. `builders.kind`, `builder_marks` and
-- `builder_call_answers` are not touched and not read here. A name is a builder's key, as
-- `permits.builder_key` holds it, with no foreign key: most names on permits have no `builders` row.
SET lock_timeout = '3s';

CREATE TABLE IF NOT EXISTS public.builder_lookups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_key text NOT NULL CHECK (length(btrim(builder_key)) > 0),
  fact text NOT NULL CHECK (fact IN ('kind', 'phone', 'person')),
  value text NOT NULL CHECK (length(btrim(value)) > 0),
  -- The person's title, or a few words on the kind. Empty for a phone.
  detail text NOT NULL DEFAULT '',
  -- The page the fact was read on.
  source_url text NOT NULL DEFAULT '',
  -- The day it was read there.
  looked_up_on date NOT NULL,
  -- The account that wrote the row. Kept when that account is deleted, with nobody named.
  looked_up_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  -- Who did the looking: an agent session, or a person.
  looked_up_how text NOT NULL DEFAULT 'agent' CHECK (looked_up_how IN ('agent', 'person')),
  -- The city whose call list the name was looked up for.
  city text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT builder_lookups_kind_check CHECK (fact <> 'kind' OR value IN ('builder', 'owner', 'design_firm', 'permit_service', 'trade', 'unknown')),
  -- Every fact names its page. The one row that may have none says the kind could not be told.
  CONSTRAINT builder_lookups_source_check CHECK ((fact = 'kind' AND value = 'unknown') OR source_url ~ '^https?://[^[:space:]]+$')
);
CREATE INDEX IF NOT EXISTS builder_lookups_key_idx ON public.builder_lookups (builder_key, fact, created_at);
COMMENT ON TABLE public.builder_lookups IS 'Permits, Market (punch list #405, Ask for): one fact looked up about a builder key — its kind, an office phone, or a person and title to ask for — with the page it was read on, the day, the account that wrote it and whether an agent looked. Append-only; the newest row per key and fact is the fact. Apart from the office''s own word (builders.kind, builder_marks).';

ALTER TABLE public.builder_lookups ENABLE ROW LEVEL SECURITY;
-- The people who read permits (the office and every estimator) read the facts.
-- The rule sits in a scalar subquery so it is read once per statement, as 20261111013000 set the others.
DROP POLICY IF EXISTS builder_lookups_select ON public.builder_lookups;
CREATE POLICY builder_lookups_select ON public.builder_lookups
  FOR SELECT TO authenticated
  USING ((SELECT public.user_can_research_permits()));
-- Only a dev account adds a fact, and only under its own name.
DROP POLICY IF EXISTS builder_lookups_insert ON public.builder_lookups;
CREATE POLICY builder_lookups_insert ON public.builder_lookups
  FOR INSERT TO authenticated
  WITH CHECK (looked_up_by = auth.uid() AND (SELECT public.is_dev()));
REVOKE ALL ON TABLE public.builder_lookups FROM anon;
REVOKE ALL ON TABLE public.builder_lookups FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.builder_lookups TO authenticated;
GRANT ALL ON TABLE public.builder_lookups TO service_role;

CREATE TABLE IF NOT EXISTS public.builder_lookup_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lookup_id uuid NOT NULL REFERENCES public.builder_lookups(id) ON DELETE CASCADE,
  verdict text NOT NULL CHECK (verdict IN ('checked', 'wrong', 'back')),
  -- Who pressed. Kept when that account is deleted, with nobody named.
  said_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  said_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS builder_lookup_checks_lookup_idx ON public.builder_lookup_checks (lookup_id, said_at);
COMMENT ON TABLE public.builder_lookup_checks IS 'Permits, Market (punch list #405, Ask for): a person''s press on one looked-up fact — checked (it held), wrong (it did not, and the fact is no longer shown) or back (a press undone) — with who and when. Append-only; the newest row per fact is its state, and a fact with none reads as looked up, not checked.';

ALTER TABLE public.builder_lookup_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS builder_lookup_checks_select ON public.builder_lookup_checks;
CREATE POLICY builder_lookup_checks_select ON public.builder_lookup_checks
  FOR SELECT TO authenticated
  USING ((SELECT public.user_can_research_permits()));
-- Anyone who reads permits presses, each as themself.
DROP POLICY IF EXISTS builder_lookup_checks_insert ON public.builder_lookup_checks;
CREATE POLICY builder_lookup_checks_insert ON public.builder_lookup_checks
  FOR INSERT TO authenticated
  WITH CHECK (said_by = auth.uid() AND (SELECT public.user_can_research_permits()));
REVOKE ALL ON TABLE public.builder_lookup_checks FROM anon;
REVOKE ALL ON TABLE public.builder_lookup_checks FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.builder_lookup_checks TO authenticated;
GRANT ALL ON TABLE public.builder_lookup_checks TO service_role;

SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
