SET lock_timeout = '3s';

-- v2.7411 (punch list #345, the link that asks who is looking, step A): who opened a painted map's link.
--
-- Taunya's ask of 2026-11-15: a map's public link stays open to anyone, with no sign-in, so long as whoever is not
-- signed in gives their name. The company keeps the name, the device the page was opened on, and where the reader
-- was when they chose to show it. The page says all of that before it asks. v2.7223 kept a count of opens and
-- nothing else; this table is where the rest is kept. This migration is the table alone: nothing writes it yet.
--
--   * One row a device a link. The same phone opening the same link again is the same row, counted again.
--   * visitor_name: as typed. Not proven: anyone can type any name. user_id beside it when the reader was signed in.
--   * device_id: an id the page puts on that phone or computer the first time it opens any map's link. It is the
--     nearest a web page has to a device's fingerprint: the same until the browser's site data is cleared. A page
--     cannot read a serial number.
--   * device_words, user_agent, screen, language, time_zone, ip: what the browser and the request said.
--   * The place: only after the reader pressed Show where I am, which says the company will see it. The first point
--     and the latest, each with how sure the phone was and when. Never a trail.
--
-- Who may read a row: the office and whoever painted the map. Not everyone who can open the map: a crew member who
-- reads a job's map does not read who else opened it or where they stood. Nobody signed in writes one: the
-- painted-map-link edge function writes as the service role. A visit goes with its link and with its map.
--
-- Idempotent: IF NOT EXISTS, and the policy is dropped before it is made.

CREATE TABLE IF NOT EXISTS public.painted_map_link_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.painted_map_links(id) ON DELETE CASCADE,
  map_id uuid NOT NULL REFERENCES public.painted_maps(id) ON DELETE CASCADE,
  visitor_name text NOT NULL CHECK (char_length(btrim(visitor_name)) BETWEEN 1 AND 80),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  device_id text NOT NULL CHECK (device_id ~ '^[0-9a-f-]{16,64}$'),
  device_words text NOT NULL DEFAULT '' CHECK (char_length(device_words) <= 80),
  user_agent text NOT NULL DEFAULT '' CHECK (char_length(user_agent) <= 400),
  screen text NOT NULL DEFAULT '' CHECK (char_length(screen) <= 40),
  language text NOT NULL DEFAULT '' CHECK (char_length(language) <= 40),
  time_zone text NOT NULL DEFAULT '' CHECK (char_length(time_zone) <= 64),
  ip text NOT NULL DEFAULT '' CHECK (char_length(ip) <= 64),
  first_opened_at timestamptz NOT NULL DEFAULT now(),
  last_opened_at timestamptz NOT NULL DEFAULT now(),
  open_count integer NOT NULL DEFAULT 1 CHECK (open_count >= 1),
  first_lat double precision,
  first_lng double precision,
  first_accuracy_m real,
  first_located_at timestamptz,
  last_lat double precision,
  last_lng double precision,
  last_accuracy_m real,
  last_located_at timestamptz,
  CONSTRAINT painted_map_link_visits_device_key UNIQUE (link_id, device_id),
  -- A point is whole or it is not there: both numbers, in range, with its time. Each part is asked IS NOT NULL by
  -- name, since a CHECK that works out to NULL passes.
  CONSTRAINT painted_map_link_visits_first_point CHECK (
    (first_lat IS NULL AND first_lng IS NULL AND first_accuracy_m IS NULL AND first_located_at IS NULL)
    OR (first_lat IS NOT NULL AND first_lng IS NOT NULL AND first_located_at IS NOT NULL
        AND first_lat BETWEEN -90 AND 90 AND first_lng BETWEEN -180 AND 180
        AND (first_accuracy_m IS NULL OR first_accuracy_m >= 0))
  ),
  CONSTRAINT painted_map_link_visits_last_point CHECK (
    (last_lat IS NULL AND last_lng IS NULL AND last_accuracy_m IS NULL AND last_located_at IS NULL)
    OR (last_lat IS NOT NULL AND last_lng IS NOT NULL AND last_located_at IS NOT NULL
        AND last_lat BETWEEN -90 AND 90 AND last_lng BETWEEN -180 AND 180
        AND (last_accuracy_m IS NULL OR last_accuracy_m >= 0))
  ),
  -- The latest point is never there without the first.
  CONSTRAINT painted_map_link_visits_points_in_order CHECK (last_located_at IS NULL OR first_located_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS painted_map_link_visits_map_idx ON public.painted_map_link_visits (map_id, last_opened_at DESC);

COMMENT ON TABLE public.painted_map_link_visits IS 'Paint a map (#345): who opened a map''s link at /way/<code>. One row a device a link: the name given, the device, and where the reader was when they chose to show it. Read by the office and the map''s painter. Written only by the painted-map-link edge function.';
COMMENT ON COLUMN public.painted_map_link_visits.visitor_name IS 'The name as typed on the page, or the account''s name for a signed-in reader. Not proven.';
COMMENT ON COLUMN public.painted_map_link_visits.user_id IS 'The account, when the reader was signed in. Null for everyone else.';
COMMENT ON COLUMN public.painted_map_link_visits.device_id IS 'An id the page put on the device the first time it opened a map''s link. The same until the browser''s site data is cleared.';
COMMENT ON COLUMN public.painted_map_link_visits.ip IS 'The internet address the request came from, as the edge saw it.';
COMMENT ON COLUMN public.painted_map_link_visits.first_lat IS 'Where the reader was when they first pressed Show where I am, which says the company will see it. Null until then.';
COMMENT ON COLUMN public.painted_map_link_visits.last_lat IS 'Where the reader last was while Show where I am was on. The first point and this one, never a trail.';

ALTER TABLE public.painted_map_link_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS painted_map_link_visits_select ON public.painted_map_link_visits;
CREATE POLICY painted_map_link_visits_select ON public.painted_map_link_visits FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.painted_maps m
    WHERE m.id = map_id AND (m.created_by = auth.uid() OR public.is_office_staff())
  ));
REVOKE ALL ON TABLE public.painted_map_link_visits FROM anon, authenticated;
GRANT SELECT ON TABLE public.painted_map_link_visits TO authenticated;
GRANT ALL ON TABLE public.painted_map_link_visits TO service_role;

-- House rules for every CREATE TABLE: training-mode blocks, the digital-twin fence and the archived seal.
SELECT public.apply_read_only_write_blocks();
SELECT public.apply_read_only_stmt_blocks();
SELECT public.apply_digital_twin_write_blocks();
SELECT public.apply_archived_read_blocks();
